import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Variables fijas para que las pruebas no dependan del .env local ni toquen Firebase real.
    // dotenv no sobrescribe variables ya definidas (aunque estén vacías).
    env: {
      NODE_ENV: 'test',
      CORS_ORIGIN: 'http://localhost:5173,http://localhost:8080,https://frontend-*-equipo.vercel.app',
      FIREBASE_SERVICE_ACCOUNT_KEY: '',
      FIREBASE_PROJECT_ID: '',
      FIREBASE_CLIENT_EMAIL: '',
      FIREBASE_PRIVATE_KEY: '',
      FIREBASE_SERVICE_ACCOUNT_PATH: '',
      GOOGLE_APPLICATION_CREDENTIALS: '',
      FIRESTORE_EMULATOR_HOST: '',
      FIREBASE_AUTH_EMULATOR_HOST: '',
    },
    // Silencia console.warn/console.error esperados (avisos 4xx, CORS bloqueado)
    silent: 'passed-only',
  },
});
