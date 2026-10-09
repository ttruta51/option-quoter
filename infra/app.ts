#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { OptionQuoterStack } from './option-quoter-stack';

const app = new App();

// Settings live in cdk.json under "context"; override with `-c key=value`.
const context = (key: string): string => {
    const value = app.node.tryGetContext(key);
    if (value === undefined || value === '') {
        throw new Error(`Missing CDK context "${key}". Set it in cdk.json or pass -c ${key}=...`);
    }
    return String(value);
};

new OptionQuoterStack(app, 'OptionQuoterStack', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
    tickers: context('tickers'),
    extendedExpirationTickers: context('extendedExpirationTickers'),
    alertEmail: context('alertEmail'),
    monthlyBudgetUsd: Number(context('monthlyBudgetUsd')),
});
