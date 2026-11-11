import { NextFunction, Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { ChooseUsernameInput } from '../validators/user.schemas';
import { UnauthenticatedError } from '../types/errors.types';
import { sendSuccess } from '../utils/response';

/** Todas las rutas van detrás de `authenticate`: el uid sale SIEMPRE del token, nunca del body. */
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** GET /api/users/me */
  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw new UnauthenticatedError();
      const { profile, created } = await this.userService.getOrCreateMe(req.auth);

      let message = 'Perfil obtenido correctamente';
      if (!profile.profileComplete) {
        message = created
          ? 'Tomamos tus datos de Google. Elige tu nombre de usuario para continuar.'
          : 'Elige tu nombre de usuario para continuar.';
      }
      sendSuccess(res, 200, profile, message);
    } catch (error) {
      next(error);
    }
  };

  /** POST /api/users/me/username */
  chooseUsername = async (
    req: Request<unknown, unknown, ChooseUsernameInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.auth) throw new UnauthenticatedError();
      const profile = await this.userService.chooseUsername(req.auth.uid, req.body.username);
      sendSuccess(res, 200, profile, `¡Bienvenido, ${profile.username}! Tu perfil está completo.`);
    } catch (error) {
      next(error);
    }
  };
}
