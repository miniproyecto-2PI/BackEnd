import { initializeApp, cert, applicationDefault, getApps, App, AppOptions } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth, Auth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { env } from './env';

/**
 * Inicialización única y perezosa de Firebase Admin SDK (Auth + Firestore).
 *
 * Orden de credenciales:
 *  1. FIREBASE_SERVICE_ACCOUNT_KEY (JSON en una variable; recomendado en Render)
 *  2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *  3. FIREBASE_SERVICE_ACCOUNT_PATH (archivo local, ignorado por git)
 *  4. GOOGLE_APPLICATION_CREDENTIALS (Application Default Credentials)
 *  5. Emuladores (FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST): solo projectId
 */

let firebaseApp: App | null = null;
let dbInstance: Firestore | null = null;
let initError: string | null = null;

function buildAppOptions(): AppOptions | null {
  if (env.FIREBASE.serviceAccountKey) {
    try {
      return { credential: cert(JSON.parse(env.FIREBASE.serviceAccountKey)), projectId: env.FIREBASE.projectId };
    } catch (parseErr) {
      throw new Error(
        `La variable FIREBASE_SERVICE_ACCOUNT_KEY contiene un JSON inválido: ${(parseErr as Error).message}`,
        { cause: parseErr }
      );
    }
  }

  if (env.FIREBASE.projectId && env.FIREBASE.clientEmail && env.FIREBASE.privateKey) {
    return {
      credential: cert({
        projectId: env.FIREBASE.projectId,
        clientEmail: env.FIREBASE.clientEmail,
        privateKey: env.FIREBASE.privateKey,
      }),
      projectId: env.FIREBASE.projectId,
    };
  }

  if (env.FIREBASE.serviceAccountPath) {
    const resolvedPath = path.resolve(process.cwd(), env.FIREBASE.serviceAccountPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`No se encontró el archivo de credenciales de Firebase en la ruta: ${resolvedPath}`);
    }
    const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));
    return { credential: cert(parsed), projectId: env.FIREBASE.projectId };
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return { credential: applicationDefault(), projectId: env.FIREBASE.projectId };
  }

  if (env.FIREBASE.emulatorHost || env.FIREBASE.authEmulatorHost) {
    // Los emuladores no validan credenciales; basta con un projectId (por convención 'demo-*').
    return { projectId: env.FIREBASE.projectId || 'demo-estudiemos' };
  }

  return null;
}

function initializeFirebaseApp(): App | null {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  try {
    const options = buildAppOptions();
    if (!options) {
      initError =
        'No se encontraron credenciales de Firebase configuradas. ' +
        'Defina FIREBASE_SERVICE_ACCOUNT_KEY o FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en las variables de entorno (.env).';
      console.warn(`[Firebase] Advertencia: ${initError}`);
      return null;
    }

    const app = initializeApp(options);
    initError = null;
    console.log('[Firebase] SDK inicializado correctamente.');
    return app;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    initError = `Error al inicializar Firebase Admin: ${message}`;
    console.error(`[Firebase] ${initError}`);
    return null;
  }
}

/** App de Firebase Admin. Lanza un Error si no hay credenciales válidas. */
export const getFirebaseApp = (): App => {
  if (!firebaseApp) firebaseApp = initializeFirebaseApp();
  if (!firebaseApp) {
    throw new Error(
      initError ||
        'Firebase no está disponible. Verifique la configuración de credenciales en las variables de entorno.'
    );
  }
  return firebaseApp;
};

export const getFirestore = (): Firestore => {
  if (!dbInstance) {
    const db = getAdminFirestore(getFirebaseApp());
    db.settings({ ignoreUndefinedProperties: true });
    dbInstance = db;
  }
  return dbInstance;
};

export const getFirebaseAuth = (): Auth => getAdminAuth(getFirebaseApp());

export const isFirebaseInitialized = (): boolean => getApps().length > 0 && firebaseApp !== null;

export const getFirebaseInitError = (): string | null => initError;
