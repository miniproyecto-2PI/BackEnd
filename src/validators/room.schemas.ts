import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string().trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres.')
    .max(60, 'El nombre no puede superar los 60 caracteres.')
}).strict();

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
