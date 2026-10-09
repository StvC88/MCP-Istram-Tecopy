# ISTRAM MCP

Conecta un cliente de IA con ISTRAM/ISPOL mediante [Model Context Protocol](https://modelcontextprotocol.io/). El cliente solicita herramientas; el servidor consulta datos del proyecto y coordina las operaciones de ISTRAM.

**Estado: versión candidata 0.2.0-rc.1 para revisión técnica.** Las consultas, el protocolo y los cambios en copias tienen pruebas automatizadas. El control nativo y el flujo BIM requieren validación con ISTRAM.

## Revisar el proyecto

- [Código y cambios propuestos](https://github.com/StvC88/MCP-Istram-Tecopy/pull/1).
- [Guía breve para Buhodra Ingeniería](docs/REVIEW.md): recorrido del código y decisiones que necesitan contraste con el fabricante.
- [Alcance del MCP](docs/SCOPE.md): áreas oficiales y orden de desarrollo.
- [Plan vigente](docs/PLAN.md): pasos hasta la prueba con el proyecto abierto.

## Qué incluye

- Consultar instalación, comandos documentados, proyecto, ejes, rasantes y clasificación IFC.
- Preparar cambios sobre copias, comprobar hashes y recuperar archivos.
- Consultar la sesión de Windows y ejecutar operaciones mediante recetas locales verificadas.
- Validar IFC con IfcOpenShell.

El catálogo de comandos es una referencia documental. No implica que todos puedan ejecutarse mediante el MCP. No se distribuye un adaptador certificado.

## Cómo funciona

Cliente de IA → servidor TypeScript → archivos del proyecto o trabajador Python → ISTRAM / IfcOpenShell.

El servidor usa el SDK oficial de MCP, transporte stdio y argumentos validados. Las operaciones nativas se ejecutan en serie y comprueban el proyecto de destino. [Arquitectura](docs/ARCHITECTURE.md).

## Instalar y comprobar

Node 22.14 o posterior y Python 3.12 recomendado.

~~~powershell
npm ci
npm run typecheck
npm test
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r python/requirements.txt
.\.venv\Scripts\python.exe -m unittest discover -s python -p "test_*.py"
~~~

Configurar el cliente con [examples/mcp.json](examples/mcp.json). Solo requiere rutas locales; la IA pertenece al cliente MCP.

## Prueba en ISTRAM

La primera prueba sobre una sesión abierta será de consulta. Antes de guardar, recalcular o exportar se contrastarán manuales, curso y selectores reales. El flujo de modificación y BIM se probará en una copia identificada del proyecto. [Procedimiento de aceptación](docs/ACCEPTANCE.md).

## Documentación

[Herramientas y configuración](docs/USAGE.md) · [Adaptador nativo](docs/ADAPTER.md) · [Fuentes y pendientes](docs/SOURCES.md).

Este repositorio es la única base de desarrollo vigente. No contiene proyectos de clientes, binarios, licencias ni copias de manuales del fabricante.
