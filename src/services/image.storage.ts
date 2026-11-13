import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { env } from '../config/env';
import { ServiceUnavailableError } from '../types/errors.types';

export interface UploadedImage {
  /** URL pública https (CDN de Cloudinary), con versión para evitar caché vieja. */
  url: string;
  publicId: string;
}

/**
 * Almacenamiento de imágenes de perfil. Se inyecta en UserService para poder
 * probar sin Cloudinary (ver tests/helpers/fakes.ts).
 */
export interface ImageStorage {
  /** Sube (o reemplaza) el avatar del usuario. Una sola imagen por uid. */
  uploadAvatar(uid: string, image: Buffer): Promise<UploadedImage>;
  /** Elimina el avatar del usuario. Idempotente (para US-05, eliminar cuenta). */
  deleteAvatar(uid: string): Promise<void>;
}

const UNAVAILABLE_MESSAGE =
  'No pudimos guardar tu imagen en este momento. Intenta de nuevo en unos minutos.';

/**
 * Implementación con Cloudinary (SDK v2). Configuración perezosa:
 * CLOUDINARY_URL o CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET.
 * El api_secret vive solo en el servidor; el frontend nunca habla directo con Cloudinary.
 */
export class CloudinaryImageStorage implements ImageStorage {
  private configured = false;

  private ensureConfigured(): void {
    if (this.configured) return;
    const { url, cloudName, apiKey, apiSecret } = env.CLOUDINARY;

    if (url) {
      // El SDK lee CLOUDINARY_URL del entorno por sí solo; solo forzamos https.
      cloudinary.config({ secure: true });
    } else if (cloudName && apiKey && apiSecret) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    } else {
      console.error('[Cloudinary] Sin credenciales: defina CLOUDINARY_URL o las tres variables CLOUDINARY_*.');
      throw new ServiceUnavailableError(UNAVAILABLE_MESSAGE);
    }
    this.configured = true;
  }

  private publicIdFor(uid: string): string {
    return `${env.CLOUDINARY.avatarFolder}/${uid}`;
  }

  async uploadAvatar(uid: string, image: Buffer): Promise<UploadedImage> {
    this.ensureConfigured();

    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            public_id: this.publicIdFor(uid),
            overwrite: true, // misma ruta por usuario: no quedan imágenes huérfanas
            invalidate: true, // invalida la caché del CDN de la imagen anterior
            resource_type: 'image',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
            // Transformación al subir: todos los avatares quedan cuadrados, livianos y en WebP
            transformation: [{ width: 512, height: 512, crop: 'fill', gravity: 'auto' }, { quality: 'auto' }],
            format: 'webp',
          },
          (error, response) => (error || !response ? reject(error) : resolve(response))
        );
        stream.end(image);
      });

      return { url: result.secure_url, publicId: result.public_id };
    } catch (error) {
      const err = error as { http_code?: number; message?: string };
      console.error(`[Cloudinary] Falló la subida del avatar de ${uid} (${err.http_code ?? 'n/a'}): ${err.message}`);
      throw new ServiceUnavailableError(UNAVAILABLE_MESSAGE);
    }
  }

  async deleteAvatar(uid: string): Promise<void> {
    this.ensureConfigured();
    try {
      // 'not found' no es error: la operación es idempotente
      await cloudinary.uploader.destroy(this.publicIdFor(uid), { resource_type: 'image', invalidate: true });
    } catch (error) {
      console.error(`[Cloudinary] Falló el borrado del avatar de ${uid}: ${(error as Error).message}`);
      throw new ServiceUnavailableError(UNAVAILABLE_MESSAGE);
    }
  }
}
