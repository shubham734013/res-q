/**
 * ResQ — 404 and error handling.
 *
 * The only place that turns a thrown value into a response body. Internal
 * errors are logged with their stack and replied to with a generic message:
 * TDD §14.3 forbids leaking internal detail, and a database error string is
 * exactly the kind of thing that leaks schema and credentials.
 */

import { ApiError } from '../lib/errors.js';
import { isProduction } from '../lib/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
    requestId: req.id,
  });
}

// eslint-disable-next-line no-unused-vars -- Express identifies the error
// handler by its arity; `next` must stay in the signature.
export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
      requestId: req.id,
    });
  }

  // Prisma's known request errors carry useful, safe-ish semantics.
  if (err?.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'That record already exists.' },
      requestId: req.id,
    });
  }
  if (err?.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resource not found.' },
      requestId: req.id,
    });
  }

  console.error(`[${req.id}] ${req.method} ${req.path}`, err);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Please try again.',
      // Never in production. Useful in development, where the stack is already
      // on the developer's own console anyway.
      ...(!isProduction && { details: [{ path: '(server)', message: String(err?.message ?? err) }] }),
    },
    requestId: req.id,
  });
}

/** Wraps an async handler so a rejected promise reaches the error middleware. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
