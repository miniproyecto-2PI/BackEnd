import { NextFunction, Request, Response } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { TooManyRequestsError } from '../types/errors.types';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const tooMany = (message: string) => (_req: Request, _res: Response, next: NextFunction) =>
  next(new TooManyRequestsError(message));

/**
 * Límite de intentos FALLIDOS de login por IP + correo (los exitosos no cuentan).
 * Además de frenar fuerza bruta, evita que Firebase bloquee la IP del servidor, que
 * ahora es quien hace todos los inicios de sesión. Clave por correo para no castigar
 * a todo un salón que comparte la misma IP pública.
 */
export function createLoginRateLimit(limit = 10): RateLimitRequestHandler {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      return `${req.ip}|${email}`;
    },
    handler: tooMany('Hiciste demasiados intentos de inicio de sesión. Espera 15 minutos e intenta de nuevo.'),
  });
}

/** Límite general por IP para renovar sesión y para el flujo de Google. */
export function createAuthRateLimit(limit = 100): RateLimitRequestHandler {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: tooMany('Hiciste demasiadas solicitudes. Espera unos minutos e intenta de nuevo.'),
  });
}
