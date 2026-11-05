export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class FirestoreError extends AppError {
  constructor(message: string, details?: unknown) {
    super(
      message || 'Error de comunicación o consulta en Firestore.',
      503,
      'FIRESTORE_ERROR',
      details
    );
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Parámetros de entrada inválidos', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

