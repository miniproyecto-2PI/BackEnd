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
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  FIRESTORE_COLLECTION_NAME: process.env.FIRESTORE_COLLECTION_NAME || 'system_config',
  FIREBASE: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    serviceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS,
    emulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
  },
};

