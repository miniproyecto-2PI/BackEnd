import { Request, Response } from 'express';
import { StandardErrorResponse } from '../types/errors.types';

export const notFoundHandler = (req: Request, res: Response<StandardErrorResponse>): void => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `La ruta solicitada '${req.method} ${req.originalUrl}' no existe en este servidor.`,
      fields: null,
    },
  });
};
