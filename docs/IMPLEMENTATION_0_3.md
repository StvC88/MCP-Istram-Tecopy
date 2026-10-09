# Mejoras implementadas y verificación de ISTRAM MCP 0.3

Fecha: 9 de octubre de 2026. Versión: 0.3.0-rc.1. Rama: `codex/istram-stable`.

El servidor ofrece 25 herramientas. Permite preparar y comprobar geometría de ejes, redes de tuberías y contornos de cunetas, cajones, muros, túneles y detalles, además de preparar cambios recuperables por listado de elementos. El resultado de creación es un paquete DXF/JSON de intercambio: la importación, cálculo, guardado y reapertura en ISTRAM siguen pendientes de aceptación nativa.

## Capacidades de creación disponibles

- `alignment_design_preview`: polilínea XY en metros, PK inicial y final, longitud, azimut desde el norte en grados y gon. Rechaza segmentos nulos. Los vértices no definen radios, clotoides o acuerdos.
- `drainage_design_preview`: nodos y tuberías, conectividad, identificadores únicos, dirección de flujo, pendiente, longitud y recubrimiento en extremos. Usa cota de solera; el recubrimiento se mide hasta la clave de la tubería. Admite cotas distintas de entrada/salida en los enlaces de un nodo para preparar saltos. No genera un pozo ni un segmento vertical nativo.
- `section_design_preview`: vértices ordenados de cuneta, cajón, muro, túnel o detalle. Comprueba cierre requerido, área, perímetro, sentido, cruces y retrocesos. Representa un contorno; no define espesores, huecos, armado, revestimientos, cálculo estructural o hidráulico.
- `design_package_prepare`: genera `preview.dxf`, `design.json` y manifiesto con SHA-256 en `.istram-mcp/deliverables` de una copia gestionada. Mantiene los archivos nativos. Repetir el mismo requestId e inputs devuelve el paquete existente; otras entradas o artefactos alterados se rechazan.
- `usage_workflow_plan`: consulta requisitos, herramientas presentes, evidencia y aceptación de cada una de las 24 áreas.
- `project_changes_preview`: pagina cambios y resume un lote antes de aplicar. La edición nativa exige un perfil de formato y adaptador verificados.

Las coordenadas de planta requieren un CRS explícito declarado por el usuario; no se transforma ni certifica ese CRS. Las secciones usan coordenadas locales y metros. Los DXF son polilíneas 3D R2000, con `$INSUNITS=6`; las líneas de tubería están en el eje del diámetro, no en la solera. Importarlos en el módulo apropiado exige comprobar unidades, anclaje y orientación en ISTRAM.

### Ejemplo de eje de 100 metros

Llamar `alignment_design_preview` con:

```json
{"kind":"alignment","units":"m","crs":"sistema local del proyecto","originStation":0,"points":[[0,0],[100,0]]}
```

Tras `project_copy`, llamar `design_package_prepare` con `projectId` de esa copia, un `requestId` propio y el mismo objeto dentro de `design`. El ejemplo tiene origen local sintético; no se debe trasladar directamente a un proyecto georreferenciado.

### Ejemplo de tubería

```json
{"kind":"drainage","units":"m","crs":"sistema local del proyecto","gravity":true,"minCoverM":1,"nodes":[{"id":"A","x":0,"y":0,"invertZ":10,"groundZ":12},{"id":"B","x":100,"y":0,"invertZ":9,"groundZ":12}],"links":[{"id":"T1","from":"A","to":"B","diameterM":0.5}]}
```

Resultado esperado: 100 m en planta, pendiente del 1 % y recubrimientos de 1,5 y 2,5 m. El terreno intermedio, capacidad hidráulica, pérdidas, pozos, zanjas y capas requieren comprobaciones adicionales.

### Ejemplo de contorno de cajón

```json
{"kind":"section","sectionType":"box_culvert","units":"m","coordinateFrame":"local_section","closed":true,"vertices":[[0,0],[4,0],[4,2],[0,2]]}
```

Área del contorno: 8 m²; perímetro: 12 m. No equivale al área de hormigón ni al hueco hidráulico de un cajón. Para una cuneta usar `sectionType: "ditch"` con contorno abierto o cerrado según el vector gráfico requerido. Los códigos de referencia de los tutoriales son ejemplos locales, no valores universales.

## Fiabilidad y uso por otras personas

- Las carpetas excluidas se saltan antes de recorrer su contenido, incluso si este es inaccesible. Se registra qué exclusiones están presentes; su número de archivos queda `null` cuando no se enumera.
- Las advertencias de dependencias se agrupan por archivo conservando cada proyecto y etiqueta. Las dependencias ausentes/externas siguen necesitando resolución.
- Los registros nativos y cambios disponen de paginación; se preservan encoding, BOM, saltos de línea y hashes.
- Las operaciones devuelven errores estructurados. Un fallo al persistir el diario impide iniciar la acción o conserva el bloqueo si el resultado no puede registrarse. Los diarios antiguos siguen siendo legibles.
- Una interrupción entre dos escrituras conserva estado `uncertain`, rechaza repetición automática y permite restaurar tras comprobar backups y conflictos. La restauración se verifica por hash antes de marcarse completada.
- Se exige la identidad del proyecto y el directorio de trabajo activo antes de escribir mediante recetas. Se comprueban los archivos originales antes y después de las operaciones nativas. Una discrepancia requiere inspección.
- `close_project` usa una receta de cierre normal y verifica salida del proceso; no termina ISTRAM a la fuerza.
- El trabajador y los scripts detectan `.venv` de la instalación. No dependen de las rutas personales de quien desarrolló el MCP. `ISTRAM_PYTHON` conserva prioridad si se configura.

