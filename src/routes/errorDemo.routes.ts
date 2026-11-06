import { Router, Request, Response, NextFunction } from 'express';
import {
  ValidationError,
  UnauthenticatedError,
  NotFoundError,
} from '../types/errors.types';

const router = Router();

// Demo 400 VALIDATION_ERROR
router.get('/demo-400', (_req: Request, _res: Response, next: NextFunction) => {
  next(
    new ValidationError('Los datos enviados son inválidos. Revise los campos señalados.', {
      email: 'El formato de correo no es válido.',
      username: 'El nombre de usuario no puede contener espacios.',
    })
  );
});

// Demo 401 UNAUTHENTICATED
router.get('/demo-401', (_req: Request, _res: Response, next: NextFunction) => {
  next(new UnauthenticatedError('Debe iniciar sesión para acceder a este recurso.'));
});

// Demo 404 NOT_FOUND
router.get('/demo-404', (_req: Request, _res: Response, next: NextFunction) => {
  next(new NotFoundError('El recurso solicitado no fue encontrado.'));
});

export default router;

