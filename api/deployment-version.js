import { createHash } from 'crypto'
import { rateLimit, securityHeaders } from './_auth.js'

export default function handler(req, res) {
  securityHeaders(res)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')
  if (!rateLimit(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // VERCEL_URL is unique for every deployment, including a manual redeploy of
  // the same commit. Return only a short hash so deployment details stay private.
  const deploymentIdentity = process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_URL ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    'local-development'
  const version = createHash('sha256').update(deploymentIdentity).digest('hex').slice(0, 16)

  return res.status(200).json({ version })
}
