# Revisión técnica para Buhodra Ingeniería

## Objetivo

Comprobar una integración MCP sencilla y mantenible para consultar proyectos y, tras validar el adaptador, controlar configuración, cálculo y BIM en ISTRAM/ISPOL.

La revisión puede realizarse sin ejecutar ISTRAM: instalar dependencias Node, ejecutar npm test y leer los puntos siguientes.

## Recorrido del código

1. src/server.ts: herramientas MCP y validación de argumentos.
2. src/config.ts y src/parsers.ts: detección, lectura de formatos y catálogo documental.
3. src/projects.ts: copias, cambios comprobados y recuperación.
4. src/jobs.ts y src/bridge.ts: cola de operaciones y comunicación con Python.
5. python/worker.py: consulta de Windows, recetas nativas y validación IFC.
6. src/tests/ y python/test_worker.py: pruebas automatizadas.

## Consultas al fabricante

- ¿Existe una API, SDK, CLI o mecanismo de automatización admitido que deba reemplazar la automatización de interfaz?
- ¿Qué archivos son fuentes de diseño y cuáles son resultados temporales? ¿Qué revisiones de formato y codificaciones se pueden leer y escribir?
- ¿Cómo comprobar inequívocamente el proyecto activo, el fin del cálculo y la persistencia de los cambios?
- ¿Qué comandos habituales y ajustes BIM conviene admitir primero?
- ¿Cómo consultar módulos licenciados y verificar la versión en ejecución?
- ¿Qué entidades, propiedades, unidades y coordenadas debe conservar una exportación IFC 4.3?

No se afirma que falten interfaces del fabricante: esas posibilidades siguen pendientes de confirmación.

## Criterio de aceptación

Consultas reproducibles; errores explícitos; operaciones limitadas a la copia identificada; resultados de cálculo contrastados en ISTRAM; exportación IFC validada. Una prueba de protocolo correcta no certifica el diseño vial ni el adaptador.

El protocolo no admite código Python, comandos de shell ni recetas aportadas por el cliente de IA. Las recetas se configuran localmente y se vinculan al ejecutable instalado.

## Resultado esperado de la revisión

Anotar compatibilidad, correcciones necesarias y vía de integración recomendada en la revisión de código de GitHub. No hace falta acceso a proyectos privados para revisar esta base.
