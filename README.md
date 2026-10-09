# ISTRAM MCP

Servidor MCP local para ISTRAM/ISPOL. **Versión candidata 0.2.0-rc.1; el flujo nativo de carretera aún no está certificado.**

La implementación sustituye la versión fija del prototipo por evidencia de registros, diferencia componentes instalados y licencia, valida entradas y ofrece copias con cambios recuperables. Los comandos de teclado encontrados en la instalación no se presentan como una API ejecutable.

## Instalación

Node 22.14 o posterior; Python 3.12 recomendado para Windows/IFC.

~~~powershell
npm ci
npm run build
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r python/requirements.txt
npm test
.\.venv\Scripts\python.exe -m unittest discover -s python -p "test_*.py"
~~~

Ejemplo de configuración del cliente MCP: [examples/mcp.json](examples/mcp.json). Sustituir rutas de ejemplo por las de la instalación. No requiere una clave de modelo: el cliente de IA realiza las inferencias.

## Herramientas

- Consulta: istram_detect, istram_command_catalog, project_inspect, alignment_read, profile_read, native_records_read, ifc_entity_types.
- Copias y cambios: project_copy, project_prepare_changes, project_apply_changes, project_restore_changes.
- Windows: worker_health, session_snapshot, operation_start, operation_status, operation_cancel.
- IFC: ifc_validate.

Recursos: istram://system/status, istram://ifc/classes, istram://system/coverage.

## Flujo seguro

1. Inspeccionar el proyecto y resolver referencias externas.
2. Crear una copia con project_copy. El servidor devuelve su identificador y ubicación.
3. Preparar cambios exactos con número de línea, contenido esperado y contenido nuevo. Se comprueba el hash completo al aplicar.
4. Aplicar solo con adaptador verificado y sin ISTRAM abierto. Los originales no son objetivos de escritura.
5. Abrir la copia mediante una receta comprobada, recalcular, configurar BIM, generar y exportar.
6. Consultar el identificador de operación; ante estado uncertain, comprobar el resultado antes de repetir.
7. Validar el IFC con geometría activada cuando se necesite esa comprobación.

La escritura de líneas **no valida el diseño geométrico**. No habilitar formatos ni recetas nativas hasta contrastarlos con la documentación y con ISTRAM. Un lector .ALI no implica que ese fichero sea la fuente principal del eje .cej.

## Configuración

- ISTRAM_PATH: instalación, por defecto C:\Ispol.
- ISTRAM_WORKSPACE: carpeta de copias; por defecto .local/projects junto al servidor.
- ISTRAM_PYTHON: ruta del intérprete con IfcOpenShell y pywinauto.
- ISTRAM_ADAPTER_PROFILE: perfil local ligado al SHA-256 del ejecutable y a pruebas de aceptación.
- ISTRAM_ACCEPTANCE_MODE: exclusivamente para el evaluador local de candidatos; no activarlo en el cliente de IA.

No se incluye un perfil certificado de ISTRAM: hace falta comprobar controles y postcondiciones en la instalación concreta. [Contrato del adaptador](docs/ADAPTER.md).

## Validación y límites

CI: Ubuntu/Windows, Node 22/24, pruebas de parsers, protocolo y cambios; Python/IFC con un modelo sintético. Estas pruebas no reemplazan la licencia ni las 20 ejecuciones reales acordadas.

La consulta completa del canal solicitado, el cuaderno NotebookLM y las pruebas nativas supervisadas siguen pendientes. La carpeta local utiliza esta versión candidata; el prototipo 0.1.0 y su plan anterior se han retirado. [Fuentes](docs/SOURCES.md), [arquitectura](docs/ARCHITECTURE.md), [aceptación](docs/ACCEPTANCE.md).

La versión de ISTRAM informada por el registro corresponde a la última sesión observada. Su actualidad y los módulos licenciados se verifican por separado. No modifica ni actualiza la instalación del fabricante.

No publicar proyectos de clientes, licencias, registros personales, binarios ni copias de manuales del fabricante.

## Desarrollo local

Este repositorio es la única base de desarrollo vigente. Ejecutar npm ci, npm run typecheck y npm test después de sincronizar cambios. Los resultados de CI se consultan en GitHub Actions.
