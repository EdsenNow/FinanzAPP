# Notas sobre dependencias de Cloud Functions

## `overrides` en `package.json`

Los siguientes paquetes están fijados (`overrides`) para evitar incompatibilidades
entre `firebase-admin` / `@google-cloud/kms` y las versiones transitivas que
resuelve npm:

| Paquete       | Versión fijada | Motivo |
|---------------|----------------|--------|
| `uuid`        | `11.1.1`       | Evita breaking changes en generación de IDs usados por `google-gax`. |
| `gaxios`      | `7.1.4`        | Mantiene compatibilidad con la firma de requests de `google-gax` 5.x. |
| `google-gax`  | `5.0.6`        | Versión estable compatible con `@google-cloud/kms` y `firebase-admin` 13.x. |
| `retry-request`| `8.0.2`       | Evita errores de retry infinito en requests fallidos de gaxios. |
| `teeny-request`| `10.1.2`      | Alinea la implementación de requests con `gaxios` 7.x. |

## `postinstall`: `patch-google-gax.js`

`google-gax@5.0.6` no exporta algunos submódulos internos que requieren
ciertos clientes de Google Cloud. El script `scripts/patch-google-gax.js`
añade entradas a `package.json` de `node_modules/google-gax` para exponer:

- `./build/src/fallback`
- `./build/src/status`
- `./build/src/gax`

No modifica el código fuente de la librería, solo su mapa de `exports`.

## Antes de actualizar

Si vas a subir `firebase-admin`, `@google-cloud/kms` o `firebase-functions`,
prueba primero en un entorno de staging y revisa si estas `overrides` y el
`postinstall` siguen siendo necesarios.
