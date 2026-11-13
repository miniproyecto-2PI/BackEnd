# 🚀 Salón de Estudio Colaborativo en Tiempo Real — Backend API

API REST en **Node.js + TypeScript** (Express), con **arquitectura por capas**, **Firebase Authentication** para verificar sesiones y **Firestore** como base de datos. Se despliega en **Render** con Docker.

Forma parte de una arquitectura de 3 proyectos independientes: `FrontEnd` (Vercel), `BackEnd` (este repositorio) y `backend-realtime` (Socket.IO). **El frontend nunca consulta Firestore directamente**: solo usa Firebase Authentication para iniciar sesión, y todos los datos pasan por esta API.

| Sprint | Historias cubiertas por esta API |
|---|---|
| 0 | TS-00 base técnica (dato leído de Firestore) · TS-05 contrato de errores |
| 1 | TS-01 Firebase Auth y perfiles · US-01 registro manual · US-02 registro con Google · US-03 verificación de sesión · TS-07 pruebas y CI |

---

## 📋 Tabla de contenidos
- [Arquitectura](#-arquitectura)
- [Requisitos](#-requisitos)
- [Estructura](#-estructura)
- [Variables de entorno](#-variables-de-entorno)
- [Ejecución local](#-ejecución-local)
- [Docker](#-docker)
- [Pruebas, lint y CI](#-pruebas-lint-y-ci)
- [Despliegue en Render](#-despliegue-en-render)
- [Swagger](#-swagger--openapi)
- [Endpoints](#-endpoints)
- [Autenticación](#-autenticación)
- [Modelo de datos en Firestore](#-modelo-de-datos-en-firestore)
- [Contrato de errores (TS-05)](#-contrato-de-errores-ts-05)
- [CORS](#-cors)

---

## 🏛️ Arquitectura

```
[ Frontend (React, Vercel) ] ── Firebase Auth SDK ──▶ inicia sesión y obtiene el ID token
          │
          │  HTTP JSON + Authorization: Bearer <ID token>
          ▼
┌─────────────────────────────────────────────┐
│ Rutas y middlewares (src/routes, middlewares)│ ➔ CORS, authenticate (401), validateBody (Zod, 400)
├─────────────────────────────────────────────┤
│ Controladores (src/controllers)              │ ➔ HTTP → servicio → respuesta estándar
├─────────────────────────────────────────────┤
│ Servicios (src/services)                     │ ➔ Reglas de negocio (registro, perfil Google, rollback)
├─────────────────────────────────────────────┤
│ Repositorios (src/repositories)              │ ➔ Firestore con transacciones (unicidad de username)
└─────────────────────────────────────────────┘
          │  Firebase Admin SDK
          ▼
[ Firebase Authentication ]   [ Cloud Firestore ]
```

Las dependencias externas (verificador de tokens, proveedor de identidad y repositorio de usuarios) se inyectan en `createApp()` ([src/container.ts](src/container.ts)). Producción usa Firebase; las pruebas usan dobles en memoria.

---

## 📦 Requisitos

- **Node.js 20** o superior (la imagen Docker y la CI usan Node 20).
- **npm 10** o superior.
- **Docker** (opcional, para ejecutar en contenedor).
- **Proyecto de Firebase** con Firestore y Authentication habilitados (proveedores **Correo/contraseña** y **Google**).

---

## 📂 Estructura

```bash
BackEnd/
├── .github/
│   ├── workflows/ci.yml           # Lint, tipos, build, pruebas y docker build en cada PR
│   └── pull_request_template.md
├── Dockerfile                     # Imagen multi-stage (Node 20 Alpine, usuario sin root)
├── docker-compose.yml             # Levanta la API en local
├── render.yaml                    # Blueprint de Render
├── firebase.json / firestore.rules# Reglas de Firestore: deniegan todo acceso desde clientes
├── eslint.config.mjs · vitest.config.ts · tsconfig.test.json
├── tests/                         # Vitest + Supertest (dobles en memoria, sin Firebase)
└── src/
    ├── app.ts                     # createApp(deps): middlewares, Swagger, rutas
    ├── server.ts                  # Punto de entrada y apagado controlado
    ├── container.ts               # Dependencias inyectables (Firebase en producción)
    ├── config/                    # env.ts, firebase.ts (Auth + Firestore), cors.ts
    ├── constants/avatars.ts       # Catálogo de avatares del registro manual
    ├── controllers/               # archetype, health, auth, user
    ├── docs/                      # Swagger: swagger.ts, components.ts, paths/*.paths.ts
    ├── middlewares/               # authenticate, requireCompleteProfile, validate, errorHandler, notFound
    ├── repositories/              # archetype, user (+ interfaces/)
    ├── routes/                    # index (createApiRouter), auth, users, archetype, health, errorDemo
    ├── services/                  # user.service, identity.provider, token.verifier, image.storage (Cloudinary), archetype
    ├── types/                     # errors, user, archetype, express.d.ts
    ├── utils/                     # response (envoltorio de éxito), firestoreErrors
    └── validators/                # Esquemas Zod (validan la petición Y alimentan Swagger)
```

---

## 🔑 Variables de entorno

Copia la plantilla y completa los valores. El archivo `.env` está en `.gitignore`: **nunca subas credenciales**.

```bash
cp .env.example .env
```

| Variable | Obligatoria | Descripción |
|---|---|---|
| `NODE_ENV` | No | `development` · `production` · `test` |
| `PORT` / `HOST` | No | Por defecto `3000` / `0.0.0.0` (Render inyecta `PORT`) |
| `CORS_ORIGIN` | **Sí en producción** | Orígenes permitidos separados por coma (ver [CORS](#-cors)). Por defecto `http://localhost:5173,http://localhost:8080` |
| `FIRESTORE_COLLECTION_NAME` | No | Colección del dato de la base técnica (por defecto `system_config`) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Una de las opciones | JSON completo de la cuenta de servicio en una línea (**recomendado en Render**) |
| `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` | Una de las opciones | Credenciales por separado |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Una de las opciones | Ruta a un `serviceAccountKey.json` local (ignorado por git) |
| `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST` | No | Emuladores locales de Firebase (no requieren credenciales) |
| `FIREBASE_WEB_API_KEY` | **Sí** (login) | Clave de API Web del proyecto (*Configuración del proyecto → General*). Solo la usa el servidor para `POST /api/auth/login` y `/refresh`. Sin ella → 503 |
| `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` | Para Google | Cliente web OAuth (*Authentication → Sign-in method → Google → Configuración del SDK web*) |
| `GOOGLE_OAUTH_REDIRECT_URI` | Para Google | `https://<api>/api/auth/google/callback`. Debe estar en *URIs de redireccionamiento autorizados* del cliente en Google Cloud Console |
| `FRONTEND_OAUTH_CALLBACK_URL` | Para Google | Página del frontend que recibe `?code=` / `?error=` (por defecto `http://localhost:5173/auth/google/callback`) |
| `CLOUDINARY_URL` | Para subir avatares | `cloudinary://<api_key>:<api_secret>@<cloud_name>` (o `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`). Sin ella, `POST /api/users/me/avatar` responde 503 |
| `CLOUDINARY_AVATAR_FOLDER` | No | Carpeta de los avatares (por defecto `estudiemos/avatars`) |

La cuenta de servicio se genera en *Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada*.

---

## 💻 Ejecución local

```bash
npm install
npm run dev        # recarga automática con tsx en http://localhost:3000
npm run build      # compila a dist/
npm start          # ejecuta dist/server.js
```

Sin credenciales de Firebase la API arranca igual: `/api/health` responde y los endpoints que usan Firestore o Auth responden **503** con un mensaje claro.

---

## 🐳 Docker

```bash
docker compose up --build     # API en http://localhost:3000 (lee .env si existe)
docker compose down
```

O la imagen sola:

```bash
docker build -t backend-api .
docker run -p 3000:3000 --env-file .env backend-api
```

---

## 🧪 Pruebas, lint y CI

```bash
npm test             # Vitest + Supertest (una vez)
npm run test:watch   # modo observación
npm run lint         # ESLint (typescript-eslint)
npm run typecheck    # tipos de src/ y tests/
```

Las pruebas **no necesitan Firebase**: usan dobles en memoria ([tests/helpers/fakes.ts](tests/helpers/fakes.ts)) con la misma semántica que las transacciones de Firestore.

| Archivo | Qué comprueba |
|---|---|
| `tests/auth.middleware.test.ts` | 401 sin token, con token mal formado, alterado o vencido; 503 si Firebase Auth no responde |
| `tests/register.test.ts` | Registro (US-01): 201, validación por campo, 409 username/correo, rollback de Auth y **registro simultáneo con el mismo username** |
| `tests/login.test.ts` | Login, 401 genérico, 429 tras 10 fallos, refresh, logout, flujo OAuth de Google (state anti-CSRF, cancelación, código de un solo uso), redirecciones abiertas |
| `tests/auth.gateway.test.ts` | Traducción de errores de la REST API de Firebase Auth (sin red), emulador, tickets de un solo uso |
| `tests/users.test.ts` | Perfil Google incompleto, elegir username, 403 `PROFILE_INCOMPLETE`, uid tomado del token |
| `tests/contract.test.ts` | Formato TS-05, JSON inválido, health, Swagger sin referencias rotas |
| `tests/cors.test.ts` | Orígenes permitidos y bloqueados, comodín de previews, mismo origen, preflight |
| `tests/avatar.test.ts` | Subida de imagen: formatos, contenido falso, más de 2 MB, sin archivo, 401, 403, 503 de Cloudinary |

**CI:** [.github/workflows/ci.yml](.github/workflows/ci.yml) corre `npm ci`, lint, typecheck, build, pruebas y `docker build` en cada pull request y push a `main`/`develop`.

---

## ☁️ Despliegue en Render

1. *New Web Service* conectado al repositorio `BackEnd`, runtime **Docker** (o usar `render.yaml`).
2. **Health Check Path:** `/api/health`.
3. Variables de entorno (pestaña *Environment*):
   - `NODE_ENV=production`, `HOST=0.0.0.0` (Render asigna `PORT`)
   - `CORS_ORIGIN` = URL del frontend en Vercel, p. ej. `https://estudiemos.vercel.app` (más el patrón de previews si se usan)
   - `FIREBASE_SERVICE_ACCOUNT_KEY` = JSON de la cuenta de servicio
4. Desplegar las reglas de Firestore (una vez, desde esta carpeta): `npx firebase-tools deploy --only firestore:rules --project <id-del-proyecto>`.

---

## 📖 Swagger / OpenAPI

- **Swagger UI:** `/api/docs` (local: <http://localhost:3000/api/docs>). `/docs` y `/api-docs` redirigen aquí.
- **Especificación JSON:** `/api/docs.json`.
- Las rutas con 🔒 requieren token: usa **Authorize** y pega el ID token (sin la palabra `Bearer`).

La especificación es una sola fuente en TypeScript (no se usan comentarios JSDoc):

| Archivo | Contenido |
|---|---|
| `src/docs/swagger.ts` | Ensambla la especificación (info, tags, servidores) |
| `src/docs/components.ts` | Esquemas comunes, respuestas de error estándar (TS-05) y `bearerAuth` |
| `src/docs/paths/*.paths.ts` | Rutas de cada dominio (`auth`, `users`, `system`) |
| `src/docs/openapi.helpers.ts` | `fromZod`, `jsonBody`, `successResponse`, `errorRef` |

Los cuerpos de petición se generan con `fromZod()` desde los esquemas de `src/validators/`, **los mismos que validan la petición real**. Al agregar un endpoint, agrega su ruta en `src/docs/paths/<dominio>.paths.ts`.

---

## 🔌 Endpoints

| Método | Ruta | Auth | Historia | Descripción |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | — | US-01 | Registro manual: crea la cuenta en Auth y el perfil completo en Firestore |
| `POST` | `/api/auth/login` | — | US-03 | Correo y contraseña → `{ session, profile }` (límite: 10 fallos / 15 min por IP y correo) |
| `POST` | `/api/auth/refresh` | — | US-03 | `refreshToken` → sesión nueva (idToken de 1 h) |
| `POST` | `/api/auth/logout` | 🔒 | US-03 | Revoca los refreshTokens del usuario |
| `GET` | `/api/auth/google` | — | US-02 | Navegación: redirige a Google (OAuth 2.0) |
| `GET` | `/api/auth/google/callback` | — | US-02 | Lo llama Google; redirige al frontend con `?code=` o `?error=` |
| `POST` | `/api/auth/google/exchange` | — | US-02 | Canjea el `code` (un solo uso, 60 s) por `{ session, profile }` |
| `GET` | `/api/users/me` | 🔒 | US-02, US-03 | Perfil de la sesión. En el primer ingreso con Google crea el perfil **incompleto** |
| `POST` | `/api/users/me/username` | 🔒 | US-02 | Elegir username y completar el perfil |
| `POST` | `/api/users/me/avatar` | 🔒 | US-01 | Subir imagen de perfil propia (multipart, campo `avatar`; requiere perfil completo) |
| `GET` | `/api/health` | — | TS-00 | Estado de la API y de Firestore (health check de Render) |
| `GET` | `/api/archetype/data` | — | TS-00 | Dato de la base técnica leído de Firestore |
| `POST` | `/api/archetype/seed` | 🔒 | TS-00 | Crea/actualiza el dato de la base técnica |
| `GET` | `/api/errors/demo-{400,401,404}` | — | TS-05 | Demostración del formato de errores |

Las respuestas exitosas usan el envoltorio `{ "success": true, "message": "...", "data": { ... }, "timestamp": "..." }`.

### Reglas de validación (US-01, servidor)

| Campo | Regla |
|---|---|
| `firstName`, `lastName` | Obligatorios, máximo 50 caracteres |
| `username` | 3 a 20 caracteres: letras, números, `.` o `_`, sin espacios. Único **sin distinguir mayúsculas** (`Ana_01` = `ana_01`) |
| `email` | Formato válido; se guarda en minúsculas |
| `password` | Mínimo 8 caracteres, al menos una letra y un número |
| `avatar` | Uno del catálogo `avatar-01` … `avatar-08` ([src/constants/avatars.ts](src/constants/avatars.ts)) |

Campos extra (por ejemplo, un `uid` enviado por el cliente) se rechazan con 400.

### Imagen de perfil propia (Cloudinary)

En el registro se elige un avatar del catálogo (obligatorio). Después de iniciar sesión, la persona puede subir su propia foto con `POST /api/users/me/avatar`:

| Regla | Valor |
|---|---|
| Envío | `multipart/form-data`, un solo archivo en el campo `avatar` |
| Formatos | JPG, PNG o WebP. Se verifica el **contenido real** (primeros bytes), no solo el tipo declarado |
| Tamaño máximo | 2 MB |
| Procesamiento | Recorte a 512×512 centrado en el contenido, WebP, calidad automática |
| Almacenamiento | Cloudinary, `estudiemos/avatars/{uid}` (una imagen por usuario; subir otra la reemplaza) |
| Requisitos | Sesión (401) y perfil completo (403 `PROFILE_INCOMPLETE`) |

El campo `avatar` del perfil queda como URL `https://res.cloudinary.com/...`. El frontend muestra una imagen si `avatar` empieza por `https://` (foto propia o de Google) y, si no, el avatar del catálogo. El `api_secret` de Cloudinary solo vive en el servidor.

---

## 🔐 Autenticación

**El frontend no usa el SDK de Firebase ni Firestore.** Todo el inicio de sesión pasa por la API, que habla con Firebase Authentication desde el servidor (REST API con `FIREBASE_WEB_API_KEY` + Admin SDK).

1. La API entrega una **sesión** `{ idToken, refreshToken, expiresIn }` en `POST /api/auth/login` o `POST /api/auth/google/exchange`.
2. El frontend envía el idToken en cada petición privada: `Authorization: Bearer <idToken>`, y en el handshake de Socket.IO (`auth: { token }`).
3. El idToken dura 1 h. Antes de que venza (o al recibir 401), el frontend llama `POST /api/auth/refresh` con el `refreshToken`; si responde 401, la sesión terminó → `/ingresar`.
4. El middleware [authenticate](src/middlewares/authenticate.ts) verifica el token con Firebase Admin SDK y deja el usuario en `req.auth`. **El uid siempre sale del token**, nunca del cuerpo de la petición. Sin token, o con uno alterado o vencido → **401 `UNAUTHENTICATED`**.
5. [requireCompleteProfile](src/middlewares/requireCompleteProfile.ts) responde **403 `PROFILE_INCOMPLETE`** mientras un usuario de Google no haya elegido username.
6. `POST /api/auth/logout` revoca los refreshTokens; el frontend borra los tokens y desconecta el socket.

**Flujo de registro manual (US-01 → US-03):** `POST /api/auth/register` → 201 → `POST /api/auth/login` con el mismo correo y contraseña → `{ session, profile }`.

**Flujo con Google (US-02), por redirección OAuth 2.0:**

```
Frontend ──window.location──▶ GET /api/auth/google?redirect=/salas
   API: cookie httpOnly con `state` ──303──▶ Google (elige cuenta)
   Google ──303──▶ GET /api/auth/google/callback?code&state
   API: valida state, code → id_token de Google → sesión de Firebase → perfil
   API ──303──▶ FRONTEND_OAUTH_CALLBACK_URL?code=<un solo uso>&redirect=/salas   (o ?error=CÓDIGO)
Frontend ──POST /api/auth/google/exchange { code }──▶ { session, profile }
```

Si `profile.profileComplete` es `false`, se lleva a la persona a elegir username → `POST /api/users/me/username`. Los códigos de `?error=` son `GOOGLE_CANCELLED`, `UNAUTHENTICATED`, `EMAIL_IN_USE`, `FORBIDDEN`, `TOO_MANY_REQUESTS`, `SERVICE_UNAVAILABLE`, `DATABASE_ERROR` e `INTERNAL`; el frontend muestra su propio mensaje para cada uno. Los tokens nunca viajan en la URL. El código de un solo uso vive en memoria (vale para una instancia de Render; con varias, moverlo a Firestore/Redis).

**Configuración en Firebase/Google (una vez):** *Authentication → Comenzar* y habilitar **Correo/contraseña** y **Google** (sin esto Firebase responde `CONFIGURATION_NOT_FOUND` y la API 503). Luego, en Google Cloud Console, agregar `GOOGLE_OAUTH_REDIRECT_URI` a las URIs de redireccionamiento del cliente web.

---

## 🗄️ Modelo de datos en Firestore

| Documento | Campos |
|---|---|
| `users/{uid}` | `firstName`, `lastName`, `username` (o `null`), `usernameLower`, `email`, `avatar`, `provider` (`password` · `google`), `profileComplete`, `createdAt`, `updatedAt` |
| `usernames/{usernameLower}` | `uid`, `username`, `createdAt`. Es la **reserva** que garantiza la unicidad |
| `system_config/sprint-0` | Dato de la base técnica (TS-00) |

El perfil y la reserva del username se escriben en la **misma transacción** con `create()`: si dos personas envían el mismo username al mismo tiempo, solo una lo obtiene y la otra recibe 409. Si falla la escritura del perfil después de crear la cuenta de Auth, la cuenta se elimina (rollback) para no dejar cuentas a medias.

[firestore.rules](firestore.rules) niega todo acceso desde los SDK de cliente. La API usa Admin SDK, que no está sujeto a esas reglas.

---

## 🛡️ Contrato de errores (TS-05)

Todos los errores responden con el mismo formato, en español y sin detalles internos:

```json
{
  "error": {
    "code": "USERNAME_TAKEN",
    "message": "El nombre de usuario ya se encuentra registrado por otro estudiante.",
    "fields": { "username": "Este nombre de usuario ya está en uso, prueba con otro." }
  }
}
```

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Datos inválidos (con `fields` por campo) o JSON mal formado |
| 401 | `UNAUTHENTICATED` | Sin token o token inválido/vencido |
| 403 | `FORBIDDEN` · `PROFILE_INCOMPLETE` | Sin permisos · falta elegir username |
| 404 | `NOT_FOUND` · `ROOM_NOT_FOUND` | Recurso o ruta inexistente |
| 409 | `USERNAME_TAKEN` · `EMAIL_IN_USE` | Username o correo ya en uso |
| 429 | `TOO_MANY_REQUESTS` | Demasiados intentos de login / renovación (cabecera `RateLimit` con la espera) |
| 503 | `DATABASE_ERROR` · `SERVICE_UNAVAILABLE` | Firestore o Firebase Auth no disponibles |
| 500 | `INTERNAL` | Error inesperado |

Los errores 4xx se registran en el log como aviso de una línea; solo los 5xx se registran como error.

---

## 🌐 CORS

`CORS_ORIGIN` es una lista de orígenes **explícitos** separados por coma. El comodín total `*` **no se acepta** (se ignora con una advertencia en el log).

```ini
CORS_ORIGIN=https://estudiemos.vercel.app,https://frontend-*-miniproyecto-2pi.vercel.app
```

- `*` dentro de **un** segmento del host sirve para las previews de Vercel; no abarca puntos (no permite otro dominio).
- Siempre se permiten las peticiones sin `Origin` (curl, Postman, health checks) y las del mismo origen del servidor (Swagger UI).
- Un origen no permitido no recibe `Access-Control-Allow-Origin` y el navegador bloquea la respuesta.
