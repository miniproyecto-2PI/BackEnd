import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp } from './helpers/fakes';
import { isListedOrigin, parseAllowedOrigins } from '../src/config/cors';

// CORS_ORIGIN de prueba (vitest.config.ts):
// http://localhost:5173, http://localhost:8080 y https://frontend-*-equipo.vercel.app
describe('CORS restringido', () => {
  const { app } = buildTestApp();
  const ACAO = 'access-control-allow-origin';

  it('permite un origen de la lista', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:8080');
    expect(res.headers[ACAO]).toBe('http://localhost:8080');
  });

  it('bloquea un origen que no está en la lista (sin cabecera Access-Control-Allow-Origin)', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://sitio-malicioso.example');
    expect(res.headers[ACAO]).toBeUndefined();
  });

  it('permite las previews de Vercel con comodín acotado a un segmento', async () => {
    const ok = await request(app).get('/api/health').set('Origin', 'https://frontend-abc123-equipo.vercel.app');
    expect(ok.headers[ACAO]).toBe('https://frontend-abc123-equipo.vercel.app');

    // El comodín no puede abarcar puntos (otro dominio)
    const bad = await request(app).get('/api/health').set('Origin', 'https://frontend-x.evil-equipo.vercel.app');
    expect(bad.headers[ACAO]).toBeUndefined();
  });

  it('permite el mismo origen del servidor (Swagger UI)', async () => {
    const res = await request(app).get('/api/health').set('Host', 'api.ejemplo.com').set('Origin', 'http://api.ejemplo.com');
    expect(res.headers[ACAO]).toBe('http://api.ejemplo.com');
  });

  it('permite peticiones sin Origin (curl, Postman, health checks)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('responde el preflight con PATCH y DELETE habilitados', async () => {
    const res = await request(app)
      .options('/api/users/me')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'PATCH');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
    expect(res.headers['access-control-allow-methods']).toContain('DELETE');
  });
});

describe('parseAllowedOrigins', () => {
  it("ignora el comodín total '*' y avisa en el log", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const allowed = parseAllowedOrigins('*');
    expect(allowed.exact.size).toBe(0);
    expect(allowed.patterns).toHaveLength(0);
    expect(isListedOrigin('https://cualquiera.com', allowed)).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('normaliza mayúsculas, espacios y barra final', () => {
    const allowed = parseAllowedOrigins(' https://Estudiemos.vercel.app/ , ');
    expect(isListedOrigin('https://estudiemos.vercel.app', allowed)).toBe(true);
  });
});
