import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno desde archivo .env si existe
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  HOST: string;
  CORS_ORIGIN: string;
  FIRESTORE_COLLECTION_NAME: string;
  FIREBASE: {
    projectId?: string;
    clientEmail?: string;
    privateKey?: string;
    serviceAccountKey?: string;
    serviceAccountPath?: string;
    emulatorHost?: string;
    authEmulatorHost?: string;
    /**
     * Clave de API Web del proyecto (Configuración del proyecto -> General). Solo vive en el
     * servidor: la usa la API para iniciar sesión con la REST API de Firebase Authentication.
     */
    webApiKey?: string;
  };
  /** OAuth 2.0 de Google para el inicio de sesión por redirección (GET /api/auth/google). */
  GOOGLE_OAUTH: {
    clientId?: string;
    clientSecret?: string;
    /** URL pública del callback de la API, registrada en Google Cloud Console. */
    redirectUri?: string;
  };
  /** Página del frontend que recibe el resultado del ingreso con Google (?code= o ?error=). */
  FRONTEND_OAUTH_CALLBACK_URL: string;
  CLOUDINARY: {
    /** cloudinary://<api_key>:<api_secret>@<cloud_name> (alternativa a las 3 variables) */
    url?: string;
    cloudName?: string;
    apiKey?: string;
    apiSecret?: string;
    /** Carpeta de los avatares en Cloudinary */
    avatarFolder: string;
  };
}

const parsePort = (val?: string): number => {
  const parsed = Number(val);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3000;
};

export const env: EnvConfig = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parsePort(process.env.PORT),
  HOST: process.env.HOST || '0.0.0.0',
  // Lista separada por comas. '*' no se acepta (ver config/cors.ts).
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:8080',
  FIRESTORE_COLLECTION_NAME: process.env.FIRESTORE_COLLECTION_NAME || 'system_config',
  FIREBASE: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    serviceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS,
    emulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
    authEmulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST,
    webApiKey: process.env.FIREBASE_WEB_API_KEY,
  },
  GOOGLE_OAUTH: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
  },
  FRONTEND_OAUTH_CALLBACK_URL:
    process.env.FRONTEND_OAUTH_CALLBACK_URL || 'http://localhost:5173/auth/google/callback',
  CLOUDINARY: {
    url: process.env.CLOUDINARY_URL,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    avatarFolder: process.env.CLOUDINARY_AVATAR_FOLDER || 'estudiemos/avatars',
  },
};

