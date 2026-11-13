import { NextFunction, Request, RequestHandler, Response } from 'express';
import { IUserRepository } from '../repositories/interfaces/user.repository.interface';
import { ProfileIncompleteError, UnauthenticatedError } from '../types/errors.types';

/**
 * Debe ir después de `authenticate`. Bloquea con 403 PROFILE_INCOMPLETE las rutas
 * privadas mientras el usuario (p. ej. de Google) no haya elegido username (US-02).
 * Deja el perfil en req.profile.
 */
export function createRequireCompleteProfile(users: IUserRepository): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new UnauthenticatedError());
    try {
      const profile = await users.findById(req.auth.uid);
      if (!profile || !profile.profileComplete) return next(new ProfileIncompleteError());
      req.profile = profile;
      next();
    } catch (error) {
      next(error);
    }
  };
}
