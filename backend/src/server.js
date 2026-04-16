import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import { connectToDatabase, getDatabaseHealth } from './config/database.js';
import { syncSchema } from './db/syncSchema.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);
const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get('/health', (_req, res) => {
  const database = getDatabaseHealth();
  const statusCode = database.state === 'connected' ? 200 : 503;

  res.status(statusCode).json({
    status: statusCode === 200 ? 'ok' : 'degraded',
    database
  });
});

app.get('/api/ping', (_req, res) => {
  res.status(200).json({ message: 'Backend is reachable' });
});

async function bootstrap() {
  try {
    await connectToDatabase();
    await syncSchema();

    app.listen(port, () => {
      console.log(`Backend running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error(`Startup failed: ${error.message}`);
    process.exit(1);
  }
}

bootstrap();
