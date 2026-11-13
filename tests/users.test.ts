import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { buildTestApp, InMemoryUserRepository, validRegistration } from './helpers/fakes';
import { createRequireCompleteProfile } from '../src/middlewares/requireCompleteProfile';
import { errorHandler } from '../src/middlewares/errorHandler';
import { splitGoogleName } from '../src/services/user.service';

const ME = '/api/users/me';
const USERNAME = '/api/users/me/username';

function setup() {
  const ctx = buildTestApp();
  ctx.tokenVerifier
    .register('google', {
      uid: 'u-google',
      email: 'Juan.Rincon@Gmail.com',
      name: 'Juan Rincón López',
      picture: 'https://lh3.googleusercontent.com/a/foto',
      signInProvider: 'google.com',
    })
    .register('password-sin-perfil', { uid: 'u-huerfano', email: 'x@correounivalle.edu.co' });
  return ctx;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** US-02 / US-03: perfil de la sesión y flujo de username obligatorio con Google. */
describe('GET /api/users/me', () => {
  it('en el primer ingreso con Google crea el perfil incompleto con los datos de Google', async () => {
    const { app, userRepository } = setup();

    const res = await request(app).get(ME).set(auth('google'));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Tomamos tus datos de Google. Elige tu nombre de usuario para continuar.');
    expect(res.body.data).toMatchObject({
      uid: 'u-google',
      firstName: 'Juan',
      lastName: 'Rincón López',
      email: 'juan.rincon@gmail.com',
      avatar: 'https://lh3.googleusercontent.com/a/foto',
      provider: 'google',
      username: null,
      profileComplete: false,
    });
    expect(userRepository.users.size).toBe(1);
  });

  it('es idempotente: un segundo ingreso no duplica el perfil', async () => {
    const { app, userRepository } = setup();
    await request(app).get(ME).set(auth('google')).expect(200);
    const res = await request(app).get(ME).set(auth('google'));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Elige tu nombre de usuario para continuar.');
    expect(userRepository.users.size).toBe(1);
  });

  it('devuelve el perfil completo de un usuario registrado manualmente (login, US-03)', async () => {
    const { app, tokenVerifier } = setup();
    const created = await request(app).post('/api/auth/register').send(validRegistration()).expect(201);
    tokenVerifier.register('ana', { uid: created.body.data.uid, signInProvider: 'password' });

    const res = await request(app).get(ME).set(auth('ana'));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Perfil obtenido correctamente');
    expect(res.body.data).toMatchObject({ username: 'Ana_01', profileComplete: true });
  });

  it('responde 404 si una cuenta de correo no tiene perfil (no lo inventa)', async () => {
    const { app, userRepository } = setup();
    const res = await request(app).get(ME).set(auth('password-sin-perfil'));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(userRepository.users.size).toBe(0);
  });
});

describe('POST /api/users/me/username (US-02)', () => {
  it('completa el perfil con un username válido', async () => {
    const { app, userRepository } = setup();
    await request(app).get(ME).set(auth('google')).expect(200);

    const res = await request(app).post(USERNAME).set(auth('google')).send({ username: 'juan.rincon' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ username: 'juan.rincon', profileComplete: true });
    expect(userRepository.usernames.get('juan.rincon')).toBe('u-google');
  });

  it('responde 409 si el username ya lo usa otro estudiante (sin distinguir mayúsculas)', async () => {
    const { app } = setup();
    await request(app).post('/api/auth/register').send(validRegistration()).expect(201);
    await request(app).get(ME).set(auth('google')).expect(200);

    const res = await request(app).post(USERNAME).set(auth('google')).send({ username: 'ANA_01' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USERNAME_TAKEN');
  });

  it('responde 400 con un username de formato inválido y no completa el perfil', async () => {
    const { app, userRepository } = setup();
    await request(app).get(ME).set(auth('google')).expect(200);

    const res = await request(app).post(USERNAME).set(auth('google')).send({ username: 'no vale' });

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('username');
    expect(userRepository.users.get('u-google')?.profileComplete).toBe(false);
  });

  it('no permite elegir un segundo username cuando el perfil ya está completo', async () => {
    const { app } = setup();
    await request(app).get(ME).set(auth('google')).expect(200);
    await request(app).post(USERNAME).set(auth('google')).send({ username: 'juan.rincon' }).expect(200);

    const res = await request(app).post(USERNAME).set(auth('google')).send({ username: 'otro_nombre' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('responde 404 si se intenta completar un perfil que no existe', async () => {
    const { app } = setup();
    const res = await request(app).post(USERNAME).set(auth('password-sin-perfil')).send({ username: 'nuevo_1' });
    expect(res.status).toBe(404);
  });

  it('toma el uid del token: rechaza un uid enviado en el cuerpo', async () => {
    const { app } = setup();
    await request(app).get(ME).set(auth('google')).expect(200);

    const res = await request(app)
      .post(USERNAME)
      .set(auth('google'))
      .send({ username: 'juan.rincon', uid: 'otro-usuario' });

    expect(res.status).toBe(400);
  });

  it('exige sesión (401)', async () => {
    const { app } = setup();
    const res = await request(app).post(USERNAME).send({ username: 'juan.rincon' });
    expect(res.status).toBe(401);
  });
});

describe('Middleware requireCompleteProfile (403 PROFILE_INCOMPLETE)', () => {
  const buildPrivateApp = (repo: InMemoryUserRepository, uid: string) => {
    const app = express();
    app.get(
      '/privada',
      (req, _res, next) => {
        req.auth = { uid, email: null, emailVerified: false, name: null, picture: null, signInProvider: 'google.com' };
        next();
      },
      createRequireCompleteProfile(repo),
      (req, res) => res.json({ username: req.profile?.username })
    );
    app.use(errorHandler);
    return app;
  };

  it('bloquea las rutas privadas mientras falte el username', async () => {
    const repo = new InMemoryUserRepository();
    await repo.createIncompleteProfile({
      uid: 'u1',
      firstName: 'Juan',
      lastName: '',
      email: 'j@gmail.com',
      avatar: null,
      provider: 'google',
    });

    const res = await request(buildPrivateApp(repo, 'u1')).get('/privada');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PROFILE_INCOMPLETE');
  });

  it('deja pasar cuando el perfil está completo', async () => {
    const repo = new InMemoryUserRepository();
    await repo.createIncompleteProfile({
      uid: 'u1',
      firstName: 'Juan',
      lastName: '',
      email: 'j@gmail.com',
      avatar: null,
      provider: 'google',
    });
    await repo.claimUsername('u1', 'juan_ok');

    const res = await request(buildPrivateApp(repo, 'u1')).get('/privada');

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('juan_ok');
  });
});

describe('splitGoogleName', () => {
  it.each([
    ['Juan Rincón López', { firstName: 'Juan', lastName: 'Rincón López' }],
    ['  Ana   María  ', { firstName: 'Ana', lastName: 'María' }],
    ['Steven', { firstName: 'Steven', lastName: '' }],
    [null, { firstName: 'Estudiante', lastName: '' }],
  ])('separa "%s"', (input, expected) => {
    expect(splitGoogleName(input)).toEqual(expected);
  });
});
