import { Request, Response, NextFunction } from 'express';
import { AppError, StandardErrorResponse } from '../types/errors.types';
import { env } from '../config/env';

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response<StandardErrorResponse>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  // Cuerpo JSON mal formado (lo lanza express.json antes de llegar a las rutas)
  if ((err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'El cuerpo de la petición no es un JSON válido.',
        fields: null,
      },
    });
    return;
  }

  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const errorCode = isAppError ? err.code : 'INTERNAL';

  // Mensaje en español sin detalles internos del servidor
  const message = isAppError
    ? err.message
    : 'Ha ocurrido un error inesperado en el servidor. Por favor intente más tarde.';

  const fields = isAppError ? err.fields || null : null;

  // Registrar error internamente en consola
  console.error(`[Error] [${errorCode}] (${statusCode}): ${err.message}`);
  if (err.stack && env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Respuesta uniforme según TS-05: { error: { code, message, fields } }
  res.status(statusCode).json({
    error: {
      code: errorCode,
      message,
      fields,
    },
  });
};
