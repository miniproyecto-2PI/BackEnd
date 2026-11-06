export interface ErrorPayload {
  code: string;
  message: string;
  fields?: Record<string, string> | null;
}

export interface StandardErrorResponse {
  error: ErrorPayload;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly fields?: Record<string, string> | null;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL',
    fields?: Record<string, string> | null
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields || null;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 400 - Error de Validación
export class ValidationError extends AppError {
  constructor(
    message = 'Los datos enviados son inválidos. Revise los campos señalados.',
    fields?: Record<string, string>
  ) {
    super(message, 400, 'VALIDATION_ERROR', fields);
  }
}

// 401 - No Autenticado
export class UnauthenticatedError extends AppError {
  constructor(message = 'Debe iniciar sesión para acceder a este recurso.') {
    super(message, 401, 'UNAUTHENTICATED');
  }
}

// 403 - Prohibido / Perfil Incompleto
export class ForbiddenError extends AppError {
  constructor(message = 'No tiene permisos para realizar esta acción.') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ProfileIncompleteError extends AppError {
  constructor(
    message = 'Debe completar su perfil y elegir un nombre de usuario antes de continuar.'
  ) {
    super(message, 403, 'PROFILE_INCOMPLETE');
  }
}

// 404 - No Encontrado
export class NotFoundError extends AppError {
  constructor(message = 'El recurso solicitado no fue encontrado.') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class RoomNotFoundError extends AppError {
  constructor(message = 'La sala de estudio solicitada no existe o fue eliminada.') {
    super(message, 404, 'ROOM_NOT_FOUND');
  }
}

// 409 - Conflicto de Unicidad
export class UsernameTakenError extends AppError {
  constructor(
    message = 'El nombre de usuario ya se encuentra registrado por otro estudiante.',
    field = 'username'
  ) {
    super(message, 409, 'USERNAME_TAKEN', { [field]: 'Este nombre de usuario no está disponible.' });
  }
}

export class EmailInUseError extends AppError {
  constructor(
    message = 'El correo electrónico ya está registrado con otra cuenta.',
    field = 'email'
  ) {
    super(message, 409, 'EMAIL_IN_USE', { [field]: 'Este correo ya tiene una cuenta asociada.' });
  }
}

// 503 / 500 - Base de Datos / Interno
export class FirestoreError extends AppError {
  constructor(
    message = 'El servicio de base de datos no está disponible temporalmente.',
    fields?: Record<string, string> | null
  ) {
    super(message, 503, 'DATABASE_ERROR', fields);
  }
}

export class InternalError extends AppError {
  constructor(message = 'Ha ocurrido un error inesperado en el servidor.') {
    super(message, 500, 'INTERNAL');
  }
}
