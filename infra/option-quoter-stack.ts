import * as path from 'path';
import {
    CfnOutput,
    Duration,
    RemovalPolicy,
    Stack,
    StackProps,
    TimeZone,
    aws_budgets as budgets,
    aws_cloudwatch as cloudwatch,
    aws_cloudwatch_actions as cwActions,
    aws_ec2 as ec2,
    aws_lambda as lambda,
    aws_lambda_nodejs as nodejs,
    aws_logs as logs,
    aws_rds as rds,
    aws_scheduler as scheduler,
    aws_scheduler_targets as targets,
    aws_sns as sns,
    aws_sns_subscriptions as subs,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface OptionQuoterStackProps extends StackProps {
    tickers: string;
    extendedExpirationTickers: string;
    alertEmail: string;
    monthlyBudgetUsd: number;
}

export class OptionQuoterStack extends Stack {
    constructor(scope: Construct, id: string, props: OptionQuoterStackProps) {
        super(scope, id, props);

        // ---------------------------------------------------------------
        // Network: a VPC with private *isolated* subnets only.
        // No Internet Gateway, no NAT Gateway, so nothing in the VPC can reach
        // (or be reached from) the internet, and there are no hourly network
        // charges. The Lambdas run outside the VPC and talk to the database
        // via the Data API's HTTPS endpoint instead of a direct connection.
        // ---------------------------------------------------------------
        const vpc = new ec2.Vpc(this, 'Vpc', {
            maxAzs: 2, // Aurora requires a subnet group spanning at least 2 AZs
            natGateways: 0,
            subnetConfiguration: [
                { name: 'database', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
            ],
        });

        // ---------------------------------------------------------------
        // Database: Aurora PostgreSQL Serverless v2 that scales to 0 ACU.
        // It pauses after 5 idle minutes; you pay only for storage while paused.
        // ---------------------------------------------------------------
        const cluster = new rds.DatabaseCluster(this, 'Database', {
            engine: rds.DatabaseClusterEngine.auroraPostgres({
                version: rds.AuroraPostgresEngineVersion.VER_17_9,
            }),
            writer: rds.ClusterInstance.serverlessV2('writer'),
            serverlessV2MinCapacity: 0,
            serverlessV2MaxCapacity: 2,
            serverlessV2AutoPauseDuration: Duration.minutes(5),
            enableDataApi: true,
            defaultDatabaseName: 'option_quotes',
            credentials: rds.Credentials.fromGeneratedSecret('quoter_admin'),
            vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
            storageEncrypted: true,
            // Protect the data: 7 days of point-in-time backups (free up to the
            // DB's size), deletion protection on, and a final snapshot if the
            // stack is ever deleted.
            backup: { retention: Duration.days(7) },
            deletionProtection: true,
            removalPolicy: RemovalPolicy.SNAPSHOT,
        });

        // ---------------------------------------------------------------
        // Lambdas
        // ---------------------------------------------------------------
        const commonEnv = {
            DB_CLUSTER_ARN: cluster.clusterArn,
            DB_SECRET_ARN: cluster.secret!.secretArn,
            DB_NAME: 'option_quotes',
            TICKERS: props.tickers,
            EXTENDED_EXPIRATION_TICKERS: props.extendedExpirationTickers,
        };

        const makeFunction = (id: string, entry: string, timeout: Duration) => {
            const fn = new nodejs.NodejsFunction(this, id, {
                entry: path.join(__dirname, '..', 'src', 'handlers', entry),
                handler: 'handler',
                runtime: lambda.Runtime.NODEJS_22_X,
                architecture: lambda.Architecture.ARM_64,
                memorySize: 512,
                timeout,
                environment: commonEnv,
                // Scheduler invokes asynchronously; one Lambda-level retry on failure.
                // Re-running is safe: quote inserts use ON CONFLICT DO NOTHING.
                retryAttempts: 1,
                logGroup: new logs.LogGroup(this, `${id}Logs`, {
                    retention: logs.RetentionDays.THREE_MONTHS,
                    removalPolicy: RemovalPolicy.DESTROY,
                }),
                bundling: { target: 'node22', sourceMap: true },
            });
            cluster.grantDataApiAccess(fn);
            return fn;
        };

        // Allows several resume retries plus fetching/saving all tickers
        const fetchFn = makeFunction('FetchQuotes', 'fetch.ts', Duration.minutes(10));
        const healthFn = makeFunction('HealthCheck', 'health-check.ts', Duration.minutes(5));

        // ---------------------------------------------------------------
        // Schedules (EventBridge Scheduler). Cron in America/New_York, so
        // 5pm stays 5pm across daylight saving changes.
        // ---------------------------------------------------------------
        new scheduler.Schedule(this, 'DailyFetchSchedule', {
            description: 'Fetch end-of-day option quotes, weekdays 5pm ET',
            schedule: scheduler.ScheduleExpression.cron({
                minute: '0', hour: '17', weekDay: 'MON-FRI', timeZone: TimeZone.AMERICA_NEW_YORK,
            }),
            target: new targets.LambdaInvoke(fetchFn, {}),
        });

        new scheduler.Schedule(this, 'DailyHealthCheckSchedule', {
            description: 'Verify today\'s option quotes were saved, weekdays 6pm ET',
            schedule: scheduler.ScheduleExpression.cron({
                minute: '0', hour: '18', weekDay: 'MON-FRI', timeZone: TimeZone.AMERICA_NEW_YORK,
            }),
            target: new targets.LambdaInvoke(healthFn, {}),
        });

        // ---------------------------------------------------------------
        // Alerting: email when either Lambda fails.
        // ---------------------------------------------------------------
        const alertTopic = new sns.Topic(this, 'Alerts', { displayName: 'Option Quoter Alerts' });
        alertTopic.addSubscription(new subs.EmailSubscription(props.alertEmail));

        for (const [name, fn] of [['FetchErrors', fetchFn], ['HealthCheckErrors', healthFn]] as const) {
            const alarm = new cloudwatch.Alarm(this, name, {
                alarmDescription: `${fn.node.id} Lambda failed. Check its CloudWatch Logs.`,
                metric: fn.metricErrors({ period: Duration.minutes(5), statistic: 'Sum' }),
                threshold: 1,
                evaluationPeriods: 1,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            });
            alarm.addAlarmAction(new cwActions.SnsAction(alertTopic));
        }

        // ---------------------------------------------------------------
        // Cost guardrail: email if the whole account's monthly spend is
        // forecast to exceed, or actually exceeds, the budget.
        // ---------------------------------------------------------------
        const subscribers = [{ subscriptionType: 'EMAIL', address: props.alertEmail }];
        new budgets.CfnBudget(this, 'MonthlyBudget', {
            budget: {
                budgetName: 'option-quoter-monthly',
                budgetType: 'COST',
                timeUnit: 'MONTHLY',
                budgetLimit: { amount: props.monthlyBudgetUsd, unit: 'USD' },
            },
            notificationsWithSubscribers: [
                {
                    notification: { notificationType: 'FORECASTED', comparisonOperator: 'GREATER_THAN', threshold: 100 },
                    subscribers,
                },
                {
                    notification: { notificationType: 'ACTUAL', comparisonOperator: 'GREATER_THAN', threshold: 80 },
                    subscribers,
                },
            ],
        });

        // ---------------------------------------------------------------
        // Outputs, used to run scripts locally (copy into .env)
        // ---------------------------------------------------------------
        new CfnOutput(this, 'DbClusterArn', { value: cluster.clusterArn });
        new CfnOutput(this, 'DbSecretArn', { value: cluster.secret!.secretArn });
        new CfnOutput(this, 'FetchFunctionName', { value: fetchFn.functionName });
        new CfnOutput(this, 'HealthCheckFunctionName', { value: healthFn.functionName });
    }
}
