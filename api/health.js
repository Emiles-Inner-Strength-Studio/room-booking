import { rateLimit, securityHeaders } from './_auth.js'

export default function handler(req, res) {
  securityHeaders(res)
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (!rateLimit(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  res.status(200).json({ ok: true })
}
