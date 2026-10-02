import crypto from 'node:crypto';

/**
 * Attaches a request id used in the error envelope and in AuditLog, so a user
 * reporting "it failed" can be traced to one request without logging anything
 * sensitive.
 */
export function requestId(req, res, next) {
  req.id = req.get('x-request-id') ?? `req_${crypto.randomBytes(8).toString('hex')}`;
  res.setHeader('x-request-id', req.id);
  next();
}
