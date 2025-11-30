import 'dotenv/config';
import { config } from './config';

console.log('Debug: Database Config');
console.log('----------------------');
console.log(`Host: ${config.db.host}`);
console.log(`Port: ${config.db.port}`);
console.log(`User: ${config.db.user}`);
console.log(`Database: ${config.db.database}`);
console.log(`Password Length: ${config.db.password ? config.db.password.length : 0}`);
console.log(`Password (first 2 chars): ${config.db.password ? config.db.password.substring(0, 2) : 'N/A'}***`);
