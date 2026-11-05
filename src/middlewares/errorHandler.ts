import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/errors.types';
import { ApiResponse } from '../types/archetype.types';
import { env } from '../config/env';

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response<ApiResponse>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const errorCode = isAppError ? err.code : 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'Ocurrió un error inesperado en el servidor';

  console.error(`[Error] [${errorCode}] (${statusCode}): ${message}`);
  if (err.stack && env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message,
    error: {
      code: errorCode,
      message,
      ...(isAppError && err.details ? { details: err.details } : {}),
      ...(env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
    },
    timestamp: new Date().toISOString(),
  });
};

