# ==============================================================================
# Multi-stage Dockerfile para NestJS (Optimizado para Easypanel / Producción)
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Build Stage
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar manifiestos de dependencias
COPY package*.json ./

# Instalar dependencias completas para compilar el proyecto
RUN npm ci

# Copiar archivos de configuración y código fuente
COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/

# Compilar TypeScript a JavaScript (dist/)
RUN npm run build

# Remover dependencias de desarrollo para aligerar la imagen
RUN npm prune --omit=dev && npm cache clean --force

# ------------------------------------------------------------------------------
# 2. Production Stage
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Variables de entorno estándar
ENV NODE_ENV=production
ENV PORT=5001

# Asignar permisos al usuario 'node' (incluido en la imagen Alpine)
RUN chown -R node:node /app

# Copiar los artefactos compilados y dependencias optimizadas desde el builder
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist

# Ejecutar como usuario sin privilegios por seguridad
USER node

# Exponer el puerto del microservicio
EXPOSE 5001

# Comando de inicio del servicio
CMD ["node", "dist/main"]

