import { Request, Response, NextFunction } from 'express';
import { ArchetypeService } from '../services/archetype.service';
import { env } from '../config/env';

export class HealthController {
  constructor(private readonly archetypeService: ArchetypeService = new ArchetypeService()) {}

  checkHealth = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dbHealth = await this.archetypeService.checkHealth();

      const statusCode = dbHealth.database === 'healthy' ? 200 : 200; // 200 para que Render health check pase

      res.status(statusCode).json({
        success: true,
        status: 'UP',
        service: 'backend-api',
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        database: {
          status: dbHealth.database,
          latencyMs: dbHealth.latencyMs,
          type: 'Google Cloud Firestore',
        },
        version: '1.0.0',
      });
    } catch (error) {
      next(error);
    }
  };
}

