import { randomBytes, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { RegisterInput } from '../validators/user.schemas';
import { GoogleExchangeInput, LoginInput, RefreshInput } from '../validators/auth.schemas';
import { AppError, UnauthenticatedError } from '../types/errors.types';
import { sendSuccess } from '../utils/response';

/** Cookie que ata el `state` de OAuth al navegador que inició el flujo (anti-CSRF). */
export const OAUTH_STATE_COOKIE = 'estudiemos_oauth_state';
const OAUTH_COOKIE_PATH = '/api/auth/google';
const OAUTH_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

export interface AuthControllerOptions {
  /** Página del frontend que recibe ?code= o ?error= tras el ingreso con Google. */
  frontendCallbackUrl: string;
  /** Cookie `Secure` (true en producción, detrás de HTTPS). */
  secureCookies: boolean;
}

/**
 * Ruta interna del frontend a la que volver tras el login (`/salas/abc`). Solo rutas
 * relativas: nada de `//otro-sitio.com` ni URLs absolutas (evita redirecciones abiertas).
 */
export function safeRedirectPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 300) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null;
  return value;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly options: AuthControllerOptions
  ) {}

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

  /** POST /api/auth/login */
  login = async (req: Request<unknown, unknown, LoginInput>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.login(req.body.email, req.body.password);
      const message = result.profile.profileComplete
        ? `¡Hola de nuevo, ${result.profile.firstName}!`
        : 'Elige tu nombre de usuario para continuar.';
      sendSuccess(res, 200, result, message);
    } catch (error) {
      next(error);
    }
  };

  /** POST /api/auth/refresh */
  refresh = async (req: Request<unknown, unknown, RefreshInput>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const session = await this.authService.refresh(req.body.refreshToken);
      sendSuccess(res, 200, session, 'Sesión renovada.');
    } catch (error) {
      next(error);
    }
  };

  /** POST /api/auth/logout (con Bearer) */
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw new UnauthenticatedError();
      await this.authService.logout(req.auth.uid);
      sendSuccess(res, 200, null, 'Cerraste sesión.');
    } catch (error) {
      next(error);
    }
  };

  /** GET /api/auth/google?redirect=/ruta — navegación del navegador, no fetch. */
  googleStart = (req: Request, res: Response): void => {
    if (!this.authService.isGoogleConfigured()) {
      console.error('[Auth] Ingreso con Google sin configurar (GOOGLE_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI).');
      res.redirect(303, this.frontendUrl({ error: 'SERVICE_UNAVAILABLE' }));
      return;
    }

    const state = randomBytes(24).toString('base64url');
    const redirect = safeRedirectPath(req.query.redirect) ?? '';
    res.cookie(OAUTH_STATE_COOKIE, `${state}.${Buffer.from(redirect).toString('base64url')}`, {
      httpOnly: true,
      secure: this.options.secureCookies,
      sameSite: 'lax', // se envía en la vuelta desde Google (navegación de primer nivel)
      path: OAUTH_COOKIE_PATH,
      maxAge: OAUTH_COOKIE_MAX_AGE_MS,
    });
    res.redirect(303, this.authService.googleAuthorizationUrl(state));
  };

  /** GET /api/auth/google/callback?code&state — Google redirige aquí. */
  googleCallback = async (req: Request, res: Response): Promise<void> => {
    const cookie = readCookie(req, OAUTH_STATE_COOKIE);
    res.clearCookie(OAUTH_STATE_COOKIE, {
      httpOnly: true,
      secure: this.options.secureCookies,
      sameSite: 'lax',
      path: OAUTH_COOKIE_PATH,
    });

    const [expectedState, encodedRedirect = ''] = (cookie ?? '').split('.');
    const redirect = safeRedirectPath(Buffer.from(encodedRedirect, 'base64url').toString('utf8'));
    const { code, state, error } = req.query;

    if (typeof error === 'string') {
      const reason = error === 'access_denied' ? 'GOOGLE_CANCELLED' : 'UNAUTHENTICATED';
      console.warn(`[Aviso] [OAuth] Google devolvió error=${error}`);
      res.redirect(303, this.frontendUrl({ error: reason, redirect }));
      return;
    }

    if (!expectedState || typeof state !== 'string' || !sameString(state, expectedState) || typeof code !== 'string') {
      console.warn('[Aviso] [OAuth] Callback de Google sin state válido o sin código.');
      res.redirect(303, this.frontendUrl({ error: 'UNAUTHENTICATED', redirect }));
      return;
    }

    try {
      const ticket = await this.authService.completeGoogleLogin(code);
      res.redirect(303, this.frontendUrl({ code: ticket, redirect }));
    } catch (err) {
      const reason = err instanceof AppError ? err.code : 'INTERNAL';
      if (err instanceof AppError && err.statusCode < 500) {
        console.warn(`[Aviso] [OAuth] [${reason}]: ${err.message}`);
      } else {
        console.error(`[Error] [OAuth] [${reason}]: ${(err as Error).message}`);
      }
      res.redirect(303, this.frontendUrl({ error: reason, redirect }));
    }
  };

  /** POST /api/auth/google/exchange — el frontend canjea el ?code= del callback. */
  googleExchange = async (
    req: Request<unknown, unknown, GoogleExchangeInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.authService.exchangeGoogleTicket(req.body.code);
      const message = result.profile.profileComplete
        ? `¡Hola de nuevo, ${result.profile.firstName}!`
        : 'Tomamos tus datos de Google. Elige tu nombre de usuario para continuar.';
      sendSuccess(res, 200, result, message);
    } catch (error) {
      next(error);
    }
  };

  private frontendUrl(params: Record<string, string | null>): string {
    const url = new URL(this.options.frontendCallbackUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
    return url.toString();
  }
}
