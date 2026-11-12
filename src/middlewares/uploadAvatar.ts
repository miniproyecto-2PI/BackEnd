import { NextFunction, Request, Response } from 'express';
import multer, { MulterError } from 'multer';
import { ValidationError } from '../types/errors.types';

/** Reglas de la imagen de perfil (US-01: "documentar formato y tamaño máximo"). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const AVATAR_FIELD = 'avatar';
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const FORMAT_MESSAGE = 'Formato no permitido. Usa una imagen JPG, PNG o WebP.';
const SIZE_MESSAGE = 'La imagen debe pesar máximo 2 MB.';

/**
 * Detecta el formato real por los primeros bytes ("magic numbers"). El tipo MIME
 * que declara el navegador se puede falsificar; el contenido no.
 */
export function detectImageType(buffer: Buffer): (typeof AVATAR_MIME_TYPES)[number] | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

// En memoria: la imagen (≤ 2 MB) va directo a Cloudinary sin tocar el disco del contenedor.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1, fields: 0 },
  fileFilter: (_req, file, cb) => {
    if ((AVATAR_MIME_TYPES as readonly string[]).includes(file.mimetype)) return cb(null, true);
    cb(new ValidationError(undefined, { [AVATAR_FIELD]: FORMAT_MESSAGE }));
  },
}).single(AVATAR_FIELD);

/**
 * Recibe `multipart/form-data` con un único archivo en el campo `avatar`, valida
 * tamaño y formato (declarado y real) y deja el archivo en req.file.
 * Errores: 400 VALIDATION_ERROR con fields.avatar.
 */
export function uploadAvatar(req: Request, res: Response, next: NextFunction): void {
  upload(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? SIZE_MESSAGE
          : 'Envía una sola imagen en el campo "avatar".';
      return next(new ValidationError(undefined, { [AVATAR_FIELD]: message }));
    }
    if (err) return next(err);

    if (!req.file) {
      return next(new ValidationError(undefined, { [AVATAR_FIELD]: 'Selecciona una imagen para tu perfil.' }));
    }
    if (!detectImageType(req.file.buffer)) {
      return next(new ValidationError(undefined, { [AVATAR_FIELD]: FORMAT_MESSAGE }));
    }
    next();
  });
}
