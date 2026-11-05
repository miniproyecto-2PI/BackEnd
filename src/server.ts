import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

const server = app.listen(env.PORT, env.HOST, () => {
  console.log('========================================================');
  console.log(`🚀 Servidor Backend iniciado con éxito`);
  console.log(`📡 URL Base:      http://${env.HOST}:${env.PORT}`);
  console.log(`📚 Swagger UI:    http://${env.HOST}:${env.PORT}/api-docs`);
  console.log(`🩺 Health Check:  http://${env.HOST}:${env.PORT}/api/health`);
  console.log(`🔥 TS-00 Data:    http://${env.HOST}:${env.PORT}/api/archetype/data`);
  console.log(`🌍 Entorno:       ${env.NODE_ENV}`);
  console.log('========================================================');
});

// Manejo de apagado elegante (Graceful Shutdown)
const gracefulShutdown = (signal: string) => {
  console.log(`\n[Server] Señal ${signal} recibida. Cerrando conexiones de manera ordenada...`);
  server.close(() => {
    console.log('[Server] Servidor HTTP cerrado correctamente.');
    process.exit(0);
  });

  // Forzar apagado después de 10s si quedan conexiones colgadas
  setTimeout(() => {
    console.error('[Server] Apagado forzado por tiempo límite.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

