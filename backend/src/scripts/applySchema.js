import dotenv from 'dotenv';

import { connectToDatabase, disconnectFromDatabase } from '../config/database.js';
import { syncSchema } from '../db/syncSchema.js';

dotenv.config();

try {
  await connectToDatabase();
  await syncSchema();
  console.log('Schema synchronization completed successfully.');
  await disconnectFromDatabase();
  process.exit(0);
} catch (error) {
  console.error(`Schema synchronization failed: ${error.message}`);
  await disconnectFromDatabase();
  process.exit(1);
}
