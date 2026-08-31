---
description: Regla de sincronización automática obligatoria con GitHub tras cualquier cambio o despliegue
globs: **/*
---

# Sincronización con GitHub y Reglas de Despliegue

1. Tras realizar cualquier cambio en el proyecto: Ejecutar `git add -A`, commit descriptivo y `git push origin main` para mantener el respaldo en GitHub.
2. **PROHIBIDO DESPLEGAR A PRODUCCIÓN (FIREBASE DEPLOY)** de forma automática. NUNCA ejecutar `firebase deploy` a menos que el usuario lo ordene explícita y directamente en su mensaje. Todos los cambios se prueban y compilan estrictamente en local.
