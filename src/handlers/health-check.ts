import { healthCheck, printHealthCheck } from '../health-check';

// Invoked weekdays at 6pm ET by EventBridge Scheduler, an hour after the fetch.
// Throwing when unhealthy fails the invocation, which trips the HealthCheckErrors alarm.
export const handler = async () => {
    const result = await healthCheck();
    printHealthCheck(result);
    if (!result.success) {
        throw new Error(`Health check failed: ${result.message}`);
    }
    return result;
};
