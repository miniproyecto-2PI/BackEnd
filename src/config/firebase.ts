import { initializeApp, cert, applicationDefault, getApps, App } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { env } from './env';

let dbInstance: Firestore | null = null;
let initError: string | null = null;

function initializeFirebase(): Firestore | null {
  const currentApps = getApps();
  if (currentApps.length > 0) {
    return getAdminFirestore(currentApps[0]);
  }

  try {
    let credential;

    // 1. Caso: JSON directo en variable de entorno (Ideal para Render)
    if (env.FIREBASE.serviceAccountKey) {
      try {
        const parsedKey = JSON.parse(env.FIREBASE.serviceAccountKey);
        credential = cert(parsedKey);
      } catch (parseErr) {
        throw new Error(
          `La variable FIREBASE_SERVICE_ACCOUNT_KEY contiene un JSON inválido: ${(parseErr as Error).message}`
        );
      }
    }
    // 2. Caso: Variables individuales de credencial
    else if (
      env.FIREBASE.projectId &&
      env.FIREBASE.clientEmail &&
      env.FIREBASE.privateKey
    ) {
      credential = cert({
        projectId: env.FIREBASE.projectId,
        clientEmail: env.FIREBASE.clientEmail,
        privateKey: env.FIREBASE.privateKey,
      });
    }
    // 3. Caso: Ruta hacia archivo JSON local
    else if (env.FIREBASE.serviceAccountPath) {
      const resolvedPath = path.resolve(process.cwd(), env.FIREBASE.serviceAccountPath);
      if (fs.existsSync(resolvedPath)) {
        const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
        const parsed = JSON.parse(fileContent);
        credential = cert(parsed);
      } else {
        throw new Error(
          `No se encontró el archivo de credenciales de Firebase en la ruta: ${resolvedPath}`
        );
      }
    }
    // 4. Caso: Application Default Credentials (si está en GCP) o emulador
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE.emulatorHost) {
      credential = applicationDefault();
    } else {
      initError =
        'No se encontraron credenciales de Firebase configuradas. ' +
        'Por favor defina FIREBASE_SERVICE_ACCOUNT_KEY o FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en las variables de entorno (.env).';
      console.warn(`[Firebase] Advertencia: ${initError}`);
      return null;
    }

    const app: App = initializeApp({
      credential,
      projectId: env.FIREBASE.projectId,
    });

    const firestore = getAdminFirestore(app);

    // Ajustar configuración de Firestore
    firestore.settings({
      ignoreUndefinedProperties: true,
    });

    console.log('[Firebase] SDK inicializado correctamente.');
    return firestore;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    initError = `Error al inicializar Firebase Admin: ${message}`;
    console.error(`[Firebase] ${initError}`);
    return null;
  }
}

export const getFirestore = (): Firestore => {
  if (!dbInstance) {
    dbInstance = initializeFirebase();
  }

  if (!dbInstance) {
    throw new Error(
      initError ||
        'Firestore no está disponible. Verifique la configuración de credenciales de Firebase en las variables de entorno.'
    );
  }

  return dbInstance;
};

export const isFirebaseInitialized = (): boolean => {
  return getApps().length > 0 && dbInstance !== null;
};

export const getFirebaseInitError = (): string | null => {
  return initError;
};
