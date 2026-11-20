import { connectToDatabase } from '../lib/db.ts';
import { ensureSchema } from '../lib/schema.ts';

await ensureSchema(connectToDatabase());
console.log('Database tables are up to date.');
