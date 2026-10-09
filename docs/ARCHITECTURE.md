# Arquitectura y límites de confianza

Cliente MCP -> servidor TypeScript v2 -> parsers / almacén de copias / operaciones -> trabajador Python -> Windows o IfcOpenShell.

## Estado observable

El diagnóstico devuelve versión histórica con procedencia y módulos licenciados desconocidos. La presencia de librerías no prueba licencia. Un perfil verificado está asociado al SHA-256 del Istram.exe instalado.

El servidor valida los argumentos con Zod; devuelve texto y structuredContent. Stdout contiene exclusivamente protocolo MCP; los errores de arranque van a stderr.

## Cambios recuperables

Cada copia contiene un manifiesto privado .istram-mcp/copy.json. Cambios exactos conservan codificación y saltos de línea. Cada solicitud tiene identificador, huella del contenido, hashes antes/después y respaldo. Las solicitudes repetidas devuelven el resultado anterior; reutilizar un identificador para otra modificación es un error.

El bloqueo exclusivo evita dos escritores en una copia. La sustitución es por fichero: NO hay atomicidad global entre varios ficheros ni entre disco y la aplicación. Un fallo parcial queda uncertain y requiere inspección/restauración sin sobrescribir cambios posteriores.

## Sesión y operaciones

La interfaz nunca recibe código arbitrario de la IA ni cadenas de shell. Solo recetas locales con selectores, controles y postcondiciones. Invocar, editar un control, esperar y comprobar texto son las primitivas permitidas.

La pérdida de la respuesta puede significar que ISTRAM sí actuó: por eso no se reintenta una acción nativa. La cancelación se permite antes de ejecutar; no se termina ISTRAM ni se interrumpe un cálculo a ciegas.

## Cobertura

Datos instalados y consultas: implementados. Preparación y recuperación de copias: implementadas y pruebas sintéticas.
Control nativo: motor de recetas implementado; perfil y prueba real pendientes.
Creación geométrica completa, recálculo y BIM en la instalación del usuario: NO certificados.

IFC: validación de esquema/WHERE, estructura de proyecto, unidades, PSETs exigidos y geometría opcional. No prueba automáticamente conformidad normativa vial, completitud de georreferenciación ni equivalencia de cantidades con ISTRAM.
