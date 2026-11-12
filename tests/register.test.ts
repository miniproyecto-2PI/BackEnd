import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildTestApp, validRegistration } from './helpers/fakes';

const REGISTER = '/api/auth/register';

/** US-01: registro manual con validación y unicidad de username en el servidor. */
describe('POST /api/auth/register (US-01)', () => {
  it('crea la cuenta de Auth y el perfil completo (201)', async () => {
    const { app, userRepository, identityProvider } = buildTestApp();

    const res = await request(app).post(REGISTER).send(validRegistration());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      success: true,
      message: '¡Tu cuenta está lista!',
      data: {
        firstName: 'Ana María',
        lastName: 'Pérez Gómez',
        username: 'Ana_01',
        usernameLower: 'ana_01',
        email: 'ana.perez@correounivalle.edu.co',
        avatar: 'avatar-03',
        provider: 'password',
        profileComplete: true,
      },
    });
    expect(res.body.data).not.toHaveProperty('password');
    expect(identityProvider.accounts.size).toBe(1);
    expect(userRepository.usernames.get('ana_01')).toBe(res.body.data.uid);
  });

  it('normaliza los datos: recorta nombres y guarda el correo en minúsculas', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post(REGISTER)
      .send(validRegistration({ firstName: '  Ana  ', email: '  ANA.Perez@Correounivalle.edu.co ' }));

    expect(res.status).toBe(201);
    expect(res.body.data.firstName).toBe('Ana');
    expect(res.body.data.email).toBe('ana.perez@correounivalle.edu.co');
  });

  it('señala cada campo inválido con un mensaje que explica cómo corregirlo (400)', async () => {
    const { app, identityProvider } = buildTestApp();

    const res = await request(app).post(REGISTER).send({
      firstName: '',
      username: 'a b',
      avatar: 'no-existe',
      email: 'correo-mal-escrito',
      password: 'corta',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toEqual({
      firstName: 'Escribe tus nombres.',
      lastName: 'Escribe tus apellidos.',
      username:
        'El nombre de usuario debe tener de 3 a 20 caracteres: letras, números, punto o guion bajo, sin espacios.',
      avatar: 'Elige uno de los avatares disponibles.',
      email: 'Escribe un correo válido, por ejemplo nombre@correounivalle.edu.co.',
      password: 'La contraseña debe tener al menos 8 caracteres, una letra y un número.',
    });
    expect(identityProvider.accounts.size).toBe(0); // no crea la cuenta
  });

  it.each([
    ['muy corto', 'ab'],
    ['muy largo', 'a'.repeat(21)],
    ['con espacios', 'ana perez'],
    ['con caracteres no permitidos', 'ana-perez!'],
  ])('rechaza un username %s', async (_label, username) => {
    const { app } = buildTestApp();
    const res = await request(app).post(REGISTER).send(validRegistration({ username }));
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('username');
  });

  it.each([
    ['sin números', 'SoloLetras'],
    ['sin letras', '12345678'],
    ['de menos de 8 caracteres', 'abc123'],
  ])('rechaza una contraseña %s', async (_label, password) => {
    const { app } = buildTestApp();
    const res = await request(app).post(REGISTER).send(validRegistration({ password }));
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('password');
  });

  it('rechaza nombres de más de 50 caracteres', async () => {
    const { app } = buildTestApp();
    const res = await request(app).post(REGISTER).send(validRegistration({ lastName: 'x'.repeat(51) }));
    expect(res.status).toBe(400);
    expect(res.body.error.fields.lastName).toBe('Tus apellidos pueden tener máximo 50 caracteres.');
  });

  it('rechaza campos que no forman parte del registro (p. ej. un uid enviado por el cliente)', async () => {
    const { app } = buildTestApp();
    const res = await request(app).post(REGISTER).send(validRegistration({ uid: 'otro-usuario' }));
    expect(res.status).toBe(400);
    expect(res.body.error.fields.body).toContain('uid');
  });

  it('responde 409 USERNAME_TAKEN sin distinguir mayúsculas (Ana_01 = ana_01)', async () => {
    const { app, identityProvider } = buildTestApp();
    await request(app).post(REGISTER).send(validRegistration()).expect(201);

    const res = await request(app)
      .post(REGISTER)
      .send(validRegistration({ username: 'ana_01', email: 'otra@correounivalle.edu.co' }));

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'USERNAME_TAKEN',
      message: expect.any(String),
      fields: { username: 'Este nombre de usuario ya está en uso, prueba con otro.' },
    });
    expect(identityProvider.accounts.size).toBe(1); // no se creó una segunda cuenta
  });

  it('responde 409 EMAIL_IN_USE si el correo ya tiene cuenta', async () => {
    const { app } = buildTestApp();
    await request(app).post(REGISTER).send(validRegistration()).expect(201);

    const res = await request(app).post(REGISTER).send(validRegistration({ username: 'otro_usuario' }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_IN_USE');
    expect(res.body.error.fields).toHaveProperty('email');
  });

  it('revierte la cuenta de Auth si falla la escritura del perfil (sin cuentas a medias)', async () => {
    const { app, userRepository, identityProvider } = buildTestApp();
    userRepository.failNextProfileWrite = true;

    const res = await request(app).post(REGISTER).send(validRegistration());

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DATABASE_ERROR');
    expect(identityProvider.accounts.size).toBe(0);
    expect(identityProvider.deletedUids).toHaveLength(1);
    expect(userRepository.users.size).toBe(0);
  });

  it('garantiza la unicidad ante dos registros simultáneos con el mismo username', async () => {
    const { app, userRepository, identityProvider } = buildTestApp();

    const [first, second] = await Promise.all([
      request(app).post(REGISTER).send(validRegistration({ username: 'Mismo', email: 'a@correounivalle.edu.co' })),
      request(app).post(REGISTER).send(validRegistration({ username: 'mismo', email: 'b@correounivalle.edu.co' })),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(userRepository.users.size).toBe(1);
    // La cuenta de Auth del registro perdedor se revirtió: solo queda una
    expect(identityProvider.accounts.size).toBe(1);
    expect(identityProvider.deletedUids).toHaveLength(1);
  });
});
