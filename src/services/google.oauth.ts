import { env } from '../config/env';
import { AppError, ServiceUnavailableError, UnauthenticatedError } from '../types/errors.types';

/**
 * OAuth 2.0 de Google (flujo "authorization code" en el servidor). Reemplaza el popup
 * del SDK de Firebase: el navegador va a Google, vuelve al callback de la API y la API
 * cambia el código por el id_token de Google.
 */
export interface GoogleOAuthClient {
  isConfigured(): boolean;
  /** URL pública del callback (la misma registrada en Google Cloud Console). */
  readonly redirectUri: string;
  buildAuthorizationUrl(state: string): string;
  /** Cambia el `code` del callback por el id_token (JWT) de Google. */
  exchangeCode(code: string): Promise<string>;
}

type FetchFn = typeof fetch;

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export class HttpGoogleOAuthClient implements GoogleOAuthClient {
  constructor(
    private readonly clientId: string | undefined = env.GOOGLE_OAUTH.clientId,
    private readonly clientSecret: string | undefined = env.GOOGLE_OAUTH.clientSecret,
    readonly redirectUri: string = env.GOOGLE_OAUTH.redirectUri ?? '',
    private readonly fetchFn: FetchFn = (...args) => fetch(...args)
  ) {}

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  buildAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId ?? '',
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
      access_type: 'online',
    });
    return `${AUTH_ENDPOINT}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<string> {
    if (!this.isConfigured()) throw new ServiceUnavailableError();
    try {
      const res = await this.fetchFn(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.clientId ?? '',
          client_secret: this.clientSecret ?? '',
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => ({}))) as { id_token?: unknown; error?: unknown };

      if (!res.ok || typeof body.id_token !== 'string') {
        if (body.error === 'invalid_grant') {
          throw new UnauthenticatedError('El inicio de sesión con Google expiró. Intenta de nuevo.');
        }
        console.error(`[Auth] Google rechazó el código OAuth (${res.status} ${String(body.error ?? 'sin código')}).`);
        throw new ServiceUnavailableError();
      }
      return body.id_token;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error(`[Auth] No se pudo contactar a Google: ${(error as Error).message}`);
      throw new ServiceUnavailableError();
    }
  }
}
