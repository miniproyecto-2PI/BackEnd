/**
 * Catálogo de avatares predeterminados para el registro manual (US-01).
 *
 * La API guarda solo el identificador; el frontend decide la imagen de cada uno.
 * Si UX cambia el catálogo, actualizar esta lista (y Swagger se actualiza solo,
 * porque el esquema de registro la usa como enum).
 */
export const AVATAR_IDS = [
  'avatar-01',
  'avatar-02',
  'avatar-03',
  'avatar-04',
  'avatar-05',
  'avatar-06',
  'avatar-07',
  'avatar-08',
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];
