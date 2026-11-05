import { IArchetypeRepository } from '../repositories/interfaces/archetype.repository.interface';
import { ArchetypeRepository } from '../repositories/archetype.repository';
import { ArchetypeData } from '../types/archetype.types';
import { env } from '../config/env';

export class ArchetypeService {
  constructor(private readonly repository: IArchetypeRepository = new ArchetypeRepository()) {}

  /**
   * Obtiene la configuración del arquetipo base almacenada en Firestore.
   * Si no existe aún en Firestore, crea el documento semilla inicial y lo retorna.
   */
  async getArchetypeStatus(): Promise<{ data: ArchetypeData; fromCacheOrCreated: boolean }> {
    const existing = await this.repository.getArchetypeConfig('sprint-0');

    if (existing) {
      return { data: existing, fromCacheOrCreated: false };
    }

    // Si el documento aún no existe en Firestore, lo sembramos automáticamente
    const seedData: ArchetypeData = {
      projectName: 'Salón de Estudio Colaborativo en Tiempo Real',
      sprint: 'Sprint 0: Fundamentación UX y Base Técnica End-to-End',
      version: '1.0.0',
      description:
        'Base técnica operativa y comunicada con Firestore para el Sprint 0 (TS-00). Permite verificar la lectura de datos desde la nube.',
      databaseStatus: 'connected',
      environment: env.NODE_ENV,
      updatedAt: new Date().toISOString(),
      features: [
        'Arquitectura por capas (Rutas, Lógica y Acceso a Datos)',
        'Lectura y persistencia con Firebase Firestore',
        'Contenedorización con Docker y Docker Compose',
        'Despliegue automatizado en Render',
        'Documentación interactiva con Swagger OpenAPI',
        'Manejo estandarizado y claro de errores de red/base de datos',
      ],
    };

    const created = await this.repository.upsertArchetypeConfig(seedData, 'sprint-0');
    return { data: created, fromCacheOrCreated: true };
  }

  /**
   * Actualiza o crea manualmente la información del arquetipo en Firestore.
   */
  async seedArchetype(customData?: Partial<ArchetypeData>): Promise<ArchetypeData> {
    const dataToSave: ArchetypeData = {
      projectName: customData?.projectName || 'Salón de Estudio Colaborativo en Tiempo Real',
      sprint: customData?.sprint || 'Sprint 0: Fundamentación UX y Base Técnica End-to-End',
      version: customData?.version || '1.0.0',
      description:
        customData?.description ||
        'Documento de prueba en Firestore para verificar conectividad y renderizado end-to-end.',
      databaseStatus: 'connected',
      environment: env.NODE_ENV,
      updatedAt: new Date().toISOString(),
      features: customData?.features || [
        'Arquitectura por capas',
        'Node.js + TypeScript',
        'Conexión Firestore',
        'Despliegue en Render',
      ],
    };

    return this.repository.upsertArchetypeConfig(dataToSave, 'sprint-0');
  }

  /**
   * Verifica la conectividad con Firestore.
   */
  async checkHealth(): Promise<{ database: 'healthy' | 'unhealthy'; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.repository.pingFirestore();
      return {
        database: 'healthy',
        latencyMs: Date.now() - start,
      };
    } catch {
      return {
        database: 'unhealthy',
        latencyMs: Date.now() - start,
      };
    }
  }
}

