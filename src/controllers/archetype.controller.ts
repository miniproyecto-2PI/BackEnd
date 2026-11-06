import { Request, Response, NextFunction } from 'express';
import { ArchetypeService } from '../services/archetype.service';
import { ApiResponse, ArchetypeData } from '../types/archetype.types';

export class ArchetypeController {
  constructor(private readonly service: ArchetypeService = new ArchetypeService()) {}

  getArchetypeData = async (
    _req: Request,
    res: Response<ApiResponse<ArchetypeData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { data, fromCacheOrCreated } = await this.service.getArchetypeStatus();

      res.status(200).json({
        success: true,
        message: fromCacheOrCreated
          ? 'Documento base creado y consultado exitosamente en Firestore (colección inicializada)'
          : 'Dato leído exitosamente desde Firestore',
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  seedArchetypeData = async (
    req: Request,
    res: Response<ApiResponse<ArchetypeData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const saved = await this.service.seedArchetype(req.body);

      res.status(201).json({
        success: true,
        message: 'Dato de prueba creado/actualizado correctamente en Firestore',
        data: saved,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}

