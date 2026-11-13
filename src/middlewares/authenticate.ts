import { NextFunction, Request, RequestHandler, Response } from 'express';
import { TokenVerifier } from '../services/token.verifier';
import { AppError, UnauthenticatedError } from '../types/errors.types';

/**
 * Exige `Authorization: Bearer <ID token de Firebase>` y deja el usuario en req.auth.
 * Responde 401 UNAUTHENTICATED si falta, está mal formado, venció o fue alterado.
 */
export function createAuthenticate(verifier: TokenVerifier): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.get('authorization')?.trim();
    if (!header) return next(new UnauthenticatedError());

    const [scheme, token, ...rest] = header.split(/\s+/);
    if (scheme.toLowerCase() !== 'bearer' || !token || rest.length > 0) {
      return next(new UnauthenticatedError());
    }

    try {
      req.auth = await verifier.verifyIdToken(token);
      next();
    } catch (error) {
      next(error instanceof AppError ? error : new UnauthenticatedError());
    }
  };
}
