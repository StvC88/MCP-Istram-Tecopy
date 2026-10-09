# Edición por lotes de archivos de ISTRAM

El enfoque aportado por el usuario evita repetir menús para cientos de elementos: exportar un listado, localizar sus archivos y cambiar los parámetros revisados. Es automatización sobre formatos nativos; no demuestra una API pública del fabricante. La captura aportada no permite deducir la gramática de esos archivos.

## Flujo implementado

1. `project_inspect`: comprobar carpeta, archivos y referencias. Resolver dependencias externas antes de usar una copia.
2. `project_copy`: crear copia administrada y conservar hashes del original.
3. Obtener el listado de elementos y analizar el formato concreto de cada archivo asociado. La conversión automática de un listado arbitrario aún no está implementada.
4. `project_prepare_batch`: enviar identificadores únicos y cambios exactos de líneas. Revisar `changes`, `before`, `after` y `batch` del plan devuelto. Los archivos de diseño permanecen intactos en esta etapa.
5. `project_apply_changes`: aplicar ese `requestId` únicamente con ISTRAM cerrado y perfil local verificado para binario, encoding y revisión/gramática de los formatos.
6. Abrir la copia mediante receta comprobada, guardar/reabrir y recalcular; cotejar resultados por elemento, referencias y geometría. Cambiar archivos no equivale a regenerar el modelo.
7. Si procede recuperar, cerrar ISTRAM y usar `project_restore_changes`. Se rechaza sobrescribir ediciones posteriores incompatibles.

## Entrada

`project_prepare_batch` recibe `projectId`, `requestId` y `elements`. Cada elemento tiene `elementId` y `changes`. Cada cambio tiene `file` relativo a la copia, `line` de base 1, `expected` y `replacement` de una sola línea.

Ejemplo **sintético** de contrato; las líneas `width` no son una gramática ISTRAM validada:

```json
{
  "projectId": "00000000-0000-4000-8000-000000000001",
  "requestId": "lote-revision-01",
  "elements": [
    {
      "elementId": "elemento-001",
      "changes": [
        {"file": "config.cfg", "line": 1, "expected": "width 7", "replacement": "width 8"}
      ]
    },
    {
      "elementId": "elemento-002",
      "changes": [
        {"file": "config.cfg", "line": 1, "expected": "width 7", "replacement": "width 8"}
      ]
    }
  ]
}
```

Hay dos elementos y un cambio único a un archivo compartido. `batch.elements` conserva los destinos de cada elemento; `inputChanges`, `uniqueChanges` y `filesCount` permiten revisar el alcance.

Máximos: 1000 elementos, 100 cambios por elemento en el esquema MCP y 10000 cambios de entrada en total. Un lote no vacío y cada elemento necesitan cambios explícitos. Las rutas equivalentes se normalizan antes de deduplicar, respetando el sistema operativo.

## Condiciones y rechazo

- Identificadores vacíos/repetidos: rechazo.
- Dos elementos requieren texto distinto para una misma línea: `BATCH_CONFLICT`, sin plan aplicable.
- Texto esperado distinto del actual: rechazo antes de crear el plan.
- Archivo ausente, escape de carpeta, enlace simbólico o extensión no admitida: rechazo.
- Archivo detectado como binario: rechazo. `.per` solo se puede preparar si pasa la lectura de texto; no se extrapola a todos los perfiles de todas las versiones.
- `requestId` repetido con el mismo manifiesto: mismo plan; con elementos/cambios diferentes: conflicto de idempotencia.
- Cambios externos entre preparación y aplicación: rechazo por hashes.
- Perfil no verificado o reglas de formato/revisión ausentes: aplicación bloqueada. No se ofrece una regla universal para cualquier línea.

El plan es local y puede contener identificadores y contenido de proyecto; no debe publicarse como parte de la revisión en GitHub.

## Qué se comprobó

Prueba sintética de 350 elementos: la preparación conserva el archivo, la aplicación cambia las 350 líneas, la restauración recupera el texto completo y el hash del original no cambia. Pruebas adicionales cubren solicitudes compartidas compatibles/incompatibles, aliases de rutas, entradas obsoletas, escapes, duplicación de IDs y contenido binario.

La guardia nativa se sustituye por una función de prueba en el ensayo de 350 elementos. Por tanto, ese ensayo acredita la mecánica del lote, no los formatos CEJ/PER/VOL ni el resultado en ISTRAM. La prueba separada de guardia conserva el rechazo de aplicación sin un adaptador verificado.

## Siguiente capacidad

Implementar un importador del listado de salida real, un grafo de referencias CEJ/VOL/PER/otros archivos y reglas de parámetros tipados con evidencia por revisión. Las reglas deben identificar registros de manera inequívoca, conservar campos desconocidos y detectar referencias compartidas. La modificación por texto reduce interacción repetitiva; ISTRAM sigue siendo necesario para reabrir, calcular y validar el diseño.
