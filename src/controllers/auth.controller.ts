import { NextFunction, Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { RegisterInput } from '../validators/user.schemas';
import { sendSuccess } from '../utils/response';

export class AuthController {
  constructor(private readonly userService: UserService) {}

  /** POST /api/auth/register — el body ya llega validado por validateBody(registerSchema). */
  register = async (
    req: Request<unknown, unknown, RegisterInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const profile = await this.userService.register(req.body);
      sendSuccess(res, 201, profile, '¡Tu cuenta está lista!');
    } catch (error) {
      next(error);
    }
  };
}
