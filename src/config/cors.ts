import { Request } from 'express';
import { CorsOptions, CorsOptionsDelegate } from 'cors';

/**
 * Política CORS restringida.
 *
 * - CORS_ORIGIN es una lista separada por comas de orígenes exactos
 *   (ej: https://estudiemos.vercel.app) o patrones con comodín en UN segmento
 *   del host (ej: https://frontend-*-miniproyecto-2pi.vercel.app) para previews.
 * - El comodín total '*' NO se acepta: se ignora y se registra una advertencia.
 * - Se permiten siempre: peticiones sin cabecera Origin (curl, Postman, health
 *   checks) y peticiones del mismo origen del servidor (Swagger UI "Try it out").
 */

export const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
export const ALLOWED_HEADERS = ['Content-Type', 'Authorization'];

export interface AllowedOrigins {
  exact: Set<string>;
  patterns: RegExp[];
}

const escapeRegex = (value: string): string => value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

const normalize = (origin: string): string => origin.trim().replace(/\/+$/, '').toLowerCase();

export function parseAllowedOrigins(raw: string | undefined): AllowedOrigins {
  const exact = new Set<string>();
  const patterns: RegExp[] = [];

  for (const entry of (raw ?? '').split(',')) {
    const value = normalize(entry);
    if (!value) continue;

    if (value === '*') {
      console.warn(
        "[CORS] Se ignoró el valor '*' en CORS_ORIGIN: defina explícitamente los orígenes permitidos."
      );
      continue;
    }

    if (value.includes('*')) {
      // Cada '*' equivale a un segmento de host (letras, números y guiones), nunca a un punto.
      const regex = new RegExp(`^${value.split('*').map(escapeRegex).join('[a-z0-9-]+')}$`);
      patterns.push(regex);
    } else {
      exact.add(value);
    }
  }

  return { exact, patterns };
}

export function isListedOrigin(origin: string, allowed: AllowedOrigins): boolean {
  const value = normalize(origin);
  return allowed.exact.has(value) || allowed.patterns.some((p) => p.test(value));
}

function isSameOrigin(origin: string, req: Request): boolean {
  const host = req.get('host');
  if (!host) return false;
  return normalize(origin) === normalize(`${req.protocol}://${host}`);
}

/**
 * Crea el delegado de CORS para Express. Requiere `app.set('trust proxy', 1)`
 * detrás del proxy de Render para que `req.protocol` sea https.
 */
export function createCorsDelegate(allowed: AllowedOrigins): CorsOptionsDelegate<Request> {
  return (req, callback) => {
    const origin = req.get('origin');
    const base: CorsOptions = {
      credentials: true,
      methods: ALLOWED_METHODS,
      allowedHeaders: ALLOWED_HEADERS,
    };

    if (!origin || isSameOrigin(origin, req) || isListedOrigin(origin, allowed)) {
      return callback(null, { ...base, origin: true });
    }

    console.warn(`[CORS] Origen no permitido bloqueado: ${origin}`);
    return callback(null, { ...base, origin: false });
  };
}
