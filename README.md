# Option Quoter

Fetches end-of-day option quotes for configured stock tickers from Yahoo Finance, computes Greeks, and stores them in Aurora PostgreSQL on AWS.

## Architecture

```
EventBridge Scheduler ──(weekdays 5pm ET)──▶ FetchQuotes Lambda ──HTTPS──▶ Yahoo Finance
                      ──(weekdays 6pm ET)──▶ HealthCheck Lambda
                                                  │
                                                  │ RDS Data API (HTTPS, IAM-authenticated)
                                                  ▼
                       ┌──────────── VPC (private isolated subnets, no internet) ───────────┐
                       │   Aurora PostgreSQL Serverless v2 (scales to 0 ACU when idle)      │
                       └────────────────────────────────────────────────────────────────────┘
Lambda errors ──▶ CloudWatch Alarms ──▶ SNS ──▶ email
Account spend ──▶ AWS Budget ──▶ email
```

Design notes:
- **Lambdas run outside the VPC** and reach the database through the **RDS Data API**, an HTTPS endpoint. A Lambda inside the VPC would need a NAT Gateway (~$32/month) to reach Yahoo Finance.
- **The VPC has only private isolated subnets**: no Internet Gateway and no NAT. The database can't be reached from the internet, and its security group has no inbound rules.
- **Aurora scales to 0 ACU** after 5 idle minutes. While paused you pay only for storage. The first query wakes it up (~15s, or 30s+ after more than 24h paused), and `src/db/index.ts` retries while it resumes.
- **Data protection:** 7-day point-in-time backups, deletion protection, and a final snapshot if the stack is deleted.
- **The schema is applied automatically** (`CREATE ... IF NOT EXISTS`) at the start of every fetch run.

All infrastructure is defined with AWS CDK in `infra/`.

## Configuration

Settings live in `cdk.json` under `context`:

| Key | Meaning |
|---|---|
| `tickers` | Comma-separated tickers to fetch options for |
| `extendedExpirationTickers` | Subset of `tickers` that fetch expirations up to 70 days out (others: 14 days) |
| `monthlyBudgetUsd` | Monthly account spend that triggers a budget email |

`alertEmail` (where failure alerts and budget warnings are sent) is kept out of the public repo. Set it in the git-ignored `cdk.context.json`:

```json
{
  "alertEmail": "you@example.com"
}
```

or pass it on each deploy with `npx cdk deploy -c alertEmail=you@example.com`.

The risk-free rate (10-year Treasury yield, ^TNX) is fetched from Yahoo Finance at runtime and logged in the `risk_free_rate` table.

## Deploy

Prerequisites: Node 22+, AWS CLI configured, CDK bootstrapped in the account/region (`npx cdk bootstrap`).

```bash
npm install
npx cdk diff                  # preview changes
npx cdk deploy                # create/update the stack
```

After the first deploy, confirm the SNS subscription email AWS sends you, or you won't receive alerts.

To change tickers, edit `cdk.json` and run `npx cdk deploy` again.

## Run manually

Trigger the Lambdas on demand (function names are in the stack outputs):

```bash
aws lambda invoke --function-name <FetchFunctionName> /dev/stdout
aws lambda invoke --function-name <HealthCheckFunctionName> /dev/stdout
```

Or run locally against the deployed database. Put the stack outputs in `.env`:

```env
DB_CLUSTER_ARN=arn:aws:rds:us-east-1:...:cluster:...
DB_SECRET_ARN=arn:aws:secretsmanager:us-east-1:...:secret:...
DB_NAME=option_quotes
TICKERS=AAPL,MSFT
EXTENDED_EXPIRATION_TICKERS=
```

```bash
npm run fetch           # fetch and save quotes
npm run health-check    # verify today's data
npm run setup-db        # apply the schema (also done automatically by fetch)
npm run typecheck
```

## Query the data

The easiest way is the **RDS Query Editor** in the AWS console (RDS → Query editor). It uses the Data API, so no VPN or bastion host is needed. Choose the cluster, pick "Connect with a Secrets Manager ARN", and paste the `DbSecretArn` output.

## Approximate cost

Lambda, EventBridge Scheduler, CloudWatch Logs and SNS email fall within AWS's always-free limits at this volume. The remaining costs are roughly:
- Aurora storage: ~$0.10/GB-month, plus I/O
- Aurora compute: a few minutes of 0.5 ACU per weekday, cents per month
- Secrets Manager: $0.40/month for the database credentials
