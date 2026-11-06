# 🚀 Salón de Estudio Colaborativo en Tiempo Real — Backend API

Backend REST desarrollado en **Node.js** con **TypeScript**, estructurado bajo una **arquitectura por capas** (Rutas, Lógica de Negocio y Acceso a Datos) y conectado a **Google Cloud Firestore**. 

Este proyecto corresponde a la base técnica del **Sprint 0 (TS-00)** para el MiniProyecto 2. Está diseñado para ejecutarse localmente, en contenedores con **Docker / Docker Compose** y desplegarse automáticamente en **Render**.

---

## 📋 Tabla de Contenidos
- [Arquitectura del Proyecto](#-arquitectura-del-proyecto)
- [Requisitos Previos](#-requisitos-previos)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Configuración de Variables de Entorno](#-configuración-de-variables-de-entorno)
- [Ejecución en Desarrollo Local](#-ejecución-en-desarrollo-local)
- [Ejecución con Docker y Docker Compose](#-ejecución-con-docker-y-docker-compose)
- [Despliegue en Render](#-despliegue-en-render)
- [Documentación Interactiva (Swagger / OpenAPI)](#-documentación-interactiva-swagger--openapi)
- [Endpoints Principales (TS-00)](#-endpoints-principales-ts-00)
- [Manejo de Errores](#-manejo-de-errores)

---

## 🏛️ Arquitectura del Proyecto

El backend implementa una **Arquitectura en Capas** que garantiza la separación de responsabilidades y la mantenibilidad requerida por el proyecto:

```
[ Cliente Web / Frontend ]
          │ (HTTP / JSON)
          ▼
┌────────────────────────────────────────┐
│ Capa de Presentación / Rutas           │ ➔ Valida peticiones HTTP y enruta
│ (src/routes, src/controllers)          │
└──────────────────┬─────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────┐
│ Capa de Lógica de Negocio              │ ➔ Orquesta reglas y flujos del sistema
│ (src/services)                         │
└──────────────────┬─────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────┐
│ Capa de Acceso a Datos / Repositorio   │ ➔ Comunicación directa con Firestore
│ (src/repositories)                     │
└──────────────────┬─────────────────────┘
                   │
                   ▼
       [ Google Cloud Firestore ]
```

1. **Rutas (`src/routes`)**: Definen los endpoints HTTP y asocian las anotaciones OpenAPI / Swagger.
2. **Controladores (`src/controllers`)**: Reciben las peticiones, extraen parámetros y delegan la ejecución al servicio correspondiente.
3. **Servicios (`src/services`)**: Contienen la lógica de negocio, validaciones y orquestación.
4. **Repositorios (`src/repositories`)**: Abstraen la persistencia y encapsulan las consultas a Firestore usando Firebase Admin SDK.
5. **Manejador de Errores Global (`src/middlewares/errorHandler.ts`)**: Captura cualquier excepción y responde con mensajes legibles y estructurados.

---

## 📦 Requisitos Previos

- **Node.js**: Versión 20 LTS o superior (v22 / v24 recomendada).
- **npm**: Versión 10 o superior.
- **Docker & Docker Compose** (opcional para ejecución en contenedores).
- **Proyecto de Firebase**: Con Firestore habilitado en modo producción o prueba.

---

## 📂 Estructura del Directorio

```bash
BackEnd/
├── .dockerignore
├── .env.example              # Plantilla de variables de entorno (sin credenciales)
├── .gitignore                # Reglas estrictas para ignorar node_modules y secretos
├── Dockerfile                # Imagen multi-stage optimizada para producción
├── docker-compose.yml        # Orquestación de servicios en contenedores
├── render.yaml               # Blueprint de infraestructura como código para Render
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── app.ts                # Configuración de Express, middlewares y Swagger
    ├── server.ts             # Punto de entrada y manejo de apagado controlado
    ├── config/
    │   ├── env.ts            # Tipado y validación de variables de entorno
    │   └── firebase.ts       # Inicialización resiliente de Firebase Admin y Firestore
    ├── controllers/
    │   ├── archetype.controller.ts
    │   └── health.controller.ts
    ├── docs/
    │   └── swagger.ts        # Configuración de Swagger JSDoc
    ├── middlewares/
    │   ├── errorHandler.ts   # Manejador centralizado de errores
    │   └── notFoundHandler.ts
    ├── repositories/
    │   ├── archetype.repository.ts
    │   └── interfaces/
    │       └── archetype.repository.interface.ts
    ├── routes/
    │   ├── archetype.routes.ts
    │   ├── health.routes.ts
    │   └── index.ts
    ├── services/
    │   └── archetype.service.ts
    └── types/
        ├── archetype.types.ts
        └── errors.types.ts
```

---

## 🔑 Configuración de Variables de Entorno

Copie el archivo de plantilla `.env.example` para crear su archivo local `.env`:

```bash
cp .env.example .env
```

Edite `.env` con las configuraciones correspondientes:

```ini
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
CORS_ORIGIN=*
FIRESTORE_COLLECTION_NAME=system_config
```

### Configuración de Credenciales de Firebase

Existen tres formas soportadas:

1. **Opción 1 (Recomendada para Render y Docker)**:
   Pegar todo el contenido del JSON de la cuenta de servicio como un solo string en `FIREBASE_SERVICE_ACCOUNT_KEY`:
   ```ini
   FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"..."}
   ```

2. **Opción 2 (Variables individuales)**:
   ```ini
   FIREBASE_PROJECT_ID=tu-proyecto-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-proyecto-id.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="<tu-clave-privada>"
   ```

3. **Opción 3 (Archivo local para desarrollo)**:
   Descargar el archivo `.json` de cuenta de servicio de Firebase Console y configurar:
   ```ini
   FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
   ```

> ⚠️ **Importante**: El archivo `.gitignore` ya se encuentra configurado para impedir que `.env`, `node_modules/` o cualquier archivo de clave privada `*serviceAccountKey*.json` se suban al repositorio.

---

## 💻 Ejecución en Desarrollo Local

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Iniciar en modo desarrollo (con recarga automática)**:
   ```bash
   npm run dev
   ```

3. **Compilar TypeScript para producción**:
   ```bash
   npm run build
   ```

4. **Iniciar en modo producción (código compilado en `dist/`)**:
   ```bash
   npm start
   ```

---

## 🐳 Ejecución con Docker y Docker Compose

### Levantar con Docker Compose
```bash
docker-compose up --build
```
El servicio estará disponible en `http://localhost:3000`.

### Construir y correr imagen individual con Docker
```bash
# Construir la imagen
docker build -t backend-api .

# Ejecutar el contenedor pasando las variables de entorno
docker run -p 3000:3000 --env-file .env --name salon-estudio-api backend-api
```

---

## ☁️ Despliegue en Render

El backend está preparado para desplegarse como un **Web Service con entorno Docker** en Render:

1. Ingrese a [Render Dashboard](https://dashboard.render.com/).
2. Cree un **New Web Service** conectado a su repositorio de GitHub (`BackEnd`).
3. Seleccione la opción de runtime **Docker**.
4. Configure las variables de entorno en la pestaña **Environment**:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render lo inyecta automáticamente)
   - `HOST`: `0.0.0.0`
   - `CORS_ORIGIN`: La URL de su frontend en Vercel (ej: `https://salon-estudio.vercel.app` o `*`)
   - `FIREBASE_SERVICE_ACCOUNT_KEY`: Pegue el JSON completo de su cuenta de servicio de Firebase.
5. Inicie el despliegue. Render utilizará el `Dockerfile` multi-stage para construir la imagen y verificar la ruta de salud `/api/health`.

---

## 📖 Documentación Interactiva (Swagger / OpenAPI)

Una vez iniciado el servidor, acceda a la documentación interactiva en su navegador:

- **Swagger UI**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- **Especificación OpenAPI (JSON)**: [http://localhost:3000/api-docs.json](http://localhost:3000/api-docs.json)

---

## 🔌 Endpoints Principales (TS-00)

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/` | Información general de la API y enlaces a la documentación |
| `GET` | `/api/health` | Estado del servicio y diagnóstico de conectividad a Firestore |
| `GET` | `/api/archetype/data` | **Endpoint TS-00**: Lee el documento de configuración desde Firestore |
| `POST` | `/api/archetype/seed` | Inicializa o actualiza los datos de prueba en Firestore para comprobar persistencia |

### Ejemplo de Respuesta Exitosa (`GET /api/archetype/data`)

```json
{
  "success": true,
  "message": "Dato leído exitosamente desde Firestore",
  "data": {
    "id": "sprint-0",
    "projectName": "Salón de Estudio Colaborativo en Tiempo Real",
    "sprint": "Sprint 0: Fundamentación UX y Base Técnica End-to-End",
    "version": "1.0.0",
    "description": "Base técnica operativa y comunicada con Firestore para el Sprint 0 (TS-00).",
    "databaseStatus": "connected",
    "environment": "production",
    "updatedAt": "2026-11-05T17:30:00.000Z",
    "features": [
      "Arquitectura por capas (Rutas, Lógica y Acceso a Datos)",
      "Lectura y persistencia con Firebase Firestore",
      "Contenedorización con Docker y Docker Compose",
      "Despliegue automatizado en Render",
      "Documentación interactiva con Swagger OpenAPI",
      "Manejo estandarizado y claro de errores de red/base de datos"
    ]
  },
  "timestamp": "2026-11-05T17:30:00.000Z"
}
```

---

## 🛡️ Manejo de Errores

Si Firestore no se encuentra configurado, no responde o las credenciales son inválidas, la API intercepta la falla y responde con un código de estado adecuado (`503 Service Unavailable` o `500`) y un cuerpo JSON con mensaje amigable:

```json
{
  "success": false,
  "message": "El servicio de Firestore no se encuentra disponible temporalmente o la red no responde.",
  "error": {
    "code": "FIRESTORE_ERROR",
    "message": "Permisos insuficientes o base de datos inaccesible",
    "details": { ... }
  },
  "timestamp": "2026-11-05T17:30:00.000Z"
}
```

