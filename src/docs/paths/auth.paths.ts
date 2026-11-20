import { errorRef, jsonBody, successResponse } from '../openapi.helpers';
import { registerSchema } from '../../validators/user.schemas';
import { googleExchangeSchema, loginSchema, refreshSchema } from '../../validators/auth.schemas';

export const TAG_AUTH = 'Autenticación (US-01, US-02, US-03)';

const loginResultRef = { $ref: '#/components/schemas/LoginResult' };
const sessionRef = { $ref: '#/components/schemas/AuthSession' };

const sessionExample = {
  idToken: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
  refreshToken: 'AMf-vBx...',
  expiresIn: 3600,
};

const profileExample = {
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
};

const unauthorized = (message: string) => ({
  description: '401 UNAUTHENTICATED',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/StandardErrorResponse' },
      example: { error: { code: 'UNAUTHENTICATED', message, fields: null } },
    },
  },
});

export const authPaths = {
  '/api/auth/register': {
    post: {
      tags: [TAG_AUTH],
      summary: 'Registro manual de usuario (US-01)',
      description: `Crea la cuenta en **Firebase Authentication** y el perfil completo en **Firestore**, reservando el nombre de usuario en una transacción.
      
- **Importante:** Al registrarse exitosamente, el endpoint **inicia sesión automáticamente** y devuelve el ID token, por lo que el frontend no necesita hacer una segunda petición a \`/login\`.
- La unicidad del username se garantiza en el servidor. Si dos personas lo envían al mismo tiempo, solo una lo obtiene.
- Si falla la escritura del perfil, la cuenta de Auth se elimina para no dejar cuentas a medias.`,
      requestBody: jsonBody(registerSchema, {
        firstName: 'Ana María',
        lastName: 'Pérez Gómez',
        username: 'Ana_01',
        avatar: 'avatar-03',
        email: 'ana.perez@correounivalle.edu.co',
        password: 'Estudio2026',
      }),
      responses: {
        '201': successResponse('Cuenta creada y sesión iniciada', loginResultRef, {
          message: '¡Tu cuenta está lista!',
          data: {
            session: sessionExample,
            profile: {
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
  '/api/auth/login': {
    post: {
      tags: [TAG_AUTH],
      summary: 'Iniciar sesión con correo y contraseña (US-03)',
      description: `La API verifica las credenciales contra **Firebase Authentication** y devuelve la sesión y el perfil en una sola respuesta.
- Guarde \`session.idToken\` y envíelo como \`Authorization: Bearer <idToken>\` en cada ruta 🔒.`,
      requestBody: jsonBody(loginSchema, { email: 'ana.perez@correounivalle.edu.co', password: 'Estudio2026' }),
      responses: {
        '200': successResponse('Sesión iniciada', loginResultRef, {
          message: '¡Hola de nuevo, Ana María!',
          data: { session: sessionExample, profile: profileExample },
        }),
        '400': errorRef('BadRequest'),
        '401': unauthorized('Correo o contraseña incorrectos.'),
        '403': errorRef('Forbidden'),
        '404': errorRef('NotFound'),
        '429': errorRef('TooManyRequests'),
        '503': errorRef('ServiceUnavailable'),
      },
    },
  },
  '/api/auth/refresh': {
    post: {
      tags: [TAG_AUTH],
      summary: 'Renovar el ID token de la sesión',
      description: 'Cambia el `refreshToken` por un idToken nuevo (y un refreshToken que reemplaza al anterior).',
      requestBody: jsonBody(refreshSchema, { refreshToken: 'AMf-vBx...' }),
      responses: {
        '200': successResponse('Sesión renovada', sessionRef, { message: 'Sesión renovada.', data: sessionExample }),
        '400': errorRef('BadRequest'),
        '401': unauthorized('Tu sesión expiró. Inicia sesión de nuevo.'),
        '429': errorRef('TooManyRequests'),
        '503': errorRef('ServiceUnavailable'),
      },
    },
  },
  '/api/auth/logout': {
    post: {
      tags: [TAG_AUTH],
      summary: 'Cerrar sesión 🔒',
      description: 'Invalida todos los refreshTokens del usuario (cierra la sesión en todos sus dispositivos).',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': successResponse('Sesión cerrada', { nullable: true }, { message: 'Cerraste sesión.', data: null }),
        '401': errorRef('Unauthorized'),
        '503': errorRef('ServiceUnavailable'),
      },
    },
  },
  '/api/auth/google': {
    get: {
      tags: [TAG_AUTH],
      summary: 'Iniciar sesión con Google (redirección OAuth 2.0, US-02)',
      description: `**Navegación del navegador, no \`fetch\`**. El frontend hace \`window.location.assign(API + '/api/auth/google?redirect=/salas')\`. Los tokens nunca viajan en la URL.`,
      parameters: [
        {
          name: 'redirect',
          in: 'query',
          required: false,
          description: 'Ruta interna del frontend a la que volver tras el login (debe empezar por "/").',
          schema: { type: 'string', example: '/salas' },
        },
      ],
      responses: {
        '303': { description: 'Redirección a Google' },
        '429': errorRef('TooManyRequests'),
      },
    },
  },
  '/api/auth/google/callback': {
    get: {
      tags: [TAG_AUTH],
      summary: 'Callback de Google (lo llama Google, no el frontend)',
      description: 'Siempre termina en una redirección 303 a `FRONTEND_OAUTH_CALLBACK_URL` con `?code=` o `?error=`.',
      parameters: [
        { name: 'code', in: 'query', schema: { type: 'string' } },
        { name: 'state', in: 'query', schema: { type: 'string' } },
        { name: 'error', in: 'query', schema: { type: 'string', example: 'access_denied' } },
      ],
      responses: {
        '303': { description: 'Redirección al frontend con ?code= o ?error=' },
      },
    },
  },
  '/api/auth/google/exchange': {
    post: {
      tags: [TAG_AUTH],
      summary: 'Canjear el código del callback de Google por la sesión (US-02)',
      description: 'Recibe el `?code=` con el que la API redirigió al frontend. Es de un solo uso y vence en 60 segundos.',
      requestBody: jsonBody(googleExchangeSchema, { code: 'q8Zr2v...' }),
      responses: {
        '200': successResponse('Sesión iniciada con Google', loginResultRef, {
          message: 'Tomamos tus datos de Google. Elige tu nombre de usuario para continuar.',
          data: {
            session: sessionExample,
            profile: {
              ...profileExample,
              firstName: 'Ana',
              lastName: 'Pérez',
              username: null,
              usernameLower: null,
              email: 'ana.perez@gmail.com',
              avatar: 'https://lh3.googleusercontent.com/a/foto',
              provider: 'google',
              profileComplete: false,
            },
          },
        }),
        '400': errorRef('BadRequest'),
        '401': unauthorized('El inicio de sesión con Google expiró. Intenta de nuevo.'),
        '429': errorRef('TooManyRequests'),
      },
    },
  },
};