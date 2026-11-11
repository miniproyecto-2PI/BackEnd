## 📋 Descripción
<!-- Describe brevemente qué hace este PR, la funcionalidad que añade o el problema que resuelve. -->
<!-- Incluye referencias a Historias de Usuario (HU), tareas o Criterios de Aceptación si aplica. -->


## 🛠️ Tipo de PR (PR Type)
- [ ] 🚀 **Feature** (Nueva funcionalidad)
- [ ] 🐛 **Fix** (Corrección de error)
- [ ] 🧪 **Test** (Pruebas añadidas o actualizadas)
- [ ] ♻️ **Refactor** (Reestructuración de código sin alterar comportamiento)
- [ ] 📝 **Docs** (Documentación / Swagger)
- [ ] 🔧 **Chore** (Configuración, CI, dependencias, tooling)


## 🔍 Cambios realizados
<!-- Detalla los archivos o módulos modificados según las capas o estructura del proyecto -->

### Capa de Acceso a Datos / Repositorios
- `src/repositories/` — <!-- Descripción de operaciones en Firestore, consultas y persistencia -->

### Capa de Lógica de Negocio / Servicios
- `src/services/` — <!-- Servicios, orquestación y validaciones de negocio -->

### Capa de Presentación / Controladores y Rutas (API)
- `src/controllers/` — <!-- Manejadores de peticiones HTTP y respuestas -->
- `src/routes/` — <!-- Rutas expuestas y documentación Swagger OpenAPI -->

### Configuración / Infraestructura
- `src/config/` — <!-- Variables de entorno, conexión a Firebase Admin SDK -->
- `Dockerfile` / `docker-compose.yml` — <!-- Contenedorización y despliegue -->


## 🧪 Calidad y Validaciones
<!-- Marca las validaciones ejecutadas antes de abrir el PR -->
- [ ] `npm run build` (Compilación de TypeScript sin errores)
- [ ] `npm run typecheck` (Chequeo estricto de tipos pasando)
- [ ] Conexión y lectura con Firestore verificada
- [ ] Swagger UI validado en `/api/docs` y esquema `/api/docs.json`
- [ ] Respuestas de error estructuradas (503 / 404 / 400)


## 💡 Decisiones técnicas
<!-- Justifica decisiones de diseño, patrones adoptados, alternativas descartadas o manejo de casos borde -->
- 


## 🚀 Cómo probar
<!-- Proporciona pasos claros para que el revisor reproduzca y pruebe los cambios localmente -->

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar en modo desarrollo
npm run dev

# 3. Probar endpoint
curl -X GET http://localhost:3000/api/archetype/data
```

### Pruebas desde Swagger UI:
- [ ] Probado interactivamente en `http://localhost:3000/api/docs`

<!-- Adjunta aquí capturas de pantalla de Swagger, respuestas JSON o evidencias si aplica -->
