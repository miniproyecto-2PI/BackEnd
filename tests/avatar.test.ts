import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildTestApp, validRegistration } from './helpers/fakes';
import { AVATAR_MAX_BYTES, detectImageType } from '../src/middlewares/uploadAvatar';

const AVATAR = '/api/users/me/avatar';

// Cabeceras reales ("magic numbers") de cada formato, seguidas de relleno
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(64)]);

/** Usuario registrado (perfil completo) y su token. */
async function setupCompleteUser() {
  const ctx = buildTestApp();
  const res = await request(ctx.app).post('/api/auth/register').send(validRegistration()).expect(201);
  const uid = res.body.data.uid as string;
  ctx.tokenVerifier.register('ana', { uid, signInProvider: 'password' });
  return { ...ctx, uid, auth: { Authorization: 'Bearer ana' } };
}

describe('POST /api/users/me/avatar (imagen de perfil propia)', () => {
  it('sube la imagen y guarda la URL de Cloudinary en el perfil', async () => {
    const { app, auth, uid, imageStorage, userRepository } = await setupCompleteUser();

    const res = await request(app).post(AVATAR).set(auth).attach('avatar', PNG, { filename: 'yo.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Tu foto de perfil se actualizó.');
    expect(res.body.data.avatar).toMatch(/^https:\/\/res\.cloudinary\.com\/.+\/estudiemos\/avatars\/.+\.webp$/);
    expect(imageStorage.images.get(uid)?.equals(PNG)).toBe(true);
    expect(userRepository.users.get(uid)?.avatar).toBe(res.body.data.avatar);
  });

  it.each([
    ['JPG', JPEG, 'image/jpeg', 'foto.jpg'],
    ['WebP', WEBP, 'image/webp', 'foto.webp'],
  ])('acepta %s', async (_label, buffer, contentType, filename) => {
    const { app, auth } = await setupCompleteUser();
    const res = await request(app).post(AVATAR).set(auth).attach('avatar', buffer, { filename, contentType });
    expect(res.status).toBe(200);
  });

  it('reemplaza la imagen anterior (una sola por usuario)', async () => {
    const { app, auth, uid, imageStorage } = await setupCompleteUser();
    const first = await request(app).post(AVATAR).set(auth).attach('avatar', PNG, { filename: 'a.png', contentType: 'image/png' });
    const second = await request(app).post(AVATAR).set(auth).attach('avatar', JPEG, { filename: 'b.jpg', contentType: 'image/jpeg' });

    expect(second.status).toBe(200);
    expect(second.body.data.avatar).not.toBe(first.body.data.avatar); // nueva versión de la URL
    expect(imageStorage.images.size).toBe(1);
    expect(imageStorage.images.get(uid)?.equals(JPEG)).toBe(true);
  });

  it('responde 400 si no se envía archivo', async () => {
    const { app, auth } = await setupCompleteUser();
    const res = await request(app).post(AVATAR).set(auth);
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ avatar: 'Selecciona una imagen para tu perfil.' });
  });

  it('responde 400 con un tipo de archivo no permitido', async () => {
    const { app, auth } = await setupCompleteUser();
    const res = await request(app)
      .post(AVATAR)
      .set(auth)
      .attach('avatar', Buffer.from('%PDF-1.7'), { filename: 'doc.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.avatar).toBe('Formato no permitido. Usa una imagen JPG, PNG o WebP.');
  });

  it('responde 400 si el archivo dice ser PNG pero su contenido no lo es', async () => {
    const { app, auth, imageStorage } = await setupCompleteUser();
    const res = await request(app)
      .post(AVATAR)
      .set(auth)
      .attach('avatar', Buffer.from('<script>alert(1)</script>'), { filename: 'falso.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(imageStorage.images.size).toBe(0);
  });

  it('responde 400 si la imagen pesa más de 2 MB', async () => {
    const { app, auth } = await setupCompleteUser();
    const big = Buffer.concat([PNG, Buffer.alloc(AVATAR_MAX_BYTES)]);
    const res = await request(app).post(AVATAR).set(auth).attach('avatar', big, { filename: 'grande.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.avatar).toBe('La imagen debe pesar máximo 2 MB.');
  });

  it('responde 400 si se envía más de un archivo', async () => {
    const { app, auth } = await setupCompleteUser();
    const res = await request(app)
      .post(AVATAR)
      .set(auth)
      .attach('avatar', PNG, { filename: 'a.png', contentType: 'image/png' })
      .attach('avatar', PNG, { filename: 'b.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
  });

  it('exige sesión (401)', async () => {
    const { app } = buildTestApp();
    const res = await request(app).post(AVATAR).attach('avatar', PNG, { filename: 'yo.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });

  it('exige perfil completo: un usuario de Google sin username recibe 403 PROFILE_INCOMPLETE', async () => {
    const { app, tokenVerifier } = buildTestApp();
    tokenVerifier.register('google', { uid: 'u-google', email: 'juan@gmail.com', name: 'Juan', signInProvider: 'google.com' });
    await request(app).get('/api/users/me').set('Authorization', 'Bearer google').expect(200);

    const res = await request(app)
      .post(AVATAR)
      .set('Authorization', 'Bearer google')
      .attach('avatar', PNG, { filename: 'yo.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PROFILE_INCOMPLETE');
  });

  it('responde 503 SERVICE_UNAVAILABLE si Cloudinary falla, sin cambiar el perfil', async () => {
    const { app, auth, uid, imageStorage, userRepository } = await setupCompleteUser();
    imageStorage.failUploads = true;

    const res = await request(app).post(AVATAR).set(auth).attach('avatar', PNG, { filename: 'yo.png', contentType: 'image/png' });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(userRepository.users.get(uid)?.avatar).toBe('avatar-03');
  });
});

describe('detectImageType', () => {
  it.each([
    [PNG, 'image/png'],
    [JPEG, 'image/jpeg'],
    [WEBP, 'image/webp'],
    [Buffer.from('GIF89a'), null],
    [Buffer.alloc(0), null],
  ])('identifica el formato real por sus primeros bytes (%#)', (buffer, expected) => {
    expect(detectImageType(buffer)).toBe(expected);
  });
});
