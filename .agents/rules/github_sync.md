---
description: Regla de sincronización automática obligatoria con GitHub tras cualquier cambio o despliegue
globs: **/*
---

# Sincronización Automática con GitHub (Obligatoria)

Tras realizar cualquier cambio, arreglo, compilación o despliegue en el proyecto FinanzApp:
1. Siempre ejecutar `git add -A`, crear un commit descriptivo y realizar `git push origin main`.
2. Mantener el repositorio remoto de GitHub siempre actualizado como respaldo permanente frente a cualquier eventualidad o pérdida local.
