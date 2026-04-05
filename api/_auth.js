import { google } from 'googleapis'

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

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

/**
 * Validate the API key from the Authorization header.
 * Returns true if valid, sends 401 and returns false if not.
 */
export function requireAuth(req, res) {
  const apiKey = process.env.API_KEY
  if (!apiKey) return true // no key configured = open access (dev mode)

  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''

  if (token !== apiKey) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}
