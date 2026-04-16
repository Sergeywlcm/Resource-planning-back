import mongoose from 'mongoose';

const DEFAULT_DB_NAME = 'resource_planning';

const readyStateLabel = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

export function getDatabaseUri() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error(
      'Database configuration error: MONGO_URI is missing. Set MONGO_URI in backend/.env before starting the server.'
    );
  }

  return mongoUri;
}

export async function connectToDatabase() {
  const mongoUri = getDatabaseUri();
  const dbName = process.env.MONGO_DB_NAME ?? DEFAULT_DB_NAME;

  try {
    await mongoose.connect(mongoUri, { dbName, serverSelectionTimeoutMS: 5000 });
    console.log(`Database connected (${dbName})`);
  } catch (error) {
    throw new Error(`Unable to connect to MongoDB at ${mongoUri}: ${error.message}`);
  }
}

export async function disconnectFromDatabase() {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.disconnect();
}

export function getDatabaseHealth() {
  const readyState = mongoose.connection.readyState;

  return {
    state: readyStateLabel[readyState] ?? 'unknown',
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null
  };
}
