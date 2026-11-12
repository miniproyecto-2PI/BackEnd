import { errorRef, jsonBody, successResponse } from '../openapi.helpers';
import { registerSchema } from '../../validators/user.schemas';

export const TAG_AUTH = 'Autenticación (US-01, US-03)';

const profileRef = { $ref: '#/components/schemas/UserProfile' };

export const authPaths = {
  '/api/auth/register': {
    post: {
      tags: [TAG_AUTH],
      summary: 'Registro manual de usuario (US-01)',
      description: `Crea la cuenta en **Firebase Authentication** y el perfil completo en **Firestore** (\`users/{uid}\`), reservando el nombre de usuario en \`usernames/{usernameLower}\` dentro de una transacción.

- La unicidad del username se garantiza en el servidor y no distingue mayúsculas (\`Ana_01\` = \`ana_01\`). Si dos personas lo envían al mismo tiempo, solo una lo obtiene.
- Si falla la escritura del perfil, la cuenta de Auth se elimina para no dejar cuentas a medias.
- Tras el 201, el frontend inicia sesión con \`signInWithEmailAndPassword(email, password)\` y obtiene el ID token.

**Reglas:** nombres y apellidos de 1 a 50 caracteres; username de 3 a 20 (letras, números, \`.\` o \`_\`, sin espacios); correo válido; contraseña de al menos 8 caracteres con una letra y un número; avatar del catálogo.`,
      requestBody: jsonBody(registerSchema, {
        firstName: 'Ana María',
        lastName: 'Pérez Gómez',
        username: 'Ana_01',
        avatar: 'avatar-03',
        email: 'ana.perez@correounivalle.edu.co',
        password: 'Estudio2026',
      }),
      responses: {
        '201': successResponse('Cuenta creada', profileRef, {
          message: '¡Tu cuenta está lista!',
          data: {
            uid: 'Xk3P9aBc1dEfGh2IjKlMnOpQ',
            firstName: 'Ana María',
            lastName: 'Pérez Gómez',
            username: 'Ana_01',
            usernameLower: 'ana_01',
            email: 'ana.perez@correounivalle.edu.co',
            avatar: 'avatar-03',
            provider: 'password',
            profileComplete: true,
            createdAt: '2026-11-10T15:00:00.000Z',
            updatedAt: '2026-11-10T15:00:00.000Z',
          },
        }),
        '400': errorRef('BadRequest'),
        '409': {
          description: 'Username ocupado (USERNAME_TAKEN) o correo ya registrado (EMAIL_IN_USE)',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StandardErrorResponse' },
              examples: {
                USERNAME_TAKEN: {
                  value: {
                    error: {
                      code: 'USERNAME_TAKEN',
                      message: 'El nombre de usuario ya se encuentra registrado por otro estudiante.',
                      fields: { username: 'Este nombre de usuario ya está en uso, prueba con otro.' },
                    },
                  },
                },
                EMAIL_IN_USE: {
                  value: {
                    error: {
                      code: 'EMAIL_IN_USE',
                      message: 'Este correo ya tiene una cuenta. ¿Quieres iniciar sesión?',
                      fields: { email: 'Este correo ya tiene una cuenta. ¿Quieres iniciar sesión?' },
                    },
                  },
                },
              },
            },
          },
        },
        '503': errorRef('ServiceUnavailable'),
      },
    },
  },
};
