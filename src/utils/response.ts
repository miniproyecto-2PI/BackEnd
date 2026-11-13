import { Response } from 'express';
import { ApiResponse } from '../types/archetype.types';

/**
 * Respuesta exitosa con el envoltorio estándar del proyecto:
 * { success: true, message, data, timestamp }
 */
export function sendSuccess<T>(res: Response, status: number, data: T, message: string): void {
  const body: ApiResponse<T> = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
  res.status(status).json(body);
}
