import { Request, Response, NextFunction } from 'express';
import { ArchetypeService } from '../services/archetype.service';
import { SeedArchetypeInput } from '../validators/archetype.schemas';
import { sendSuccess } from '../utils/response';

export class ArchetypeController {
  constructor(private readonly service: ArchetypeService = new ArchetypeService()) {}

  getArchetypeData = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { data, fromCacheOrCreated } = await this.service.getArchetypeStatus();
      sendSuccess(
        res,
        200,
        data,
        fromCacheOrCreated
          ? 'Documento base creado y consultado exitosamente en Firestore (colección inicializada)'
          : 'Dato leído exitosamente desde Firestore'
      );
    } catch (error) {
      next(error);
    }
  };

  seedArchetypeData = async (
    req: Request<unknown, unknown, SeedArchetypeInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const saved = await this.service.seedArchetype(req.body);
      sendSuccess(res, 201, saved, 'Dato de prueba creado/actualizado correctamente en Firestore');
    } catch (error) {
      next(error);
    }
  };
}
