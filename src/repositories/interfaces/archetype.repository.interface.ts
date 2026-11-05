import { ArchetypeData } from '../../types/archetype.types';

export interface IArchetypeRepository {
  getArchetypeConfig(docId?: string): Promise<ArchetypeData | null>;
  upsertArchetypeConfig(data: ArchetypeData, docId?: string): Promise<ArchetypeData>;
  pingFirestore(): Promise<boolean>;
}

