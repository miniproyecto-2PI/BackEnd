import { AppError, FirestoreError } from '../types/errors.types';

/**
 * Convierte cualquier error de Firestore en un AppError seguro para el cliente.
 *
 * - Si ya es un AppError (p. ej. UsernameTakenError lanzado dentro de una
 *   transacción) se devuelve tal cual para conservar su código HTTP.
 * - Clasifica por el código gRPC del SDK (14 UNAVAILABLE, 4 DEADLINE_EXCEEDED,
 *   7 PERMISSION_DENIED, 16 UNAUTHENTICATED, 5 NOT_FOUND).
 * - El detalle técnico solo se registra en el log; la respuesta no lo incluye (TS-05).
 */
export function toFirestoreError(error: unknown, operation: string): AppError {
  if (error instanceof AppError) return error;

  const err = error as { code?: number | string; message?: string };
  const code = err?.code;
  const raw = err?.message ?? String(error);

  console.error(`[Firestore] Falló la operación "${operation}" (código: ${code ?? 'n/a'}): ${raw}`);

  if (code === 14 || code === 4 || code === 'unavailable' || code === 'deadline-exceeded') {
    return new FirestoreError(
      'La base de datos no responde en este momento. Intenta de nuevo en unos minutos.'
    );
  }

  if (code === 7 || code === 16 || code === 'permission-denied' || code === 'unauthenticated') {
    return new FirestoreError(
      'El servidor no tiene acceso a la base de datos en este momento. Intenta de nuevo más tarde.'
    );
  }

  return new FirestoreError('El servicio de base de datos no está disponible temporalmente.');
}
