/**
 * Version header middleware for the v1 API namespace.
 *
 * Stamps every response through the v1 router with `X-API-Version: v1`
 * so clients can introspect which contract they are talking to — useful
 * when the same base URL later serves v2 responses.
 *
 * @module server/routes/v1/middleware/versionHeader
 */

import type { Request, Response, NextFunction } from 'express'

/**
 * Adds `X-API-Version: v1` to every response that passes through it.
 * Mounted at the top of the v1 sub-router so the header is set regardless
 * of whether the downstream handler succeeds or errors.
 */
export function versionHeader(req: Request, res: Response, next: NextFunction): void {
  res.set('X-API-Version', 'v1')
  next()
}
