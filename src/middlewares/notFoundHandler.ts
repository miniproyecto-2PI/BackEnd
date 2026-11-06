import { Request, Response } from 'express';
import { ApiResponse } from '../types/archetype.types';

export const notFoundHandler = (req: Request, res: Response<ApiResponse>): void => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `El endpoint especificado '${req.originalUrl}' no existe en esta API. Consulte la documentación Swagger en /api-docs`,
    },
    timestamp: new Date().toISOString(),
  });
};

