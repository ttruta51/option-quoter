import { runFetch } from '../index';

// Invoked weekdays at 5pm ET by EventBridge Scheduler.
// A thrown error fails the invocation, which trips the FetchErrors alarm.
export const handler = async () => runFetch();
