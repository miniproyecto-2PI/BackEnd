import { errorRef, jsonBody, successResponse } from '../openapi.helpers';
import { chooseUsernameSchema } from '../../validators/user.schemas';

export const TAG_USERS = 'Usuarios (US-02, US-03)';

const profileRef = { $ref: '#/components/schemas/UserProfile' };
const secured = [{ bearerAuth: [] }];

const googleIncompleteExample = {
  uid: 'Gg7Hh8Ii9Jj0Kk1Ll2Mm3Nn4',
  firstName: 'Juan',
  lastName: 'Rincón López',
  username: null,
  usernameLower: null,
  email: 'juan.rincon@gmail.com',
  avatar: 'https://lh3.googleusercontent.com/a/ejemplo',
  provider: 'google',
  profileComplete: false,
  createdAt: '2026-11-10T15:00:00.000Z',
  updatedAt: '2026-11-10T15:00:00.000Z',
};

export const usersPaths = {
  '/api/users/me': {
    get: {
      tags: [TAG_USERS],
      summary: 'Perfil del usuario de la sesión 🔒',
      description: `Devuelve el perfil del usuario dueño del ID token (el uid sale del token, nunca de la petición).

- **Primer ingreso con Google (US-02):** si el token es de Google y aún no hay perfil, se crea uno **incompleto** (\`profileComplete: false\`, \`username: null\`) con nombre, foto y correo de Google. El frontend debe llevar a la persona a elegir su username.
- **Login (US-03):** el frontend lo llama tras iniciar sesión para decidir a dónde redirigir (panel si \`profileComplete\` es true).
- Sin token o con token vencido/alterado: **401 UNAUTHENTICATED**.`,
      security: secured,
      responses: {
        '200': successResponse('Perfil del usuario', profileRef, {
          message: 'Tomamos tus datos de Google. Elige tu nombre de usuario para continuar.',
          data: googleIncompleteExample,
        }),
        '401': errorRef('Unauthorized'),
        '404': errorRef('NotFound'),
        '503': errorRef('ServiceUnavailable'),
      },
    },
  },

  '/api/users/me/username': {
    post: {
      tags: [TAG_USERS],
      summary: 'Elegir nombre de usuario y completar el perfil (US-02) 🔒',
      description:
        'Reserva el username (misma transacción de unicidad que el registro manual, sin distinguir mayúsculas) y marca el perfil como completo. Solo aplica a perfiles incompletos.',
      security: secured,
      requestBody: jsonBody(chooseUsernameSchema, { username: 'juan.rincon' }),
      responses: {
        '200': successResponse('Perfil completo', profileRef, {
          message: '¡Bienvenido, juan.rincon! Tu perfil está completo.',
          data: {
            ...googleIncompleteExample,
            username: 'juan.rincon',
            usernameLower: 'juan.rincon',
            profileComplete: true,
          },
        }),
        '400': errorRef('BadRequest'),
        '401': errorRef('Unauthorized'),
        '404': errorRef('NotFound'),
        '409': errorRef('Conflict'),
        '503': errorRef('ServiceUnavailable'),
      },
    },
  },
};
