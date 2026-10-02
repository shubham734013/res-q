/**
 * ResQ — request validation.
 *
 * Replaces req.body / req.query / req.params with the PARSED values, so a
 * handler can never accidentally read an unvalidated field: anything absent
 * from the schema simply does not exist downstream. That is what makes the
 * omission of `role` in RegisterRequest an actual control rather than a comment.
 */

import { ApiError, zodDetails } from '../lib/errors.js';

const run = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw ApiError.validation('Invalid request.', zodDetails(result.error));
  }
  return result.data;
};

export const validateBody = (schema) => (req, _res, next) => {
  try {
    req.body = run(schema, req.body ?? {});
    next();
  } catch (err) {
    next(err);
  }
};

export const validateQuery = (schema) => (req, _res, next) => {
  try {
    // Express 5 makes req.query a getter-only property; assigning to a separate
    // field keeps this working on both 4 and 5.
    req.validatedQuery = run(schema, req.query ?? {});
    next();
  } catch (err) {
    next(err);
  }
};

export const validateParams = (schema) => (req, _res, next) => {
  try {
    req.validatedParams = run(schema, req.params ?? {});
    next();
  } catch (err) {
    next(err);
  }
};
