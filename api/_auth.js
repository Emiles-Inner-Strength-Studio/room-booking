import { google } from 'googleapis'
import { timingSafeEqual } from 'crypto'

let _cachedClient = null

export async function getCalendarClient() {
  if (_cachedClient) return _cachedClient

  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  const impersonateEmail = process.env.GOOGLE_IMPERSONATE_EMAIL

  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY env var not set')
  if (!impersonateEmail) throw new Error('GOOGLE_IMPERSONATE_EMAIL env var not set')

  const credentials = JSON.parse(Buffer.from(key, 'base64').toString('utf-8'))

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
    subject: impersonateEmail,
  })

  await auth.authorize()

  _cachedClient = google.calendar({ version: 'v3', auth })
  return _cachedClient
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)

export function cors(req, res) {
  const origin = req.headers.origin || ''

  if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  } else if (ALLOWED_ORIGINS.length === 0) {
    // No origins configured — allow all (backwards compat, but warn in logs)
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
  // If origins are configured but this one isn't allowed, no CORS header is set

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
}

/**
 * Simple in-memory rate limiter.
 * Limits are per serverless instance — not globally shared, but provides
 * basic protection against abuse within a single warm instance.
 */
const rateLimitStore = new Map()
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX = 60           // 60 requests per minute per IP

export function rateLimit(req, res) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
  const now = Date.now()

  let entry = rateLimitStore.get(ip)
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry = { windowStart: now, count: 0 }
    rateLimitStore.set(ip, entry)
  }

  entry.count++

  // Periodically clean up stale entries (every 100 requests)
  if (rateLimitStore.size > 1000) {
    for (const [key, val] of rateLimitStore) {
      if (now - val.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitStore.delete(key)
    }
  }

  if (entry.count > RATE_LIMIT_MAX) {
    res.setHeader('Retry-After', '60')
    res.status(429).json({ error: 'Too many requests' })
    return false
  }
  return true
}

/**
 * Validate the API key from the Authorization header.
 * Fails closed — if API_KEY is not configured, all requests are rejected.
 * Returns true if valid, sends 401 and returns false if not.
 */
export function requireAuth(req, res) {
  const apiKey = process.env.API_KEY
  if (!apiKey) {
    console.error('API_KEY env var not set — rejecting all requests')
    res.status(500).json({ error: 'Server misconfigured' })
    return false
  }

  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''

  if (!token || !safeCompare(token, apiKey)) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

/**
 * Timing-safe string comparison to prevent timing attacks on API key.
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
