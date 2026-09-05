import { RESPONSE_CODES } from "./common.js";

/**
 * @fileoverview Centralized Error Hierarchy mapped to RESPONSE_CODES.
 */

/**
 * Base Application Error
 * @extends Error
 */
export class AppError extends Error {
  /**
   * @param {string} message - The error message
   * @param {number} status - The HTTP status code
   */
  constructor(message, status) {
    super(message);
    this.status = status;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/** 400 - Bad Request */
export class BadRequestError extends AppError {
  constructor(message = "Bad Request") {
    super(message, RESPONSE_CODES.BAD_REQUEST_CODE);
  }
}

/** 401 - Unauthorized */
export class UnauthorizedError extends AppError {
  constructor(message = "Invalid Credentials Found") {
    super(message, RESPONSE_CODES.UNAUTHORIZED_ERROR_CODE);
  }
}

/** 403 - Forbidden */
export class ForbiddenError extends AppError {
  constructor(message = "Access Forbidden") {
    super(message, RESPONSE_CODES.FORBIDDEN_ERROR_CODE);
  }
}

/** 404 - Not Found */
export class NotFoundError extends AppError {
  constructor(message = "Resource Not Found") {
    super(message, RESPONSE_CODES.NOT_FOUND_ERROR_CODE);
  }
}

/** 405 - Method Not Allowed (Access Error) */
export class MethodNotAllowedError extends AppError {
  constructor(message = "Method Not Allowed") {
    super(message, RESPONSE_CODES.ACCESS_ERROR_CODE);
  }
}

/** 409 - Conflict */
export class ConflictError extends AppError {
  constructor(message = "Resource Conflict Occurred") {
    super(message, RESPONSE_CODES.CONFLICT_ERROR_CODE);
  }
}

/** 422 - Unprocessable Entity */
export class UnprocessableError extends AppError {
  constructor(message = "Validation Failed") {
    super(message, RESPONSE_CODES.UNPROCESSABLE_ERROR_CODE);
  }
}

/** 429 - Rate Limit */
export class RateLimitError extends AppError {
  constructor(message = "Too many requests, please try again later") {
    super(message, RESPONSE_CODES.RATE_LIMIT_ERROR_CODE);
  }
}

/** 500 - Internal Server Error */
export class InternalServerError extends AppError {
  constructor(message = "Internal Server Error") {
    super(message, RESPONSE_CODES.INTERNAL_SERVER_ERROR_CODE);
    this.isOperational = false;
  }
}