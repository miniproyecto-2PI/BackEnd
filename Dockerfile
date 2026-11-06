# ==============================================================================
# Multi-stage Dockerfile para Backend API (Node.js + TypeScript)
# Optimizado para producción y despliegue en Render
# ==============================================================================

# ETAPA 1: Construcción (Builder)
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias del proyecto (incluidas devDependencies para compilar)
COPY package*.json ./
RUN npm install

# Copiar archivos de configuración y código fuente TypeScript
COPY tsconfig.json ./
COPY src/ ./src/

# Compilar TypeScript a JavaScript estándar en dist/
RUN npm run build

# ==============================================================================
# ETAPA 2: Entorno de Ejecución (Runner / Producción)
FROM node:20-alpine AS runner

WORKDIR /app

# Establecer entorno en modo producción
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copiar únicamente definiciones de paquetes
COPY package*.json ./

# Instalar exclusivamente dependencias de producción para mantener la imagen ligera
RUN npm install --omit=dev && npm cache clean --force

# Copiar el artefacto compilado desde la etapa builder
COPY --from=builder /app/dist ./dist

# Crear y usar usuario sin privilegios root por seguridad
USER node

# Exponer el puerto predeterminado (Render mapea dinámicamente según la variable $PORT)
EXPOSE 3000

# Comando para iniciar la aplicación compilada
CMD ["node", "dist/server.js"]
