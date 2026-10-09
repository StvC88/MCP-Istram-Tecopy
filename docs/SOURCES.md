# Registro de fuentes

Fecha de investigación: 2026-10-09.

## Alcance acordado

- [Soluciones oficiales](https://istram.net/istram/caracteristicas/soluciones/), consultada el 2026-10-09. Referencia principal de alcance indicada por el usuario.
- [Características](https://istram.net/istram/caracteristicas/), consultada el 2026-10-09. Complementa módulos y OpenBIM.

## Primarias consultadas

- SDK MCP TypeScript: https://github.com/modelcontextprotocol/typescript-sdk — v2 estable, especificación 2026-07-28; paquetes 2.3.1 comprobados en npm.
- Especificación: https://modelcontextprotocol.io/specification/2026-07-28.
- IfcOpenShell: https://docs.ifcopenshell.org/autoapi/ifcopenshell/validate/index.html y https://pypi.org/project/ifcopenshell/ — validación y versión 0.9.0.
- pywinauto: https://pypi.org/project/pywinauto/ — versión 0.6.9.
- ISTRAM: https://istram.net/descargas/ y https://istram.net/novedades-istram-10-2026/ — las descargas requieren sesión de cliente.
- Publicación de Alex Matos sobre transformar una rasante dibujada en AutoCAD en datos de ISTRAM: https://es.linkedin.com/posts/alex-matos-ag_rasante-desde-autocad-a-istram-activity-7153212226038874112-RRAG. Se consultó la descripción escrita del autor; no se verificó el procedimiento completo del vídeo.

## Actualización de revisión de uso

Acceso al cuaderno correcto confirmado por MCP: https://notebook.google.com/notebook/66dd8f87-9726-490d-a9ce-739b73aee639. Título «ISTRAM Clases Chile». Dos consultas sustantivas identificaron las áreas del curso y las 13 fuentes reportadas por Gemini, incluida Clase 8. No se presume verificación original independiente de las síntesis.

Canal revisado mediante Browser: 120 títulos inventariados y 15 transcripciones automáticas contrastadas. [Evidencia con marcas temporales](USAGE_EVIDENCE.md), [inventario](research/alex-matos-videos.tsv) y [revisión](USAGE_REVIEW.md). Continúa pendiente la revisión íntegra audiovisual y el contraste de fuentes originales para certificar cada receta.

## Limitaciones anteriores, resueltas parcialmente por esta revisión

- El acceso anterior al canal y cuaderno había fallado. El enlace incompleto terminaba en ee63; el enlace correcto facilitado ahora termina en ee639.
- La consulta e inventario actuales resuelven ese acceso; no equivalen a la revisión completa de todos los vídeos y clases antes de la prueba de sesión.

## Material local revisado

- Ayuda instalada: arranque.html, OL_proyecto.html, OL_BIM_opciones.html, OL_BIM_arbol.html y OL_rasantes_ficheros.html. Se revisaron apartados relevantes para preparar la consulta y el flujo BIM; no todo el conjunto de 340 páginas.
- Respaldo bibliográfico: índice y síntesis de las clases Chile 1–9, ODT, RCEclass, seguimiento y superficies. Son material secundario; no equivalen a leer las fuentes originales del cuaderno ni sus vídeos.
- Identificador completo confirmado por el enlace actual y la consulta MCP: 66dd8f87-9726-490d-a9ce-739b73aee639.
- comandos.cfg, configuración de librerías y mapeos IFC observados en la instalación. Se publican referencias y conclusiones, no copias de material del fabricante.

## Proceso de incorporación

Inventariar vídeos/documentos relevantes; extraer pasos, contexto, parámetros, errores y resultados con URL y marcas de tiempo. Contrastar cada recomendación de NotebookLM con sus fuentes originales. Registrar versión y evidencia. Convertir cada flujo en una receta y escenario de aceptación.

## Proyectos relacionados

- https://github.com/shuji-bonji/ifc-core-mcp — referencia de entidades IFC.
- https://github.com/ekkodale/IFC-MCP — consulta de modelos IFC.
- https://github.com/Show2Instruct/ifc-bonsai-mcp — control de BIM en Blender/Bonsai.

La búsqueda no confirmó un MCP público que controle directamente todos los comandos de ISTRAM. Eso no demuestra que no exista.
