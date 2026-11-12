import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildTestApp } from './helpers/fakes';
import { toFirestoreError } from '../src/utils/firestoreErrors';
import { FirestoreError, UsernameTakenError } from '../src/types/errors.types';
import { swaggerSpec } from '../src/docs/swagger';

/** Verifica { error: { code, message, fields } } donde fields es null o un objeto. */
const expectErrorShape = (body: { error?: Record<string, unknown> }, code: string) => {
  expect(body.error).toMatchObject({ code, message: expect.any(String) });
  expect(body.error).toHaveProperty('fields');
  const { fields } = body.error as { fields: unknown };
  expect(fields === null || typeof fields === 'object').toBe(true);
};

/** TS-05: todos los errores responden { error: { code, message, fields } }. */
describe('Contrato estándar de errores (TS-05)', () => {
  const { app } = buildTestApp();

  it('404 NOT_FOUND para rutas inexistentes', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String), fields: null },
    });
  });

  it.each([
    ['/api/errors/demo-400', 400, 'VALIDATION_ERROR'],
    ['/api/errors/demo-401', 401, 'UNAUTHENTICATED'],
    ['/api/errors/demo-404', 404, 'NOT_FOUND'],
  ])('%s responde %i %s con el formato estándar', async (path, status, code) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(status);
    expectErrorShape(res.body, code);
  });

  it('400 VALIDATION_ERROR (no 500) cuando el cuerpo no es JSON válido', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"mal formado"');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('el health check responde aunque Firestore no esté configurado', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'UP', service: 'backend-api' });
  });
});

describe('toFirestoreError', () => {
  it('conserva los AppError lanzados dentro de una transacción', () => {
    const original = new UsernameTakenError();
    expect(toFirestoreError(original, 'crear el perfil')).toBe(original);
  });

  it.each([14, 7, 5, 'unavailable', undefined])(
    'convierte el código %s en 503 DATABASE_ERROR sin exponer detalles internos',
    (code) => {
      const result = toFirestoreError({ code, message: 'detalle interno de gRPC' }, 'leer');
      expect(result).toBeInstanceOf(FirestoreError);
      expect(result.statusCode).toBe(503);
      expect(result.message).not.toContain('gRPC');
      expect(result.fields).toBeNull();
    }
  );
});

describe('Especificación Swagger', () => {
  it('documenta los endpoints de usuarios con el esquema de seguridad bearer', () => {
    expect(Object.keys(swaggerSpec.paths)).toEqual(
      expect.arrayContaining(['/api/auth/register', '/api/users/me', '/api/users/me/username'])
    );
    expect(swaggerSpec.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
  });

  it('no tiene referencias $ref rotas', () => {
    const refs = new Set<string>();
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
          if (key === '$ref' && typeof value === 'string') refs.add(value);
          else walk(value);
        }
      }
    };
    walk(swaggerSpec);

    const components = swaggerSpec.components as unknown as Record<string, Record<string, unknown>>;
    const broken = [...refs].filter((ref) => {
      const [, , section, name] = ref.split('/');
      return !components[section]?.[name];
    });
    expect(broken).toEqual([]);
  });
});
