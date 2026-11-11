import { z } from 'zod';

/** Cuerpo opcional de POST /api/archetype/seed (TS-00). */
export const seedArchetypeSchema = z
  .object({
    projectName: z.string().trim().min(1).max(120).optional(),
    sprint: z.string().trim().min(1).max(120).optional(),
    version: z.string().trim().min(1).max(20).optional(),
    description: z.string().trim().min(1).max(500).optional(),
    features: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  })
  .strict();

export type SeedArchetypeInput = z.infer<typeof seedArchetypeSchema>;
