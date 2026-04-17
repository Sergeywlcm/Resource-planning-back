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

function sendError(res, status, message, code) {
  return res.status(status).json({
    error: {
      code,
      message
    }
  });
}

function normalizeResourcePayload(body) {
  return {
    name: body?.name,
    capacity_hours: body?.capacity_hours,
    is_active: body?.is_active
  };
}

app.post('/api/resources', async (req, res) => {
  try {
    const resource = await Resource.create(normalizeResourcePayload(req.body));

    return res.status(201).json({ data: resource.toJSON() });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return sendError(res, 400, error.message, 'RESOURCE_VALIDATION_ERROR');
    }

    if (error?.code === 11000) {
      return sendError(res, 409, 'Resource name must be unique.', 'RESOURCE_DUPLICATE_NAME');
    }

    return sendError(res, 500, 'Failed to create resource.', 'RESOURCE_CREATE_FAILED');
  }
});

app.patch('/api/resources/:id', async (req, res) => {
  try {
    const updatedResource = await Resource.findByIdAndUpdate(
      req.params.id,
      normalizeResourcePayload(req.body),
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedResource) {
      return sendError(res, 404, 'Resource not found.', 'RESOURCE_NOT_FOUND');
    }

    return res.status(200).json({ data: updatedResource.toJSON() });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return sendError(res, 400, 'Invalid resource id.', 'RESOURCE_INVALID_ID');
    }

    if (error instanceof mongoose.Error.ValidationError) {
      return sendError(res, 400, error.message, 'RESOURCE_VALIDATION_ERROR');
    }

    if (error?.code === 11000) {
      return sendError(res, 409, 'Resource name must be unique.', 'RESOURCE_DUPLICATE_NAME');
    }

    return sendError(res, 500, 'Failed to update resource.', 'RESOURCE_UPDATE_FAILED');
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
