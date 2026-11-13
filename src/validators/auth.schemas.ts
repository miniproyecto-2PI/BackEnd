import { z } from 'zod';
import { emailField } from './user.schemas';

/**
 * Esquemas de inicio de sesión. La contraseña del login NO aplica las reglas de
 * creación (8 caracteres, letra y número): solo se exige que venga. Así no se revela
 * nada sobre las reglas de la cuenta y el error es siempre "Correo o contraseña incorrectos".
 */

/** POST /api/auth/login (US-03) */
export const loginSchema = z
  .object({
    email: emailField,
    password: z
      .string({ required_error: 'Escribe tu contraseña.' })
      .min(1, 'Escribe tu contraseña.')
      .max(128, 'La contraseña puede tener máximo 128 caracteres.'),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

/** POST /api/auth/refresh */
export const refreshSchema = z
  .object({
    refreshToken: z
      .string({ required_error: 'Falta el token de renovación de la sesión.' })
      .min(1, 'Falta el token de renovación de la sesión.')
      .max(4096, 'El token de renovación no es válido.'),
  })
  .strict();

export type RefreshInput = z.infer<typeof refreshSchema>;

/** POST /api/auth/google/exchange */
export const googleExchangeSchema = z
  .object({
    code: z
      .string({ required_error: 'Falta el código de inicio de sesión con Google.' })
      .min(1, 'Falta el código de inicio de sesión con Google.')
      .max(256, 'El código de inicio de sesión no es válido.'),
  })
  .strict();

export type GoogleExchangeInput = z.infer<typeof googleExchangeSchema>;
