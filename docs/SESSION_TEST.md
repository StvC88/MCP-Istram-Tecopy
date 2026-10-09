# Primera prueba con una sesión abierta

**Estado: conexión y consultas ejecutadas; prueba 2D asistida por interfaz realizada.** Véase [resultado y límites](LIVE_TEST_2D.md). La ejecución nativa mediante recetas MCP no está certificada.

## Antes de probar

Completar la revisión de manuales aplicables, curso y vídeos solicitados. Registrar las referencias utilizadas y la versión de ISTRAM. El respaldo local del curso contiene síntesis temáticas, no las transcripciones completas.

Confirmar en pantalla la carpeta y el archivo del proyecto abierto. No deducir esa identidad por el último proyecto del historial.

## Prueba de consulta

1. Conectar el cliente al MCP siguiendo examples/mcp.json.
2. Consultar tools/list y el recurso istram://system/coverage.
3. Ejecutar istram_detect y worker_health; registrar versión observada y dependencias.
4. Ejecutar session_snapshot. Debe devolver la sesión y controles observables. Un fallo de acceso no equivale a una sesión ausente.
5. Ejecutar project_inspect con la carpeta confirmada; revisar referencias ausentes o externas.
6. Consultar native_records_read, alignment_read o profile_read solo sobre archivos identificados como tales.
7. Comparar datos con la pantalla de ISTRAM. Registrar qué valores quedan sin interpretación validada.
8. Comprobar que los archivos de diseño consultados conservan sus hashes. Los cambios externos simultáneos se registran, no se sobrescriben.

Resultado: conexión, herramientas y consultas comprobadas. Esta prueba no certifica guardado, cálculo ni BIM.

## Prueba posterior en copia

Usar project_copy e identificar inequívocamente la copia cargada. Comprobar además la **carpeta actual de la sesión**: cargar un POL con ruta absoluta no cambia necesariamente el directorio de trabajo. La ayuda instalada arranque.html indica seleccionar la carpeta de trabajo en el lanzador antes de iniciar ISTRAM. Los archivos de recuperación y resultados temporales pueden escribirse en el directorio anterior aunque el título muestre la copia.

Si una sesión mantiene archivos bloqueados, project_copy admite excludeDirectories con nombres explícitos de carpetas del primer nivel. Las exclusiones se registran en el inventario: no constituyen una copia completa ni una verificación de los archivos excluidos. En la prueba se excluyeron tmp y res; no aplicar esas exclusiones automáticamente a otros proyectos.

Comprobar eje, rasante, sección, alternativas y grupos activos antes de calcular. Para la primera prueba geométrica, calcular solo el eje de prueba y registrar sus propios errores.

Según la ayuda instalada OL_BIM_opciones.html, el proyecto debe estar calculado antes de generar BIM; la selección del árbol determina el alcance. Registrar el nodo seleccionado y los objetos activos antes de generar o exportar.

Verificar configuración de clases y atributos; persistencia de estado; esquema IFC disponible en la versión instalada; geometría y datos exportados. La ayuda antigua describe formatos IFC anteriores: no usar esa lista como prueba de las opciones actuales.

## Evidencia

Informe privado local con fecha, versión/hash del ejecutable, proyecto identificado, herramientas invocadas, resultados y hashes. Publicar en GitHub solo un resumen sin datos del proyecto.

Fuentes: ayuda instalada OL_proyecto.html, OL_BIM_opciones.html, OL_BIM_arbol.html, OL_rasantes_ficheros.html y arranque.html; fuentes docentes y vídeos completarán los casos específicos.
