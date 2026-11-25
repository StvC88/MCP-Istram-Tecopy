# ISTRAM MCP

Conecta un cliente de IA con ISTRAM/ISPOL mediante [Model Context Protocol](https://modelcontextprotocol.io/). El cliente solicita herramientas; el servidor consulta datos del proyecto y coordina las operaciones de ISTRAM.

**Estado: versión candidata 0.3.0-rc.1 para revisión técnica.** Incluye 32 herramientas MCP y preparación de geometría para ejes, tuberías y contornos de cunetas, cajones, muros, túneles y detalles. La importación, cálculo y persistencia nativos siguen pendientes de un adaptador certificado.

## Revisar el proyecto

- [Implementación y comprobaciones 0.3](docs/IMPLEMENTATION_0_3.md): cambios, ejemplos y límites de uso por otras personas.
- [Revisión de usos y brechas](docs/USAGE_REVIEW.md): 24 áreas, inventario de 120 vídeos, 16 transcripciones contrastadas y cuaderno «ISTRAM Clases Chile» con 13 fuentes confirmadas.
- [Contratos de capacidades](docs/USAGE_CAPABILITIES.md): parámetros, cobertura real y aceptación por área; consultables con `usage_capabilities`.
- [Edición por lotes](docs/BATCH_EDIT.md): preparación por listado de elementos con conflictos de archivos compartidos y recuperación.

- [Código y cambios propuestos](https://github.com/StvC88/MCP-Istram-Tecopy/pull/1).
- [Guía breve para Buhodra Ingeniería](docs/REVIEW.md): recorrido del código y decisiones que necesitan contraste con el fabricante.
- [Alcance del MCP](docs/SCOPE.md): áreas oficiales y orden de desarrollo.
- [Plan vigente](docs/PLAN.md): pasos hasta la prueba con el proyecto abierto.
- [Plan de pruebas de desempeño](docs/PLAN_PRUEBAS_DESEMPENO.md): comparación reproducible del tiempo de intervención y los controles de calidad.

## Qué incluye

- Consultar instalación, comandos documentados, proyecto, ejes, rasantes y clasificación IFC.
- Preparar cambios sobre copias, comprobar hashes y recuperar archivos.
- Consultar la sesión de Windows y ejecutar operaciones mediante recetas locales verificadas.
- Validar IFC con IfcOpenShell.
- Comprobar pendientes, conexiones y recubrimientos en extremos de tuberías; obtener contornos y paquetes DXF/JSON trazables en copias.

El catálogo de comandos es una referencia documental. No implica que todos puedan ejecutarse mediante el MCP. No se distribuye un adaptador certificado.

`project_inspect` distingue `no_project`, `temporary_only` y `project_found` mediante
`projectStatus`, tanto en detalle como en resumen. Los dos primeros estados incluyen
un aviso en `inspectionWarnings`: hay que completar la copia o seleccionar el POL
guardado antes de intentar generar o exportar. Una inspección ejecutada correctamente
(`ok: true`) no acredita que la carpeta contenga un proyecto exportable. Tampoco
`project_found` certifica dependencias, geometría ni carga en la sesión. En resúmenes
paginados, `dependencyWarningScope: returned_projects_only` indica que las advertencias
corresponden únicamente a los proyectos de esa página.
Los archivos situados bajo `tmp` o `res` se reconocen como temporales también dentro
de subcarpetas. Cada proyecto incluye `projectDirectory`, la carpeta que contiene su
POL, para contrastarla con la carpeta de trabajo de Istram. La búsqueda de tablas
DAR (incluidas las tablas de firme referenciadas por `DAF`) contempla primero la carpeta `lib` del propio proyecto, conservando el aviso
de que esa coincidencia todavía debe comprobarse en la sesión nativa.

## Cómo funciona

Cliente de IA → servidor TypeScript → archivos del proyecto o trabajador Python → ISTRAM / IfcOpenShell.

El servidor usa el SDK oficial de MCP, transporte stdio y argumentos validados. Las operaciones nativas se ejecutan en serie y comprueban el proyecto de destino. [Arquitectura](docs/ARCHITECTURE.md).

El protocolo JSON hacia Python se lee explícitamente como UTF-8, también cuando
Windows configura la entrada estándar con una página de códigos heredada. Esto
conserva las tildes y otros caracteres Unicode en rutas y nombres de clases.

## Instalar y comprobar

Node 22.14 o posterior y Python 3.12 recomendado.

~~~powershell
npm ci
npm run typecheck
npm test
npm run build
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r python/requirements.txt
.\.venv\Scripts\python.exe -m unittest discover -s python -p "test_*.py"
npm run doctor
npm run smoke
~~~

Para verificar DXF con un lector independiente: instalar `python/requirements-test.txt` y ejecutar `npm run test:dxf` después de `npm run smoke`. El trabajador detecta automáticamente `.venv`; `ISTRAM_PYTHON` permite elegir otro intérprete. Cada instalación necesita su propia licencia y aceptación nativa.

Configurar el cliente con [examples/mcp.json](examples/mcp.json). Solo requiere rutas locales; la IA pertenece al cliente MCP.

[Instalación en Codex para Windows](docs/CODEX_INSTALL.md): entorno Python aislado, registro stdio y comprobaciones.

## Prueba en ISTRAM

Para IFC grandes, `ifc_validation_start` devuelve inmediatamente un `id`; consultar
`operation_status` con ese identificador hasta su estado terminal. El trabajo conserva
el resultado en el diario local y evita depender del tiempo máximo de una llamada MCP.
`completed` significa que terminó la comprobación: revisar también `result.valid`.
Mantener el IFC sin cambios mientras se valida. Los diagnósticos incluyen recuentos
completos, categorías de esquema y hasta 100 muestras de longitud limitada.

Para exportar IFC4.3 ADD2 con RCEclass y comprobar cobertura de códigos y
asociaciones, véase la [guía IFC con RCEclass](docs/RCECLASS_IFC.md).

La primera prueba sobre una sesión abierta será de consulta. Antes de guardar, recalcular o exportar se contrastarán manuales, curso y selectores reales. El flujo de modificación y BIM se probará en una copia identificada del proyecto. [Primera prueba de sesión](docs/SESSION_TEST.md) y [aceptación](docs/ACCEPTANCE.md).

[Resultados de pruebas de la base](docs/VALIDATION.md) y [prueba de instalación y eje 2D](docs/LIVE_TEST_2D.md). Se ha creado y calculado una recta de 100 m mediante la interfaz de ISTRAM y leído su resultado mediante MCP. La ejecución nativa desde el MCP sigue pendiente de un adaptador verificado.

## Documentación

[Herramientas y configuración](docs/USAGE.md) · [Adaptador nativo](docs/ADAPTER.md) · [Fuentes y pendientes](docs/SOURCES.md).

Este repositorio es la única base de desarrollo vigente. No contiene proyectos de clientes, binarios, licencias ni copias de manuales del fabricante.
