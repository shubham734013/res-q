/**
 * ResQ — error types and the single error envelope (TDD §8.2).
 *
 * Handlers throw ApiError. The error middleware is the only place that decides
 * what reaches the client, so an internal message cannot leak by accident.
 */

const STATUS_BY_CODE = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_REVOKED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  FACILITY_NOT_FOUND: 404,
  CONFLICT: 409,
  RADIUS_TOO_LARGE: 422,
  LOCATION_REQUIRED: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  /**
   * @param {string} code    one of ERROR_CODES
   * @param {string} message safe to show a user
   * @param {Array<{path:string,message:string}>} [details]
   */
  constructor(code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS_BY_CODE[code] ?? 500;
    this.details = details;
  }

  static unauthorized(message = 'Authentication is required.') {
    return new ApiError('UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have access to this resource.') {
    return new ApiError('FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found.') {
    return new ApiError('NOT_FOUND', message);
  }

  static facilityNotFound(message = 'Healthcare facility not found.') {
    return new ApiError('FACILITY_NOT_FOUND', message);
  }

  static conflict(message = 'That resource already exists.') {
    return new ApiError('CONFLICT', message);
  }

  static validation(message = 'Invalid request.', details) {
    return new ApiError('VALIDATION_ERROR', message, details);
  }
}

/** Shapes a Zod error into the envelope's `details` array. */
export function zodDetails(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}
