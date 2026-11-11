import { z } from 'zod';
import { AVATAR_IDS } from '../constants/avatars';

/**
 * Reglas de validación del backlog (US-01, US-02, US-04). El frontend debe aplicar
 * los mismos límites, pero el servidor es la fuente de verdad.
 */

export const USERNAME_REGEX = /^[A-Za-z0-9._]+$/;

const USERNAME_MSG =
  'El nombre de usuario debe tener de 3 a 20 caracteres: letras, números, punto o guion bajo, sin espacios.';
const PASSWORD_MSG = 'La contraseña debe tener al menos 8 caracteres, una letra y un número.';

export const usernameField = z
  .string({ required_error: 'Escribe un nombre de usuario.' })
  .trim()
  .min(3, USERNAME_MSG)
  .max(20, USERNAME_MSG)
  .regex(USERNAME_REGEX, USERNAME_MSG);

const nameField = (label: string) =>
  z
    .string({ required_error: `Escribe tus ${label}.` })
    .trim()
    .min(1, `Escribe tus ${label}.`)
    .max(50, `Tus ${label} pueden tener máximo 50 caracteres.`);

export const emailField = z
  .string({ required_error: 'Escribe tu correo.' })
  .trim()
  .toLowerCase()
  .max(254, 'El correo es demasiado largo.')
  .email('Escribe un correo válido, por ejemplo nombre@correounivalle.edu.co.');

// La contraseña NO se recorta (los espacios son caracteres válidos)
export const passwordField = z
  .string({ required_error: 'Escribe una contraseña.' })
  .min(8, PASSWORD_MSG)
  .max(128, 'La contraseña puede tener máximo 128 caracteres.')
  .regex(/[A-Za-z]/, PASSWORD_MSG)
  .regex(/[0-9]/, PASSWORD_MSG);

/** POST /api/auth/register (US-01) */
export const registerSchema = z
  .object({
    firstName: nameField('nombres'),
    lastName: nameField('apellidos'),
    username: usernameField,
    avatar: z.enum(AVATAR_IDS, {
      errorMap: (issue) => ({
        message:
          issue.code === 'invalid_type' ? 'Elige un avatar.' : 'Elige uno de los avatares disponibles.',
      }),
    }),
    email: emailField,
    password: passwordField,
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;

/** POST /api/users/me/username (US-02: elegir username tras el ingreso con Google) */
export const chooseUsernameSchema = z.object({ username: usernameField }).strict();

export type ChooseUsernameInput = z.infer<typeof chooseUsernameSchema>;