## Validación IFC reforzada

`ifc_validate` conserva la validación de esquema/reglas y añade expectativas opcionales: `minProducts`, `minGeometryProducts`, `expectedLengthUnitToMetres`, `expectedProjectedCrs` y `requiredProperties` con clase, PSET, propiedad y valor esperado. Las propiedades pueden restringirse a una clase para evitar exigir el mismo PSET a todo el modelo. Si la clase no tiene objetos coincidentes, la expectativa falla.

La geometría mínima exige `geometry: true` y productos con vértices. Un IFC vacío puede pasar la validación básica de esquema; usar las expectativas del proyecto para aceptar una exportación. Estos controles no comparan todavía cantidades, continuidad de alineaciones o terreno con el modelo nativo.

## Pruebas reproducibles

Desde la raíz del repositorio:

```powershell
npm ci
npm run typecheck
npm test
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r python/requirements-test.txt
npm run test:python
npm run doctor
npm run smoke
npm run test:dxf
```

`smoke` crea exclusivamente archivos sintéticos en `.local/smoke`, comprueba 25 herramientas por stdio, siete paquetes, 24 contratos y un lote de 350 elementos. Verifica que los originales y los archivos nativos de la copia no cambien. El perfil nativo se desactiva solo para ese proceso de prueba y se exige el rechazo `ADAPTER_REQUIRED`; no se pulsa ningún control de ISTRAM. La prueba de aplicación/restauración con guardia simulada pertenece a la regresión y no cuenta como escritura nativa certificada.

`test:dxf` abre los siete paquetes con ezdxf y compara entidades, coordenadas, cierre, capas y metros sin reparaciones. No certifica su importación en ISTRAM. `doctor` informa dependencias, versión observada, herramientas y disponibilidad del adaptador. CI incluye Windows/Linux y Node 22/24; su resultado remoto debe comprobarse en GitHub.

## Contraste renovado de fuentes

Se utiliza el [canal enlazado de Alex Matos](https://www.youtube.com/@AlexMatosd/videos); el nombre «Aldo» no tiene todavía otro enlace confirmado. El inventario contiene 120 vídeos y ahora 16 transcripciones contrastadas. No se afirma haber visto íntegramente todos los vídeos.

- [Cunetas vectoriales](https://www.youtube.com/watch?v=hlapFNA5q4A), 00:00–03:25: contorno y revestimiento separados, vértices/anclaje y referencia contra subrasante. Se incorporan los controles de contorno; no se inventa un escritor VOL.
- [Rasante de tuberías con saltos](https://www.youtube.com/watch?v=dHNxb7dFvGg): superficies proyectadas prioritarias, revisión de perfiles y cotas en saltos. Se añaden cotas por extremo de enlace; el procedimiento de cálculo nativo queda pendiente.
- Muros variables, túnel vectorial, anotación de transversales y cajón/IFC: se verificaron sus páginas; la exportación de transcripción no estuvo disponible en esta nueva revisión. No se eleva su nivel de evidencia por ese intento.

El [cuaderno solicitado](https://notebook.google.com/notebook/66dd8f87-9726-490d-a9ce-739b73aee639) se verificó en la sesión Google activa: «ISTRAM Clases Chile», 13 fuentes. El inventario contiene Clase 1–9, un PDF de superficies, ODT, RCEclass y el webinar de seguimiento. Se obtuvo una nueva síntesis con citas para planta/rasante/secciones, cunetas, ODT, tuberías/pozos, muros, túneles, planos e IFC. Las referencias `.isa/.isam` de la síntesis no tienen semántica verificada y no se usan para crear escritores.

En esta revisión el MCP de Notebook devolvió textos de carga y posteriormente una sesión de otro cuaderno; esas respuestas se descartaron. El contraste válido proviene de la consulta y del inventario observados en el cuaderno correcto mediante la interfaz. La síntesis no sustituye la lectura de sus trece originales.

La [documentación oficial de redes](https://istram.net/istram-news-44/) describe nodos, arcos, alternativas y clasificación BIM; las [soluciones oficiales](https://istram.net/istram/caracteristicas/soluciones/) fijan el alcance general. Ninguna evidencia usada aquí certifica una API pública para escribir estos formatos.

## Cobertura de las 24 áreas

Preparación geométrica o de texto probada: ejes en planta; secciones; drenaje; tuberías; túneles; estructuras; dibujos/detalles; edición de archivos por lotes. En túneles, estructuras y detalles se prepara únicamente el contorno.

Consulta o requisitos, con capacidades completas pendientes: contexto de proyecto; CRS y transformaciones; cartografía; superficies; revisión normativa; rasantes; taludes; explanaciones; ferrocarril; cantidades; seguimiento de obra; replanteo; BIM; intercambio; visualización; señalización. La lectura ALI/RAS, inspección y validación IFC existentes mantienen sus límites documentados.

**Ninguna de las 24 áreas tiene aceptación nativa completa.** No hay perfil certificado instalado. La versión permanece candidata: quedan recetas reales para cada flujo, importación, terreno, licencias, cálculo y comprobación tras guardar/reabrir. La prueba anterior del eje de 100 m mediante interfaz se conserva como evidencia asistida, no como ejecución nativa del MCP.

El evaluador ahora exige cambios en la copia, apertura/cálculo/guardado/cierre/reapertura, longitud ALI contrastada con tolerancia, configuración/generación/exportación BIM y validación del IFC exportado con geometría no vacía. Cada ejecución debe incluir dos identificadores nativos distintos. Promover un perfil requiere veinte informes distintos, hashes correctos y revisión de ingeniería, además de los criterios de [ACCEPTANCE.md](ACCEPTANCE.md).
