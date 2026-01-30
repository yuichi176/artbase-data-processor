export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    message: string,
    public service: string,
  ) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR')
    this.name = 'ExternalServiceError'
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 500, 'CONFIGURATION_ERROR')
    this.name = 'ConfigurationError'
  }
}
