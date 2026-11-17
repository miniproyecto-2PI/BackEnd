import { errorRef, jsonBody, successResponse } from '../openapi.helpers';
import { chooseUsernameSchema, updateProfileSchema } from '../../validators/user.schemas';

// Actualizamos la etiqueta para reflejar el Sprint 2
export const TAG_USERS = 'Usuarios (US-02, US-03, US-04, US-05)';

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
    // NUEVO: US-04 Editar Perfil
    patch: {
      tags: [TAG_USERS],
      summary: 'Editar perfil del usuario (US-04) 🔒',
      description: `Actualiza los datos del perfil del usuario autenticado (el uid sale del token).

- **Reglas de validación:** mismas reglas que el registro (US-01).
- **Username:** si se cambia, se valida la unicidad en el servidor. Si ya está ocupado, responde **409 USERNAME_TAKEN**.
- **Correo:** solo se puede modificar si la cuenta es manual (email/contraseña). Si la cuenta es de Google, responde **400 VALIDATION_ERROR**.
- **Campos omitidos:** los campos que no se envíen en el body no se modifican.`,
      security: secured,
      requestBody: jsonBody(updateProfileSchema, {
        firstName: 'Juan David',
        lastName: 'Rincón',
        username: 'juan.rincon',
        avatar: 'avatar-05',
      }),
      responses: {
        '200': successResponse('Perfil actualizado', profileRef, {
          message: 'Tus cambios se guardaron correctamente.',
          data: {
            ...googleIncompleteExample,
            username: 'juan.rincon',
            usernameLower: 'juan.rincon',
            profileComplete: true,
            provider: 'password',
          },
        }),
        '400': {
          description: 'Datos inválidos o intento de cambiar correo en cuenta de Google (VALIDATION_ERROR)',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StandardErrorResponse' },
              example: {
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Las cuentas de Google no pueden cambiar el correo.',
                  fields: { email: 'Tu correo está gestionado por Google.' },
                },
              },
            },
          },
        },
        '401': errorRef('Unauthorized'),
        '404': errorRef('NotFound'),
        '409': errorRef('Conflict'),
        '503': errorRef('ServiceUnavailable'),
      },
    },
    // NUEVO: US-05 Eliminar Cuenta
    delete: {
      tags: [TAG_USERS],
      summary: 'Eliminar cuenta permanentemente (US-05) 🔒',
      description: `Borra el perfil de Firestore, libera el username en la colección \`usernames\` y elimina la cuenta de Firebase Authentication.

- **Irreversible:** El usuario es redirigido al login y su sesión se invalida.
- **Datos asociados:** Se aplica la política de datos del equipo (las salas creadas se borran o se anonimizan según corresponda).
- **Idempotente:** Si el perfil ya fue eliminado, responde 200 (no lanza error).`,
      security: secured,
      responses: {
        '200': {
          description: 'Cuenta eliminada permanentemente.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Tu cuenta fue eliminada permanentemente.' },
                  data: { type: 'object', nullable: true, example: null },
                },
              },
            },
          },
        },
        '401': errorRef('Unauthorized'),
        '404': errorRef('NotFound'),
        '503': errorRef('ServiceUnavailable'),
      },
    },
  },

  '/api/users/me/avatar': {
    post: {
      tags: [TAG_USERS],
      summary: 'Subir imagen de perfil propia 🔒',
      description: `Sube una foto de perfil y reemplaza \`avatar\` por la URL pública de la imagen (CDN de Cloudinary).

- **Formato:** JPG, PNG o WebP (se verifica el contenido real del archivo, no solo la extensión).
- **Tamaño máximo:** 2 MB. Un solo archivo en el campo \`avatar\` de un \`multipart/form-data\`.
- **Procesamiento:** se recorta a 512×512 (centrado en el contenido) y se guarda en WebP. Cada usuario tiene una sola imagen: subir otra reemplaza la anterior.
- Requiere **perfil completo** (403 \`PROFILE_INCOMPLETE\` si falta elegir username).

El campo \`avatar\` del perfil puede ser un id del catálogo (\`avatar-03\`) o una URL \`https://…\`: el frontend muestra la imagen si empieza por \`https://\`.`,
      security: secured,
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['avatar'],
              properties: {
                avatar: { type: 'string', format: 'binary', description: 'Imagen JPG, PNG o WebP de máximo 2 MB' },
              },
            },
          },
        },
      },
      responses: {
        '200': successResponse('Imagen actualizada', profileRef, {
          message: 'Tu foto de perfil se actualizó.',
          data: {
            ...googleIncompleteExample,
            username: 'juan.rincon',
            usernameLower: 'juan.rincon',
            profileComplete: true,
            avatar: 'https://res.cloudinary.com/demo/image/upload/v1731400000/estudiemos/avatars/Gg7Hh8Ii9Jj0Kk1Ll2Mm3Nn4.webp',
          },
        }),
        '400': {
          description: 'Sin archivo, formato no permitido o más de 2 MB (VALIDATION_ERROR)',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StandardErrorResponse' },
              example: {
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Los datos enviados son inválidos. Revise los campos señalados.',
                  fields: { avatar: 'La imagen debe pesar máximo 2 MB.' },
                },
              },
            },
          },
        },
        '401': errorRef('Unauthorized'),
        '403': errorRef('Forbidden'),
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