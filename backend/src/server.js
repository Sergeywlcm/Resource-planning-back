import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';

import { connectToDatabase, getDatabaseHealth } from './config/database.js';
import { syncSchema } from './db/syncSchema.js';
import { Allocation } from './models/allocation.model.js';
import { AuditLog } from './models/auditLog.model.js';
import { Project } from './models/project.model.js';
import { Resource } from './models/resource.model.js';
import { UserInvitationToken } from './models/userInvitationToken.model.js';
import { USER_ROLES, USER_STATUSES, User } from './models/user.model.js';
import {
  createSessionToken,
  generateRawToken,
  hashPassword,
  hashToken,
  isValidEmail,
  normalizeEmail,
  validatePassword,
  verifyPassword,
  verifySessionToken
} from './utils/auth.util.js';
import { aggregateProjectDailyWorkload } from './utils/projectDailyWorkload.util.js';
import { aggregateResourceDailyWorkload, normalizeUtcDate } from './utils/resourceDailyWorkload.util.js';
import { buildResourceWorkloadReport } from './utils/resourceWorkloadReport.util.js';
import { expandDateRangeToWeekdays } from './utils/weekdayRange.util.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);
const configuredCorsOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedCorsOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...configuredCorsOrigins
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedCorsOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS origin not allowed: ${origin}`));
  }
}));
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

function getRequestAuditContext(req) {
  return {
    ip_address: req.ip ?? null,
    user_agent: req.get('user-agent') ?? null
  };
}

async function writeAuditLog(req, { actorUserId = null, action, targetUserId = null, metadata = null, result = 'SUCCESS' }) {
  try {
    await AuditLog.create({
      actor_user_id: actorUserId,
      action,
      target_user_id: targetUserId,
      metadata,
      result,
      ...getRequestAuditContext(req)
    });
  } catch (error) {
    console.error(`Audit log write failed: ${error.message}`);
  }
}

function getFrontendBaseUrl() {
  return process.env.FRONTEND_BASE_URL ?? 'http://127.0.0.1:5173';
}

function buildSetupUrl(rawToken) {
  return `${getFrontendBaseUrl()}/?setup_token=${encodeURIComponent(rawToken)}`;
}

function serializeUser(user) {
  const userJson = typeof user.toJSON === 'function' ? user.toJSON() : user;

  return {
    id: userJson.id ?? userJson._id?.toString?.(),
    email: userJson.email,
    role: userJson.role,
    status: userJson.status,
    last_login_at: userJson.last_login_at ?? null,
    created_by_user_id: userJson.created_by_user_id ?? null,
    created_at: userJson.created_at,
    updated_at: userJson.updated_at
  };
}

async function createInvitationForUser(userId) {
  const rawToken = generateRawToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  await UserInvitationToken.updateMany(
    { user_id: userId, used_at: null, expires_at: { $gt: now } },
    { $set: { used_at: now } }
  );

  await UserInvitationToken.create({
    user_id: userId,
    token_hash: hashToken(rawToken),
    expires_at: expiresAt
  });

  return {
    rawToken,
    expires_at: expiresAt,
    setup_url: buildSetupUrl(rawToken)
  };
}

async function requireAdmin(req, res, next) {
  const authHeader = req.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const payload = verifySessionToken(token);

  if (!payload) {
    return sendError(res, 401, 'Authentication required.');
  }

  const user = await User.findById(payload.sub);

  if (!user || user.status !== USER_STATUSES.ACTIVE || user.role !== USER_ROLES.ADMIN) {
    return sendError(res, 403, 'Admin access required.');
  }

  req.user = user;
  next();
}

function parseResourcePayload(body) {
  return {
    name: body?.name,
    capacity_hours: body?.capacity_hours,
    is_active: body?.is_active
  };
}

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function validateResourcePayload(payload, options = {}) {
  const { partial = false } = options;
  const errors = [];

  if (!partial || payload.name !== undefined) {
    if (isBlank(payload.name)) {
      errors.push('Resource name is required.');
    }
  }

  if (payload.capacity_hours !== undefined) {
    const capacityHours = Number(payload.capacity_hours);

    if (!Number.isFinite(capacityHours) || capacityHours < 1 || capacityHours > 24) {
      errors.push('Resource capacity_hours must be a number from 1 to 24.');
    }
  }

  return errors;
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

function parseProjectPayload(body) {
  return {
    name: body?.name,
    is_active: body?.is_active,
    color: body?.color,
    hours_type: body?.hours_type
  };
}

function validateProjectPayload(payload, options = {}) {
  const { partial = false } = options;
  const errors = [];

  if (!partial || payload.name !== undefined) {
    if (isBlank(payload.name)) {
      errors.push('Project name is required.');
    }
  }

  if (payload.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(String(payload.color))) {
    errors.push('Project color must be a valid hex color.');
  }

  if (payload.hours_type !== undefined && !['BILLABLE', 'NON_BILLABLE'].includes(payload.hours_type)) {
    errors.push('Project hours_type must be Billable or Non billable.');
  }

  return errors;
}

function handleProjectWriteError(error, res, actionLabel) {
  if (error instanceof mongoose.Error.ValidationError) {
    return sendError(res, 400, 'Validation failed.', error.message);
  }

  if (error instanceof mongoose.Error.CastError) {
    return sendError(res, 400, 'Invalid project id.', error.message);
  }

  if (error?.code === 11000) {
    return sendError(res, 409, 'Project name must be unique.');
  }

  return sendError(res, 500, `Failed to ${actionLabel} project.`);
}

function parseAllocationPayload(body) {
  return {
    resource_id: body?.resource_id,
    project_id: body?.project_id,
    start_date: body?.start_date,
    end_date: body?.end_date,
    hours_per_day: body?.hours_per_day
  };
}

function validateAllocationPayload(payload, options = {}) {
  const { partial = false } = options;
  const errors = [];

  if (!partial || payload.resource_id !== undefined) {
    if (isBlank(payload.resource_id)) {
      errors.push('Allocation resource_id is required.');
    }
  }

  if (!partial || payload.project_id !== undefined) {
    if (isBlank(payload.project_id)) {
      errors.push('Allocation project_id is required.');
    }
  }

  if (!partial || payload.start_date !== undefined) {
    if (isBlank(payload.start_date)) {
      errors.push('Allocation start_date is required.');
    }
  }

  if (!partial || payload.end_date !== undefined) {
    if (isBlank(payload.end_date)) {
      errors.push('Allocation end_date is required.');
    }
  }

  if (!partial || payload.hours_per_day !== undefined) {
    const hoursPerDay = Number(payload.hours_per_day);

    if (isBlank(payload.hours_per_day) || !Number.isFinite(hoursPerDay) || hoursPerDay <= 0) {
      errors.push('Allocation hours_per_day must be numeric and greater than 0.');
    }
  }

  if (!isBlank(payload.start_date) && !isBlank(payload.end_date)) {
    const startDate = new Date(payload.start_date);
    const endDate = new Date(payload.end_date);

    if (Number.isNaN(startDate.getTime())) {
      errors.push('Allocation start_date must be a valid date.');
    }

    if (Number.isNaN(endDate.getTime())) {
      errors.push('Allocation end_date must be a valid date.');
    }

    if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && startDate > endDate) {
      errors.push('Allocation start_date cannot be after end_date.');
    }
  }

  return errors;
}

function sendValidationErrors(res, errors) {
  return sendError(res, 400, 'Validation failed.', errors);
}

function handleAllocationWriteError(error, res, actionLabel) {
  if (error instanceof mongoose.Error.ValidationError) {
    return sendError(res, 400, 'Validation failed.', error.message);
  }

  if (error instanceof mongoose.Error.CastError) {
    if (error.path === 'resource_id') {
      return sendError(res, 400, 'Invalid allocation resource_id.', error.message);
    }

    if (error.path === 'project_id') {
      return sendError(res, 400, 'Invalid allocation project_id.', error.message);
    }

    if (error.path === 'start_date' || error.path === 'end_date') {
      return sendError(res, 400, `Invalid allocation ${error.path}.`, error.message);
    }

    return sendError(res, 400, 'Invalid allocation id.', error.message);
  }

  return sendError(res, 500, `Failed to ${actionLabel} allocation.`);
}

function parseDateRangeQuery(req, options = {}) {
  const {
    startKey = 'start_date',
    endKey = 'end_date',
    missingMessage = `${startKey} and ${endKey} are required.`,
    orderMessage = `${startKey} must be on or before ${endKey}.`
  } = options;

  const startDateRaw = req.query[startKey];
  const endDateRaw = req.query[endKey];

  if (!startDateRaw || !endDateRaw) {
    throw new Error(missingMessage);
  }

  const startDate = normalizeUtcDate(startDateRaw);
  const endDate = normalizeUtcDate(endDateRaw);

  if (startDate > endDate) {
    throw new Error(orderMessage);
  }

  return { startDate, endDate };
}

function isDateRangeQueryError(message) {
  return message.includes('are required.') || message.includes('must be on or before') || message === 'Invalid date input.';
}

async function handleResourceWorkloadReport(req, res) {
  try {
    const { startDate, endDate } = parseDateRangeQuery(req);

    const allocations = await Allocation.find({
      start_date: { $lte: endDate },
      end_date: { $gte: startDate }
    })
      .populate({ path: 'project_id', select: 'name color hours_type' })
      .sort({ resource_id: 1, start_date: 1, end_date: 1, created_at: 1 })
      .lean();

    const workloadByResource = aggregateResourceDailyWorkload(allocations, startDate, endDate);
    return sendSuccess(res, 200, workloadByResource);
  } catch (error) {
    if (isDateRangeQueryError(error.message)) {
      return sendError(res, 400, error.message);
    }

    return sendError(res, 500, 'Failed to fetch resource workload.');
  }
}



async function handleResourcesWorkload(req, res) {
  try {
    const { startDate, endDate } = parseDateRangeQuery(req, {
      startKey: 'start',
      endKey: 'end',
      missingMessage: 'start and end are required.',
      orderMessage: 'start must be on or before end.'
    });

    const [resources, allocations] = await Promise.all([
      Resource.find().sort({ name: 1, created_at: 1 }).lean(),
      Allocation.find({
        start_date: { $lte: endDate },
        end_date: { $gte: startDate }
      })
        .populate({ path: 'project_id', select: 'name color hours_type' })
        .sort({ resource_id: 1, start_date: 1, end_date: 1, created_at: 1 })
        .lean()
    ]);

    const report = buildResourceWorkloadReport(resources, allocations, startDate, endDate);
    return sendSuccess(res, 200, report);
  } catch (error) {
    if (isDateRangeQueryError(error.message)) {
      return sendError(res, 400, error.message);
    }

    return sendError(res, 500, 'Failed to fetch resources workload.');
  }
}


async function handleProjectWorkloadById(req, res) {
  try {
    const { startDate, endDate } = parseDateRangeQuery(req, {
      startKey: 'start',
      endKey: 'end',
      missingMessage: 'start and end are required.',
      orderMessage: 'start must be on or before end.'
    });
    const { id: projectId } = req.params;

    if (!mongoose.isValidObjectId(projectId)) {
      return sendError(res, 400, 'Invalid project id.');
    }

    const projectExists = await Project.exists({ _id: projectId });

    if (!projectExists) {
      return sendError(res, 404, 'Project not found.');
    }

    const allocations = await Allocation.find({
      project_id: projectId,
      start_date: { $lte: endDate },
      end_date: { $gte: startDate }
    })
      .populate({ path: 'resource_id', select: 'name' })
      .sort({ resource_id: 1, start_date: 1, end_date: 1, created_at: 1 })
      .lean();

    const aggregated = aggregateProjectDailyWorkload(allocations, projectId, startDate, endDate);

    const resources = aggregated.resources.map((resource) => {
      const allocationWithResource = allocations.find((allocation) => {
        const allocationResourceId = typeof allocation.resource_id === 'string'
          ? allocation.resource_id
          : allocation.resource_id?._id?.toString?.() ?? allocation.resource_id?.toString?.();

        return allocationResourceId === resource.resource_id;
      });

      return {
        ...resource,
        resource_name: allocationWithResource?.resource_id?.name ?? null
      };
    });

    return sendSuccess(res, 200, {
      project_id: aggregated.project_id,
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      weekdays: expandDateRangeToWeekdays(startDate, endDate),
      resources,
      daily_totals: aggregated.daily_totals,
      total_planned_hours: aggregated.total_planned_hours
    });
  } catch (error) {
    if (isDateRangeQueryError(error.message)) {
      return sendError(res, 400, error.message);
    }

    return sendError(res, 500, 'Failed to fetch project workload.');
  }
}

async function handleProjectWorkloadReport(req, res) {
  try {
    const { startDate, endDate } = parseDateRangeQuery(req);
    const { project_id: projectId } = req.query;

    if (!projectId) {
      return sendError(res, 400, 'project_id is required.');
    }

    if (!mongoose.isValidObjectId(projectId)) {
      return sendError(res, 400, 'Invalid project id.');
    }

    const projectExists = await Project.exists({ _id: projectId });

    if (!projectExists) {
      return sendError(res, 404, 'Project not found.');
    }

    const allocations = await Allocation.find({
      project_id: projectId,
      start_date: { $lte: endDate },
      end_date: { $gte: startDate }
    })
      .sort({ resource_id: 1, start_date: 1, end_date: 1, created_at: 1 })
      .lean();

    const projectWorkload = aggregateProjectDailyWorkload(allocations, projectId, startDate, endDate);
    return sendSuccess(res, 200, projectWorkload);
  } catch (error) {
    if (isDateRangeQueryError(error.message)) {
      return sendError(res, 400, error.message);
    }

    return sendError(res, 500, 'Failed to fetch project workload.');
  }
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

app.post('/auth/login', async (req, res) => {
  const genericMessage = 'Invalid email or password.';
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  try {
    if (!isValidEmail(email) || typeof password !== 'string') {
      await writeAuditLog(req, {
        action: 'LOGIN_FAILED',
        metadata: { email },
        result: 'FAILURE'
      });
      return sendError(res, 401, genericMessage);
    }

    const user = await User.findOne({ email }).select('+password_hash');

    if (!user || user.status !== USER_STATUSES.ACTIVE || !user.password_hash) {
      await writeAuditLog(req, {
        actorUserId: user?._id ?? null,
        action: 'LOGIN_FAILED',
        targetUserId: user?._id ?? null,
        metadata: { email },
        result: 'FAILURE'
      });
      return sendError(res, 401, genericMessage);
    }

    const passwordMatches = await verifyPassword(password, user.password_hash);

    if (!passwordMatches) {
      await writeAuditLog(req, {
        actorUserId: user._id,
        action: 'LOGIN_FAILED',
        targetUserId: user._id,
        metadata: { email },
        result: 'FAILURE'
      });
      return sendError(res, 401, genericMessage);
    }

    user.last_login_at = new Date();
    await user.save();
    await writeAuditLog(req, {
      actorUserId: user._id,
      action: 'LOGIN_SUCCESS',
      targetUserId: user._id
    });

    return sendSuccess(res, 200, {
      token: createSessionToken(user),
      user: serializeUser(user)
    });
  } catch (_error) {
    return sendError(res, 500, 'Unable to sign in.');
  }
});

app.post('/api/auth/login', (req, res, next) => {
  req.url = '/auth/login';
  app.handle(req, res, next);
});

app.post('/auth/password-setup', async (req, res) => {
  const genericMessage = 'Unable to set password with this invitation.';
  const rawToken = req.body?.token;
  const password = req.body?.password;
  const confirmPassword = req.body?.confirm_password;
  const passwordError = validatePassword(password);

  if (passwordError) {
    return sendError(res, 400, passwordError);
  }

  if (password !== confirmPassword) {
    return sendError(res, 400, 'Password confirmation must match.');
  }

  try {
    const invitation = await UserInvitationToken.findOne({
      token_hash: hashToken(rawToken),
      used_at: null,
      expires_at: { $gt: new Date() }
    });

    if (!invitation) {
      await writeAuditLog(req, {
        action: 'PASSWORD_SETUP_FAILED',
        result: 'FAILURE'
      });
      return sendError(res, 400, genericMessage);
    }

    const user = await User.findById(invitation.user_id).select('+password_hash');

    if (!user || user.status !== USER_STATUSES.PENDING || user.password_hash) {
      await writeAuditLog(req, {
        actorUserId: user?._id ?? null,
        action: 'PASSWORD_SETUP_FAILED',
        targetUserId: user?._id ?? invitation.user_id,
        result: 'FAILURE'
      });
      return sendError(res, 400, genericMessage);
    }

    user.password_hash = await hashPassword(password);
    user.status = USER_STATUSES.ACTIVE;
    user.last_login_at = new Date();
    invitation.used_at = new Date();
    await Promise.all([user.save(), invitation.save()]);

    await writeAuditLog(req, {
      actorUserId: user._id,
      action: 'PASSWORD_SETUP_COMPLETED',
      targetUserId: user._id
    });
    await writeAuditLog(req, {
      actorUserId: user._id,
      action: 'LOGIN_SUCCESS',
      targetUserId: user._id,
      metadata: { reason: 'password_setup' }
    });

    return sendSuccess(res, 200, {
      token: createSessionToken(user),
      user: serializeUser(user)
    });
  } catch (_error) {
    return sendError(res, 500, genericMessage);
  }
});

app.post('/api/auth/password-setup', (req, res, next) => {
  req.url = '/auth/password-setup';
  app.handle(req, res, next);
});

app.post('/auth/logout', requireAdmin, async (req, res) => {
  await writeAuditLog(req, {
    actorUserId: req.user._id,
    action: 'LOGOUT',
    targetUserId: req.user._id
  });

  return sendSuccess(res, 200, { ok: true });
});

app.post('/api/auth/logout', requireAdmin, async (req, res) => {
  await writeAuditLog(req, {
    actorUserId: req.user._id,
    action: 'LOGOUT',
    targetUserId: req.user._id
  });

  return sendSuccess(res, 200, { ok: true });
});

app.use(requireAdmin);

app.get('/auth/me', (req, res) => {
  return sendSuccess(res, 200, serializeUser(req.user));
});

app.get('/api/auth/me', (req, res) => {
  return sendSuccess(res, 200, serializeUser(req.user));
});

app.get('/users', async (_req, res) => {
  try {
    const users = await User.find().sort({ created_at: 1 });
    return sendSuccess(res, 200, users.map(serializeUser));
  } catch (_error) {
    return sendError(res, 500, 'Failed to fetch users.');
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ created_at: 1 });
    return sendSuccess(res, 200, users.map(serializeUser));
  } catch (_error) {
    return sendError(res, 500, 'Failed to fetch users.');
  }
});

app.post('/users', async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!isValidEmail(email)) {
    return sendError(res, 400, 'Valid email is required.');
  }

  try {
    const user = await User.create({
      email,
      role: USER_ROLES.ADMIN,
      status: USER_STATUSES.PENDING,
      created_by_user_id: req.user._id
    });
    const invitation = await createInvitationForUser(user._id);

    await writeAuditLog(req, {
      actorUserId: req.user._id,
      action: 'USER_CREATED',
      targetUserId: user._id,
      metadata: { email, role: USER_ROLES.ADMIN }
    });

    return sendSuccess(res, 201, {
      user: serializeUser(user),
      invitation
    });
  } catch (error) {
    if (error?.code === 11000) {
      return sendError(res, 409, 'A user with this email already exists.');
    }

    if (error instanceof mongoose.Error.ValidationError) {
      return sendError(res, 400, 'Validation failed.', error.message);
    }

    return sendError(res, 500, 'Failed to create user.');
  }
});

app.post('/api/users', (req, res, next) => {
  req.url = '/users';
  app.handle(req, res, next);
});

app.post('/users/:id/resend-invite', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    if (user.status !== USER_STATUSES.PENDING) {
      return sendError(res, 400, 'Only pending users can receive an invite.');
    }

    const invitation = await createInvitationForUser(user._id);
    await writeAuditLog(req, {
      actorUserId: req.user._id,
      action: 'INVITE_RESENT',
      targetUserId: user._id
    });

    return sendSuccess(res, 200, {
      user: serializeUser(user),
      invitation
    });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return sendError(res, 400, 'Invalid user id.', error.message);
    }

    return sendError(res, 500, 'Failed to resend invite.');
  }
});

app.post('/api/users/:id/resend-invite', (req, res, next) => {
  req.url = `/users/${req.params.id}/resend-invite`;
  app.handle(req, res, next);
});

app.post('/users/:id/disable', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    user.status = USER_STATUSES.DISABLED;
    await user.save();
    await writeAuditLog(req, {
      actorUserId: req.user._id,
      action: 'USER_DISABLED',
      targetUserId: user._id
    });

    return sendSuccess(res, 200, serializeUser(user));
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return sendError(res, 400, 'Invalid user id.', error.message);
    }

    return sendError(res, 500, 'Failed to disable user.');
  }
});

app.post('/api/users/:id/disable', (req, res, next) => {
  req.url = `/users/${req.params.id}/disable`;
  app.handle(req, res, next);
});

app.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return sendError(res, 400, 'You cannot remove your own user account.');
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    await UserInvitationToken.updateMany(
      { user_id: user._id, used_at: null },
      { $set: { used_at: new Date() } }
    );
    await writeAuditLog(req, {
      actorUserId: req.user._id,
      action: 'USER_REMOVED',
      targetUserId: user._id,
      metadata: { email: user.email, status: user.status }
    });

    return sendSuccess(res, 200, serializeUser(user));
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return sendError(res, 400, 'Invalid user id.', error.message);
    }

    return sendError(res, 500, 'Failed to remove user.');
  }
});

app.delete('/api/users/:id', (req, res, next) => {
  req.url = `/users/${req.params.id}`;
  app.handle(req, res, next);
});

async function seedInitialAdminUser() {
  const email = normalizeEmail(process.env.INITIAL_ADMIN_EMAIL);

  if (!email) {
    console.warn('INITIAL_ADMIN_EMAIL is not set. No initial Admin user was seeded.');
    return;
  }

  if (!isValidEmail(email)) {
    console.warn('INITIAL_ADMIN_EMAIL is not a valid email. No initial Admin user was seeded.');
    return;
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    if (process.env.INITIAL_ADMIN_PASSWORD && existingUser.status === USER_STATUSES.PENDING) {
      existingUser.password_hash = await hashPassword(process.env.INITIAL_ADMIN_PASSWORD);
      existingUser.status = USER_STATUSES.ACTIVE;
      await existingUser.save();
      await AuditLog.create({
        actor_user_id: null,
        action: 'INITIAL_ADMIN_ACTIVATED',
        target_user_id: existingUser._id,
        metadata: { email },
        result: 'SUCCESS'
      });
    }

    return;
  }

  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const passwordHash = initialPassword ? await hashPassword(initialPassword) : null;
  const user = await User.create({
    email,
    role: USER_ROLES.ADMIN,
    status: passwordHash ? USER_STATUSES.ACTIVE : USER_STATUSES.PENDING,
    password_hash: passwordHash,
    created_by_user_id: null
  });

  let invitation = null;

  if (!passwordHash) {
    invitation = await createInvitationForUser(user._id);
    console.log(`Initial Admin password setup URL: ${invitation.setup_url}`);
  }

  await AuditLog.create({
    actor_user_id: null,
    action: 'INITIAL_ADMIN_SEEDED',
    target_user_id: user._id,
    metadata: {
      email,
      status: user.status,
      setup_url_created: Boolean(invitation)
    },
    result: 'SUCCESS'
  });
}

app.get('/resources', async (_req, res) => {
  try {
    const resources = await Resource.find().sort({ created_at: 1 });
    return sendSuccess(res, 200, resources.map((resource) => resource.toJSON()));
  } catch (_error) {
    return sendError(res, 500, 'Failed to fetch resources.');
  }
});

app.get('/api/resources', async (_req, res) => {
  try {
    const resources = await Resource.find().sort({ created_at: 1 });
    return sendSuccess(res, 200, resources.map((resource) => resource.toJSON()));
  } catch (_error) {
    return sendError(res, 500, 'Failed to fetch resources.');
  }
});

app.get('/resources/workload', handleResourcesWorkload);
app.get('/api/resources/workload', handleResourcesWorkload);

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

app.get('/api/resources/:id', async (req, res) => {
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
    const payload = parseResourcePayload(req.body);
    const validationErrors = validateResourcePayload(payload);

    if (validationErrors.length > 0) {
      return sendValidationErrors(res, validationErrors);
    }

    const resource = await Resource.create(payload);
    return sendSuccess(res, 201, resource.toJSON());
  } catch (error) {
    return handleResourceWriteError(error, res, 'create');
  }
});

app.post('/api/resources', async (req, res) => {
  try {
    const payload = parseResourcePayload(req.body);
    const validationErrors = validateResourcePayload(payload);

    if (validationErrors.length > 0) {
      return sendValidationErrors(res, validationErrors);
    }

    const resource = await Resource.create(payload);
    return sendSuccess(res, 201, resource.toJSON());
  } catch (error) {
    return handleResourceWriteError(error, res, 'create');
  }
});

app.put('/resources/:id', async (req, res) => {
  try {
    const payload = parseResourcePayload(req.body);
    const validationErrors = validateResourcePayload(payload);

    if (validationErrors.length > 0) {
      return sendValidationErrors(res, validationErrors);
    }

    const updatedResource = await Resource.findByIdAndUpdate(
      req.params.id,
      payload,
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

app.put('/api/resources/:id', async (req, res) => {
  try {
    const payload = parseResourcePayload(req.body);
    const validationErrors = validateResourcePayload(payload);

    if (validationErrors.length > 0) {
      return sendValidationErrors(res, validationErrors);
    }

    const updatedResource = await Resource.findByIdAndUpdate(
      req.params.id,
      payload,
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
    const payload = parseResourcePayload(req.body);
    const validationErrors = validateResourcePayload(payload, { partial: true });

    if (validationErrors.length > 0) {
      return sendValidationErrors(res, validationErrors);
    }

    const updatedResource = await Resource.findByIdAndUpdate(
      req.params.id,
      payload,
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

app.get('/projects', async (_req, res) => {
  try {
    const projects = await Project.find().sort({ created_at: 1 });
    return sendSuccess(res, 200, projects.map((project) => project.toJSON()));
  } catch (_error) {
    return sendError(res, 500, 'Failed to fetch projects.');
  }
});

app.get('/api/projects', async (_req, res) => {
  try {
    const projects = await Project.find().sort({ created_at: 1 });
    return sendSuccess(res, 200, projects.map((project) => project.toJSON()));
  } catch (_error) {
    return sendError(res, 500, 'Failed to fetch projects.');
  }
});

app.get('/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return sendError(res, 404, 'Project not found.');
    }

    return sendSuccess(res, 200, project.toJSON());
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return sendError(res, 400, 'Invalid project id.', error.message);
    }

    return sendError(res, 500, 'Failed to fetch project.');
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return sendError(res, 404, 'Project not found.');
    }

    return sendSuccess(res, 200, project.toJSON());
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return sendError(res, 400, 'Invalid project id.', error.message);
    }

    return sendError(res, 500, 'Failed to fetch project.');
  }
});

app.post('/projects', async (req, res) => {
  try {
    const payload = parseProjectPayload(req.body);
    const validationErrors = validateProjectPayload(payload);

    if (validationErrors.length > 0) {
      return sendValidationErrors(res, validationErrors);
    }

    const project = await Project.create(payload);
    return sendSuccess(res, 201, project.toJSON());
  } catch (error) {
    return handleProjectWriteError(error, res, 'create');
  }
});

app.put('/projects/:id', async (req, res) => {
  try {
    const payload = parseProjectPayload(req.body);
    const validationErrors = validateProjectPayload(payload);

    if (validationErrors.length > 0) {
      return sendValidationErrors(res, validationErrors);
    }

    const updatedProject = await Project.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!updatedProject) {
      return sendError(res, 404, 'Project not found.');
    }

    return sendSuccess(res, 200, updatedProject.toJSON());
  } catch (error) {
    return handleProjectWriteError(error, res, 'update');
  }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const payload = parseProjectPayload(req.body);
    const validationErrors = validateProjectPayload(payload);

    if (validationErrors.length > 0) {
      return sendValidationErrors(res, validationErrors);
    }

    const updatedProject = await Project.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!updatedProject) {
      return sendError(res, 404, 'Project not found.');
    }

    return sendSuccess(res, 200, updatedProject.toJSON());
  } catch (error) {
    return handleProjectWriteError(error, res, 'update');
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const payload = parseProjectPayload(req.body);
    const validationErrors = validateProjectPayload(payload);

    if (validationErrors.length > 0) {
      return sendValidationErrors(res, validationErrors);
    }

    const project = await Project.create(payload);
    return sendSuccess(res, 201, project.toJSON());
  } catch (error) {
    return handleProjectWriteError(error, res, 'create');
  }
});

app.patch('/api/projects/:id', async (req, res) => {
  try {
    const payload = parseProjectPayload(req.body);
    const validationErrors = validateProjectPayload(payload, { partial: true });

    if (validationErrors.length > 0) {
      return sendValidationErrors(res, validationErrors);
    }

    const updatedProject = await Project.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!updatedProject) {
      return sendError(res, 404, 'Project not found.');
    }

    return sendSuccess(res, 200, updatedProject.toJSON());
  } catch (error) {
    return handleProjectWriteError(error, res, 'update');
  }
});

app.get('/allocations', async (_req, res) => {
  try {
    const allocations = await Allocation.find().sort({ created_at: 1 });
    return sendSuccess(res, 200, allocations.map((allocation) => allocation.toJSON()));
  } catch (_error) {
    return sendError(res, 500, 'Failed to fetch allocations.');
  }
});

app.get('/api/allocations', async (_req, res) => {
  try {
    const allocations = await Allocation.find().sort({ created_at: 1 });
    return sendSuccess(res, 200, allocations.map((allocation) => allocation.toJSON()));
  } catch (_error) {
    return sendError(res, 500, 'Failed to fetch allocations.');
  }
});

app.get('/reports/resource-workload', handleResourceWorkloadReport);
app.get('/api/reports/resource-workload', handleResourceWorkloadReport);
app.get('/reports/project-workload', handleProjectWorkloadReport);
app.get('/api/reports/project-workload', handleProjectWorkloadReport);
app.get('/projects/:id/workload', handleProjectWorkloadById);
app.get('/api/projects/:id/workload', handleProjectWorkloadById);

app.post('/allocations', async (req, res) => {
  try {
    const payload = parseAllocationPayload(req.body);
    const validationErrors = validateAllocationPayload(payload);

    if (validationErrors.length > 0) {
      return sendValidationErrors(res, validationErrors);
    }

    const allocation = await Allocation.create(payload);
    return sendSuccess(res, 201, allocation.toJSON());
  } catch (error) {
    return handleAllocationWriteError(error, res, 'create');
  }
});

app.post('/api/allocations', async (req, res) => {
  try {
    const payload = parseAllocationPayload(req.body);
    const validationErrors = validateAllocationPayload(payload);

    if (validationErrors.length > 0) {
      return sendValidationErrors(res, validationErrors);
    }

    const allocation = await Allocation.create(payload);
    return sendSuccess(res, 201, allocation.toJSON());
  } catch (error) {
    return handleAllocationWriteError(error, res, 'create');
  }
});

app.put('/allocations/:id', async (req, res) => {
  try {
    const payload = parseAllocationPayload(req.body);
    const validationErrors = validateAllocationPayload(payload);

    if (validationErrors.length > 0) {
      return sendValidationErrors(res, validationErrors);
    }

    const updatedAllocation = await Allocation.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!updatedAllocation) {
      return sendError(res, 404, 'Allocation not found.');
    }

    return sendSuccess(res, 200, updatedAllocation.toJSON());
  } catch (error) {
    return handleAllocationWriteError(error, res, 'update');
  }
});

app.put('/api/allocations/:id', async (req, res) => {
  try {
    const payload = parseAllocationPayload(req.body);
    const validationErrors = validateAllocationPayload(payload);

    if (validationErrors.length > 0) {
      return sendValidationErrors(res, validationErrors);
    }

    const updatedAllocation = await Allocation.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!updatedAllocation) {
      return sendError(res, 404, 'Allocation not found.');
    }

    return sendSuccess(res, 200, updatedAllocation.toJSON());
  } catch (error) {
    return handleAllocationWriteError(error, res, 'update');
  }
});

app.delete('/allocations/:id', async (req, res) => {
  try {
    const deletedAllocation = await Allocation.findByIdAndDelete(req.params.id);

    if (!deletedAllocation) {
      return sendError(res, 404, 'Allocation not found.');
    }

    return sendSuccess(res, 200, deletedAllocation.toJSON());
  } catch (error) {
    return handleAllocationWriteError(error, res, 'delete');
  }
});

app.delete('/api/allocations/:id', async (req, res) => {
  try {
    const deletedAllocation = await Allocation.findByIdAndDelete(req.params.id);

    if (!deletedAllocation) {
      return sendError(res, 404, 'Allocation not found.');
    }

    return sendSuccess(res, 200, deletedAllocation.toJSON());
  } catch (error) {
    return handleAllocationWriteError(error, res, 'delete');
  }
});

async function bootstrap() {
  try {
    await connectToDatabase();
    await syncSchema();
    await seedInitialAdminUser();

    app.listen(port, () => {
      console.log(`Backend running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error(`Startup failed: ${error.message}`);
    process.exit(1);
  }
}

bootstrap();
