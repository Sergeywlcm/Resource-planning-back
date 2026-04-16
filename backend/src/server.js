import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';

import { connectToDatabase, getDatabaseHealth } from './config/database.js';
import { syncSchema } from './db/syncSchema.js';
import { Resource } from './models/resource.model.js';

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

app.post('/api/resources', async (req, res) => {
  try {
    const resource = await Resource.create({
      name: req.body?.name,
      capacity_hours: req.body?.capacity_hours,
      is_active: req.body?.is_active
    });

    res.status(201).json(resource.toJSON());
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ error: error.message });
    }

    if (error?.code === 11000) {
      return res.status(409).json({ error: 'Resource name must be unique.' });
    }

    return res.status(500).json({ error: 'Failed to create resource.' });
  }
});

app.patch('/api/resources/:id', async (req, res) => {
  try {
    const updatedResource = await Resource.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body?.name,
        capacity_hours: req.body?.capacity_hours,
        is_active: req.body?.is_active
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedResource) {
      return res.status(404).json({ error: 'Resource not found.' });
    }

    return res.status(200).json(updatedResource.toJSON());
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ error: error.message });
    }

    if (error?.code === 11000) {
      return res.status(409).json({ error: 'Resource name must be unique.' });
    }

    return res.status(500).json({ error: 'Failed to update resource.' });
  }
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
