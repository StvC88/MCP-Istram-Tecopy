# Prueba de instalación y eje 2D

Fecha: 2026-10-09. Resumen público; los archivos, rutas, registros y datos del proyecto se conservan localmente.

## Resultados comprobados

- Servidor stdio registrado en Codex como istram, con Node y entorno virtual Python.
- Conexión real mediante el cliente SDK de MCP: 19 herramientas y 4 recursos enumerados.
- worker_health: importación correcta de pywinauto e IfcOpenShell; perfil de adaptador ausente.
- ISTRAM abierto, versión 26.09.09.04 de 64 bits observada en pantalla.
- project_copy: 46 archivos copiados; tmp y res excluidos explícitamente por bloqueos de la sesión; hashes de archivos copiados comprobados.
- En la copia se añadió un eje con una alineación fija por dos puntos, radio cero y PK inicial cero. Se creó y calculó mediante Computer Use en la interfaz de ISTRAM, no mediante operation_start.
- El cálculo individual mostró «ERRORES 0». El cálculo general de los ejes existentes no fue una validación del proyecto completo.
- CEJ y POL guardados por ISTRAM en la copia. project_inspect leyó el nuevo eje y su referencia CEJ.
- El ALI generado se copió a la carpeta gestionada. alignment_read devolvió una recta con length=100, el punto final y ningún registro desconocido. Los comentarios del archivo nativo documentan sus tipos; el lector conserva units=unspecified y writeValidated=false.
- Compilación y comprobación de tipos correctas; 20 pruebas TypeScript y 5 Python aprobadas.

## Incidencia de directorio y recuperación

Cargar el POL de la copia no cambió la carpeta actual de la sesión existente. ISTRAM generó resultados temporales y modificó tres archivos de recuperación en la carpeta anterior. No se guardó el nuevo POL/CEJ sobre el proyecto original.

Se volvió a cargar el proyecto inicial y se restauraron los tres archivos de recuperación desde el inventario inicial, conservando también sus versiones anteriores a la restauración para auditoría local. La comparación final de 44 archivos legibles no detectó diferencias. Dos registros de sesión estaban bloqueados; tmp y res quedaron fuera de esta comprobación. No afirmar que todos los archivos de la sesión permanecieron inalterados.

El intento de abrir el lanzador para iniciar una sesión en la carpeta de la copia caducó sin aprobación. La sesión quedó de nuevo en el proyecto inicial; la prueba queda guardada en la copia.

## Mejoras incorporadas y pendientes

Se incorporaron exclusiones explícitas documentadas en project_copy, diagnóstico por importación real de dependencias y reconocimiento de istramX.exe en snapshot. Las pruebas cubren el filtrado de carpetas, su alcance de hashes y la selección del proceso de ventana.

session_snapshot falló al ejecutar tasklist en el entorno de prueba. La inspección por Computer Use confirmó la ventana; el fallo del trabajador no prueba ausencia de sesión.

Pendiente: validar el acceso del trabajador desde el servidor iniciado por Codex, verificar la carpeta actual en la aceptación del adaptador y completar sus 20 ejecuciones en dos sesiones. Añadir una operación de creación de ejes solo después de contrastar sus parámetros, controles y postcondiciones. Esta prueba no certifica geometría 3D, rasantes, secciones, edición nativa por lotes ni generación/exportación BIM.
