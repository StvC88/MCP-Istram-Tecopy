# Herramientas y configuración

## Herramientas

Revisión funcional: `usage_capabilities` permite buscar con `query`, seleccionar `capabilityId` y paginar con `offset`/`limit`. Devuelve requisitos, cobertura, evidencia y aceptación. Los nombres en `proposedTools` son propuestas y no se pueden ejecutar. Catálogo completo: `istram://usage/capabilities`. [Revisión](USAGE_REVIEW.md).

En 0.3 se descubren 25 herramientas. `usage_workflow_plan` devuelve las herramientas disponibles y pendientes de aceptación para una de las 24 áreas. `alignment_design_preview`, `drainage_design_preview` y `section_design_preview` validan geometría declarada; `design_package_prepare` guarda DXF y JSON solo dentro de `.istram-mcp/deliverables` de la copia. [Ejemplos y límites](IMPLEMENTATION_0_3.md).

Consulta: istram_detect, istram_command_catalog, project_inspect, alignment_read, profile_read, native_records_read, ifc_entity_types.

Copias: project_copy, project_prepare_changes, project_apply_changes, project_restore_changes.

`project_changes_preview` pagina cambios y archivos con `offset`/`limit`, estado, hashes y resumen del lote. `project_prepare_batch` acepta `summaryOnly: true` para devolver las primeras 20 entradas y conservar el plan completo en disco. `native_records_read` ahora devuelve `total`, `offset`, `limit` y hasta 200 registros por defecto; pedir páginas sucesivas para archivos largos. Las exclusiones de copia se aplican antes de recorrer esas carpetas: `excludedFilesCount` es `null` cuando una carpeta excluida está presente, porque su contenido no se enumera.

Lotes por elementos: `project_prepare_batch` prepara un único plan recuperable a partir de `elements` (identificador y cambios explícitos). Límite de 1000 elementos y 10000 cambios de entrada. Deduplica solicitudes idénticas a archivos compartidos y rechaza conflictos; no cambia archivos de diseño. [Contrato y ejemplo](BATCH_EDIT.md).

Sesión y operaciones: worker_health, session_snapshot, operation_start, operation_status, operation_cancel.

IFC: ifc_validate.

El cliente puede descubrir los esquemas de argumentos mediante tools/list. Recursos disponibles: istram://system/status, istram://ifc/classes y istram://system/coverage.

## Variables de entorno

- ISTRAM_PATH: instalación; por defecto C:\Ispol.
- ISTRAM_WORKSPACE: carpeta de copias; por defecto .local/projects.
- ISTRAM_PYTHON: intérprete con las dependencias de python/requirements.txt; si no se define, se usa `.venv` del repositorio y después Python del sistema.
- ISTRAM_ADAPTER_PROFILE: perfil local contrastado con el ejecutable y pruebas.
- ISTRAM_ACCEPTANCE_MODE: solo para el evaluador supervisado de candidatos.

## Cambios y acciones

Inspeccionar referencias externas antes de crear la copia. Preparar cambios con línea, contenido esperado y contenido nuevo. Aplicar con ISTRAM cerrado y con las reglas del formato verificadas. La edición de texto no comprueba la coherencia geométrica.

operation_start devuelve un identificador; consultar operation_status hasta el resultado. Un resultado uncertain requiere inspección antes de repetir. La cancelación se admite antes de iniciar; no termina ISTRAM.

Las acciones incluyen `close_project` mediante receta de cierre normal. Los errores de operación contienen `code`, `message` y `details` opcionales; diarios antiguos de texto se leen como `LEGACY_ERROR`. Las operaciones nativas contrastan hashes del original antes y después y exigen guardias de proyecto y directorio de trabajo.

El adaptador utiliza recetas locales comprobadas. Ver docs/ADAPTER.md antes de habilitar acciones.
