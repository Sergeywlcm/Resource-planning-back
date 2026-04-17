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

function sendSuccess(res, status, data) {
  return res.status(status).json({ data, error: null });
}

function sendError(res, status, message, details = null) {
  return res.status(status).json({
    data: null,
    error: {
      message,
      details
    }
  });
}

function parseResourcePayload(body) {
  return {
    name: body?.name,
    capacity_hours: body?.capacity_hours,
    is_active: body?.is_active
  };
}

function handleResourceWriteError(error, res, actionLabel) {
  if (error instanceof mongoose.Error.ValidationError) {
    return sendError(res, 400, 'Validation failed.', error.message);
  }

  if (error instanceof mongoose.Error.CastError) {
    return sendError(res, 400, 'Invalid resource id.', error.message);
  }

  if (error?.code === 11000) {
    return sendError(res, 409, 'Resource name must be unique.');
  }

  return sendError(res, 500, `Failed to ${actionLabel} resource.`);
}

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

app.get('/resources', async (_req, res) => {
  try {
    const resources = await Resource.find().sort({ created_at: 1 });
    return sendSuccess(res, 200, resources.map((resource) => resource.toJSON()));
  } catch (_error) {
    return sendError(res, 500, 'Failed to fetch resources.');
  }
});

app.get('/resources/:id', async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);

    if (!resource) {
      return sendError(res, 404, 'Resource not found.');
    }

    return sendSuccess(res, 200, resource.toJSON());
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return sendError(res, 400, 'Invalid resource id.', error.message);
    }

    return sendError(res, 500, 'Failed to fetch resource.');
  }
});

app.post('/resources', async (req, res) => {
  try {
    const resource = await Resource.create(parseResourcePayload(req.body));
    return sendSuccess(res, 201, resource.toJSON());
  } catch (error) {
    return handleResourceWriteError(error, res, 'create');
  }
});

app.put('/resources/:id', async (req, res) => {
  try {
    const updatedResource = await Resource.findByIdAndUpdate(
      req.params.id,
      parseResourcePayload(req.body),
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedResource) {
      return sendError(res, 404, 'Resource not found.');
    }

    return sendSuccess(res, 200, updatedResource.toJSON());
  } catch (error) {
    return handleResourceWriteError(error, res, 'update');
  }
});

app.patch('/api/resources/:id', async (req, res) => {
  try {
    const updatedResource = await Resource.findByIdAndUpdate(
      req.params.id,
      parseResourcePayload(req.body),
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedResource) {
      return sendError(res, 404, 'Resource not found.');
    }

    return sendSuccess(res, 200, updatedResource.toJSON());
  } catch (error) {
    return handleResourceWriteError(error, res, 'update');
  }
});

app.post('/api/resources', async (req, res) => {
  try {
    const resource = await Resource.create(parseResourcePayload(req.body));
    return sendSuccess(res, 201, resource.toJSON());
  } catch (error) {
    return handleResourceWriteError(error, res, 'create');
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
