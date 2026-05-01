import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);
const PASSWORD_KEY_LENGTH = 64;
const SESSION_TTL_HOURS = 8;

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function safeEqual(a, b) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);

  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12) {
    return 'Password must be at least 12 characters.';
  }

  return '';
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const derivedKey = await scryptAsync(password, salt, PASSWORD_KEY_LENGTH);

  return `scrypt$${salt}$${Buffer.from(derivedKey).toString('base64url')}`;
}

export async function verifyPassword(password, passwordHash) {
  const [scheme, salt, storedHash] = String(passwordHash ?? '').split('$');

  if (scheme !== 'scrypt' || !salt || !storedHash) {
    return false;
  }

  const derivedKey = await scryptAsync(password, salt, PASSWORD_KEY_LENGTH);
  return safeEqual(Buffer.from(derivedKey).toString('base64url'), storedHash);
}

export function generateRawToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function getSessionSecret() {
  return process.env.SESSION_SECRET || 'dev-only-change-me-session-secret';
}

export function createSessionToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id ?? user._id.toString(),
    role: user.role,
    iat: now,
    exp: now + SESSION_TTL_HOURS * 60 * 60
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token) {
  const [encodedPayload, signature] = String(token ?? '').split('.');

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (!payload.sub || !payload.exp || payload.exp <= now) {
      return null;
    }

    return payload;
  } catch (_error) {
    return null;
  }
}
