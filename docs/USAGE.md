# Herramientas y configuración

## Herramientas

Consulta: istram_detect, istram_command_catalog, project_inspect, alignment_read, profile_read, native_records_read, ifc_entity_types.

Copias: project_copy, project_prepare_changes, project_apply_changes, project_restore_changes.

Sesión y operaciones: worker_health, session_snapshot, operation_start, operation_status, operation_cancel.

IFC: ifc_validate.

El cliente puede descubrir los esquemas de argumentos mediante tools/list. Recursos disponibles: istram://system/status, istram://ifc/classes y istram://system/coverage.

## Variables de entorno

- ISTRAM_PATH: instalación; por defecto C:\Ispol.
- ISTRAM_WORKSPACE: carpeta de copias; por defecto .local/projects.
- ISTRAM_PYTHON: intérprete con las dependencias de python/requirements.txt.
- ISTRAM_ADAPTER_PROFILE: perfil local contrastado con el ejecutable y pruebas.
- ISTRAM_ACCEPTANCE_MODE: solo para el evaluador supervisado de candidatos.

## Cambios y acciones

Inspeccionar referencias externas antes de crear la copia. Preparar cambios con línea, contenido esperado y contenido nuevo. Aplicar con ISTRAM cerrado y con las reglas del formato verificadas. La edición de texto no comprueba la coherencia geométrica.

operation_start devuelve un identificador; consultar operation_status hasta el resultado. Un resultado uncertain requiere inspección antes de repetir. La cancelación se admite antes de iniciar; no termina ISTRAM.

El adaptador utiliza recetas locales comprobadas. Ver docs/ADAPTER.md antes de habilitar acciones.
