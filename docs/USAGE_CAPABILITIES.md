# Capacidades de uso y contratos propuestos

Cada contrato es una propuesta para desarrollar el MCP. Ningún nombre de herramienta propuesto corresponde a una API oficial confirmada ni se registra como operación ejecutable.
El catálogo consultable `usage_capabilities` expone estos mismos requisitos. Cobertura actual parcial significa lectores o infraestructura, no el flujo nativo completo.

## Proyecto, sesión y dependencias (`project_context` · P0)

Herramientas actuales: `istram_detect`, `worker_health`, `session_snapshot`, `project_inspect`, `project_copy`.
Propuestas: `project_context_read`, `project_dependencies_resolve`.

Entradas requeridas:
- Ruta y archivo exactos del proyecto
- Versión/hash del ejecutable y módulos comprobados
- Ejes, grupos, alternativas y estado de cálculo activos

Procedimiento funcional:
1. Identificar sesión y proyecto
2. Resolver referencias internas y externas
3. Crear copia y verificar identidad antes de modificar

Aceptación:
- La identidad observada coincide con la copia
- No faltan dependencias requeridas
- Hashes del original conservados

Fallos y límites:
- El snapshot no prueba licencia ni proyecto cargado
- Referencias con rutas externas pueden dejar una copia incompleta

Evidencia:
- [Vídeo 55](https://www.youtube.com/watch?v=JND_TtHAsIU) · inventory_only
- [Vídeo 61](https://www.youtube.com/watch?v=EgBAxnm-mF8) · inventory_only
- [Vídeo 63](https://www.youtube.com/watch?v=xa83f7MMTx4) · inventory_only
- Cuaderno: Clase 1 · síntesis de Gemini, fuente original pendiente de contraste.
- Cuaderno: Clase 9 · síntesis de Gemini, fuente original pendiente de contraste.

## CRS y transformaciones (`coordinate_systems` · P0)

Herramientas actuales: `project_inspect`.
Propuestas: `crs_read`, `crs_transform_plan`.

Entradas requeridas:
- CRS origen/destino y datum vertical
- Unidades XYZ, huso y hemisferio
- Parámetros de transformación y puntos de control

Procedimiento funcional:
1. Leer CRS y unidades
2. Comprobar transformación requerida
3. Aplicar a copia y comparar puntos de control

Aceptación:
- Residuales dentro de tolerancia del proyecto en m
- CRS persistente al reabrir
- Exportación mantiene posición y escala

Fallos y límites:
- UTM y PTL no son intercambiables sin parámetros
- No inferir CRS por el tamaño de las coordenadas

Evidencia:
- Cuaderno: Clase 2 · síntesis de Gemini, fuente original pendiente de contraste.
- Cuaderno: Clase 4 · síntesis de Gemini, fuente original pendiente de contraste.

## CAD, GIS, imágenes y nubes de puntos (`cartography` · P1)

Herramientas actuales: `native_records_read`.
Propuestas: `cartography_import`, `pointcloud_filter`, `raster_import`.

Entradas requeridas:
- Archivos y formatos reales
- Capas/códigos y correspondencias
- CRS, unidades, extensión y resolución en m

Procedimiento funcional:
1. Inspeccionar entrada y opciones de conversión
2. Importar y organizar capas
3. Conservar Z y líneas de ruptura relevantes

Aceptación:
- Entidades/cotas comparadas con origen
- Extensión y coordenadas correctas
- Inventario de pérdidas o elementos no convertidos

Fallos y límites:
- No convertir etiquetas de cota en geometría sin verificar
- Capacidad y tiempo de vídeo no garantizan rendimiento en otro equipo

Evidencia:
- [Vídeo 12](https://www.youtube.com/watch?v=1czMgyLnggw) · transcript_reviewed · 00:10–01:32
- [Vídeo 29](https://www.youtube.com/watch?v=e3HEYAvw-V4) · inventory_only
- [Vídeo 47](https://www.youtube.com/watch?v=WsS6ID0Vk3Y) · inventory_only
- [Vídeo 59](https://www.youtube.com/watch?v=Rfnpd4UZIBU) · inventory_only
- [Vídeo 70](https://www.youtube.com/watch?v=veI_ELOtqWA) · inventory_only
- [Vídeo 74](https://www.youtube.com/watch?v=j8ZadLnrAoc) · inventory_only
- [Vídeo 75](https://www.youtube.com/watch?v=hQdVXSmVxYw) · inventory_only
- [Vídeo 76](https://www.youtube.com/watch?v=K8-hUp03cX4) · inventory_only
- [Vídeo 90](https://www.youtube.com/watch?v=MWcnb6nefV0) · inventory_only
- [Vídeo 116](https://www.youtube.com/watch?v=rGQN9V0OMRY) · inventory_only
- Cuaderno: Clase 2 · síntesis de Gemini, fuente original pendiente de contraste.
- Cuaderno: Clase 3 · síntesis de Gemini, fuente original pendiente de contraste.

## Superficies cartográficas, MDT y TTP (`surfaces` · P1)

Herramientas actuales: `native_records_read`.
Propuestas: `surface_list`, `surface_priority_set`, `surface_triangulate`, `surface_clip`.

Entradas requeridas:
- Superficies con identificador, tipo y origen
- Orden de prioridad y ámbito
- Contorno, rupturas e intervalo de muestreo en m

Procedimiento funcional:
1. Declarar y cargar superficies
2. Triangular/editar según el formato
3. Definir prioridad y regenerar perfiles afectados

Aceptación:
- Cotas muestreadas coinciden con superficie prioritaria
- Triángulos no cruzan contorno o huecos prohibidos
- Dependencias invalidadas cuando cambia terreno

Fallos y límites:
- TTP y superficie cartográfica no son la misma entidad
- Cambiar prioridad altera cortes, rasantes y cantidades

Evidencia:
- [Vídeo 50](https://www.youtube.com/watch?v=7Ktb_TiUkFw) · inventory_only
- [Vídeo 85](https://www.youtube.com/watch?v=zxxDHu9Q9tg) · inventory_only
- Cuaderno: Clase 2 · síntesis de Gemini, fuente original pendiente de contraste.
- Cuaderno: Clase 3 · síntesis de Gemini, fuente original pendiente de contraste.
- Cuaderno: istram-ispol-modelado-superficies-5-pdf-free.pdf · síntesis de Gemini, fuente original pendiente de contraste.

## Ejes, conexiones y ecuaciones de PK (`horizontal_alignment` · P1)

Herramientas actuales: `alignment_read`, `project_inspect`.
Propuestas: `alignment_edit`, `alignment_connect`, `station_equation_set`.

Entradas requeridas:
- Eje/grupo/alternativa y PK en m
- Rectas, radios y parámetros de clotoide en m
- Conexiones, sentido y ecuaciones de PK

Procedimiento funcional:
1. Leer y verificar geometría de partida
2. Definir conexiones y alineaciones
3. Recalcular y comprobar continuidad y estaciones

Aceptación:
- No hay longitudes negativas no justificadas
- Continuidad geométrica y PK contrastados
- Persistencia tras guardar/reabrir

Fallos y límites:
- El lector ALI preserva registros desconocidos y no certifica su semántica
- Los PK pueden no ser monótonos con ecuaciones de empalme

Evidencia:
- [Vídeo 49](https://www.youtube.com/watch?v=QbrE7PfHfmc) · inventory_only
- [Vídeo 64](https://www.youtube.com/watch?v=e_-WAvw9b8U) · inventory_only
- [Vídeo 77](https://www.youtube.com/watch?v=BLZOKZpl2co) · inventory_only
- [Vídeo 91](https://www.youtube.com/watch?v=OlYjbMw_11o) · inventory_only
- [Vídeo 97](https://www.youtube.com/watch?v=8QUiPiaDwaY) · inventory_only
- [Vídeo 113](https://www.youtube.com/watch?v=h38xTG6raB4) · inventory_only
- [Vídeo 114](https://www.youtube.com/watch?v=VDVPzNqKy7k) · inventory_only
- [Vídeo 115](https://www.youtube.com/watch?v=mY0TO1w5U8E) · inventory_only
- Cuaderno: Clase 4 · síntesis de Gemini, fuente original pendiente de contraste.
- Cuaderno: Clase 5 · síntesis de Gemini, fuente original pendiente de contraste.
- Cuaderno: Clase 9 · síntesis de Gemini, fuente original pendiente de contraste.

## Revisión normativa de planta y alzado (`design_checks` · P1)

Herramientas actuales: `alignment_read`, `profile_read`, `istram_command_catalog`.
Propuestas: `design_standard_configure`, `design_check_report`.

Entradas requeridas:
- País, norma, edición y librería verificadas
- Clase de vía y orografía
- Tramos PK inicio/fin en m y velocidad en km/h

Procedimiento funcional:
1. Confirmar tablas aplicables a la versión y al proyecto
2. Configurar velocidades por tramos
3. Revisar planta/rasante y exportar incidencias

Aceptación:
- Cada incidencia identifica eje/elemento/PK y criterio
- Informe coincide con pantalla y revisión de tablas
- Cambio de clase o velocidad actualiza resultados

Fallos y límites:
- Los ejemplos históricos no son normativa vigente
- Un XML no incorpora necesariamente parámetros suficientes de revisión

Evidencia:
- [Vídeo 34](https://www.youtube.com/watch?v=ehhnngNejsg) · inventory_only
- [Vídeo 35](https://www.youtube.com/watch?v=4phtLgZzD0E) · transcript_reviewed · 00:13–02:39; 03:47–05:30
- [Vídeo 36](https://www.youtube.com/watch?v=dk8569Ikmjs) · inventory_only
- [Vídeo 37](https://www.youtube.com/watch?v=CSa3yi31W9E) · inventory_only
- [Vídeo 38](https://www.youtube.com/watch?v=8Ry87hSa4vc) · inventory_only
- [Vídeo 39](https://www.youtube.com/watch?v=tnfNlafMbds) · inventory_only
- [Vídeo 40](https://www.youtube.com/watch?v=s5xsoS7zs-E) · inventory_only
- [Vídeo 73](https://www.youtube.com/watch?v=mKDRYmgRZDA) · inventory_only
- [Vídeo 88](https://www.youtube.com/watch?v=UlIWxIGI7xM) · inventory_only
- Cuaderno: Clase 5 · síntesis de Gemini, fuente original pendiente de contraste.
- Cuaderno: Clase 6 · síntesis de Gemini, fuente original pendiente de contraste.

## Rasantes y perfiles longitudinales (`vertical_alignment` · P1)

Herramientas actuales: `profile_read`.
Propuestas: `profile_extract`, `profile_edit`, `profile_connect`.

Entradas requeridas:
- Eje/alternativa y terreno aplicable
- PK/cotas en m y pendientes con convención explícita
- Tipo y parámetro de acuerdo con unidad declarada

Procedimiento funcional:
1. Extraer perfil de las superficies correctas
2. Diseñar/ajustar vértices y acuerdos
3. Recalcular y cotejar longitudinal y transversales

Aceptación:
- Cotas de puntos de control y pendientes correctas
- Enganches conservados
- No se confunden K, Kv, radios y escalas de dibujo

Fallos y límites:
- La denominación de parámetros cambia según norma y pantalla
- Un perfil leído no valida gálibos ni pendientes del diseño

Evidencia:
- [Vídeo 58](https://www.youtube.com/watch?v=2KylkA1Dg4I) · inventory_only
- Cuaderno: Clase 5 · síntesis de Gemini, fuente original pendiente de contraste.
- Cuaderno: Clase 6 · síntesis de Gemini, fuente original pendiente de contraste.

## Secciones, peraltes, firmes y elementos existentes (`sections` · P1)

Herramientas actuales: `native_records_read`.
Propuestas: `section_template_read`, `section_template_set`, `superelevation_set`, `pavement_layers_set`.

Entradas requeridas:
- Zona PK y lado según sentido del eje
- Anchos/espesores en m y pendientes en % o razón declarada
- Vectores, materiales, peralte y sobreanchos por tramo

Procedimiento funcional:
1. Identificar sección y códigos de cada superficie
2. Definir geometría/capas y reglas por PK
3. Generar transversales y comprobar puntos singulares

Aceptación:
- Sección correcta en límites y transiciones
- Espesores y orientación coherentes
- Materiales y cantidades diferenciados

Fallos y límites:
- Texto genérico PER/VOL no equivale a un modelo semántico
- Pendiente porcentual y razón H:V no se deben mezclar

Evidencia:
- [Vídeo 7](https://www.youtube.com/watch?v=trwhsi-X3Qc) · inventory_only
- [Vídeo 18](https://www.youtube.com/watch?v=rM926QYQtZU) · inventory_only
- [Vídeo 24](https://www.youtube.com/watch?v=7ugAbJHjQiE) · inventory_only
- [Vídeo 31](https://www.youtube.com/watch?v=ZXcvtlZTBXw) · inventory_only
- [Vídeo 51](https://www.youtube.com/watch?v=PBLv10PIk9o) · inventory_only
- [Vídeo 56](https://www.youtube.com/watch?v=7cajvBh16QE) · inventory_only
- [Vídeo 57](https://www.youtube.com/watch?v=xa4u_Y1B8K8) · inventory_only
- [Vídeo 62](https://www.youtube.com/watch?v=G0OeNOc9hQw) · inventory_only
- [Vídeo 65](https://www.youtube.com/watch?v=LRnLQfiGojA) · inventory_only
- [Vídeo 80](https://www.youtube.com/watch?v=YiSZQl9BwaQ) · inventory_only
- [Vídeo 95](https://www.youtube.com/watch?v=IFETHKKP6Ww) · inventory_only
- [Vídeo 96](https://www.youtube.com/watch?v=zevesBrU05c) · inventory_only
- [Vídeo 109](https://www.youtube.com/watch?v=ivzPOYphCSk) · inventory_only
- [Vídeo 105](https://www.youtube.com/watch?v=QdWUCwqvvys) · inventory_only
- Cuaderno: Clase 6 · síntesis de Gemini, fuente original pendiente de contraste.
- Cuaderno: Clase 7 · síntesis de Gemini, fuente original pendiente de contraste.

## Taludes, banquetas y líneas frontera (`slopes` · P1)

Herramientas actuales: `native_records_read`.
Propuestas: `slope_vectors_set`, `slope_transition_set`, `boundary_line_define`.

Entradas requeridas:
- Ejes y lados según su orientación
- Vectores con punto de enganche y unidades en m
- Estratos, intervalos PK y líneas frontera guardadas

Procedimiento funcional:
1. Definir talud paramétrico/vectorial y transiciones
2. Resolver encuentro con terreno y otros corredores
3. Guardar/cargar frontera y recalcular con enlace requerido

Aceptación:
- Sin solapes no previstos entre corredores
- Último vector alcanza terreno
- Banquetas y cambios de material comprobados en 3D y secciones

Fallos y límites:
- Editar una frontera exige redefinirla antes de calcular
- Un vector corto puede no intersectar el terreno

Evidencia:
- [Vídeo 6](https://www.youtube.com/watch?v=xJrA6tkM0Rw) · inventory_only
- [Vídeo 10](https://www.youtube.com/watch?v=56HW-VDILtg) · transcript_reviewed · 00:26–01:11; 01:19–01:45
- [Vídeo 11](https://www.youtube.com/watch?v=tlfLCi7Qsx0) · transcript_reviewed · 00:17–01:58
- [Vídeo 13](https://www.youtube.com/watch?v=Xx9Jak1SJSQ) · inventory_only
- [Vídeo 14](https://www.youtube.com/watch?v=rm7dq1rkITU) · inventory_only
- [Vídeo 22](https://www.youtube.com/watch?v=75pVIBIBBz4) · inventory_only
- [Vídeo 23](https://www.youtube.com/watch?v=34kbdTkYUkk) · inventory_only
- [Vídeo 102](https://www.youtube.com/watch?v=GyPHb9XbhoY) · inventory_only
- Cuaderno: Clase 7 · síntesis de Gemini, fuente original pendiente de contraste.
- Cuaderno: istram-ispol-modelado-superficies-5-pdf-free.pdf · síntesis de Gemini, fuente original pendiente de contraste.

## Explanaciones, plataformas, balsas y embalses (`grading` · P1)

Herramientas actuales: `native_records_read`.
Propuestas: `grading_define`, `grading_generate`, `reservoir_capacity_report`.

Entradas requeridas:
- Polilínea exterior cerrada y cotas en m
- Superficie base/cartográfica y taludes
- Vectores de corte/relleno, materiales y muestreo en m

Procedimiento funcional:
1. Declarar geometría de plataforma y contorno
2. Generar geometría y TTP
3. Integrar por recorte o método expresamente elegido

Aceptación:
- Plataformas multinivel y límites correctos
- Sin huecos o solapes imprevistos
- Área en m² y volumen en m³ conciliados

Fallos y límites:
- No sustituir una plataforma multinivel por cota única
- No fusionar automáticamente superficies si basta recortar

Evidencia:
- [Vídeo 5](https://www.youtube.com/watch?v=J3ffkF9h7XQ) · transcript_reviewed · 00:14–02:26; 03:24–04:24
- [Vídeo 53](https://www.youtube.com/watch?v=1XJDH7OrTVc) · inventory_only
- [Vídeo 83](https://www.youtube.com/watch?v=YMlfNP9sT3k) · inventory_only
- [Vídeo 104](https://www.youtube.com/watch?v=w87jAZYKzPY) · inventory_only
- [Vídeo 117](https://www.youtube.com/watch?v=6UKZAnGK0kU) · inventory_only
- [Vídeo 118](https://www.youtube.com/watch?v=hMayGYK2BgM) · inventory_only
- Cuaderno: istram-ispol-modelado-superficies-5-pdf-free.pdf · síntesis de Gemini, fuente original pendiente de contraste.

## Cunetas, ODT, subdrenes y defensas (`drainage` · P2)

Herramientas actuales: `native_records_read`.
Propuestas: `drainage_define`, `odt_place`, `drainage_quantities`.

Entradas requeridas:
- Eje/PK, lado, posición XYZ y orientación
- Sección, dimensiones y recubrimientos en m
- Materiales y datos hidráulicos validados por especialista

Procedimiento funcional:
1. Definir geometría de cuneta/ODT y ubicación
2. Integrar con sección y movimiento de tierras
3. Generar mediciones, replanteo y BIM por elemento

Aceptación:
- Hueco de obra descontado sin doble cómputo
- Coordenadas y emboquilles contrastados
- Clasificación/PSETs y cantidades correctos

Fallos y límites:
- Modelado geométrico no prueba dimensionamiento hidráulico
- ODT es fuente consultada vía NotebookLM; vídeo sin transcripción accesible

Evidencia:
- [Vídeo 9](https://www.youtube.com/watch?v=hlapFNA5q4A) · inventory_only
- [Vídeo 28](https://www.youtube.com/watch?v=xH1moH11JYg) · inventory_only
- [Vídeo 68](https://www.youtube.com/watch?v=kYBwoBuFHYk) · inventory_only
- [Vídeo 82](https://www.youtube.com/watch?v=zuzW7S07WQc) · inventory_only
- [Vídeo 89](https://www.youtube.com/watch?v=ZaTB2EHjXL4) · inventory_only
- [Vídeo 94](https://www.youtube.com/watch?v=r5P34-pjx5M) · inventory_only
- [Vídeo 103](https://www.youtube.com/watch?v=-8XOGG9_b3Y) · inventory_only
- [Vídeo 108](https://www.youtube.com/watch?v=fO0B2T6ZRhw) · inventory_only
- [Vídeo 110](https://www.youtube.com/watch?v=kMFC4KEs_Vk) · inventory_only
- [Vídeo 111](https://www.youtube.com/watch?v=Z6oHTid-dsI) · inventory_only
- [Vídeo 112](https://www.youtube.com/watch?v=WBNQ4XaGJes) · inventory_only
- [Vídeo 120](https://www.youtube.com/watch?v=r0dvvEMhlAo) · inventory_only
- Cuaderno: ODT (Obra de Drenaje Transversal) - ISTRAM · síntesis de Gemini, fuente original pendiente de contraste.

## Tuberías, pozos y zanjas multicapa (`pipelines` · P2)

Herramientas actuales: `profile_read`, `native_records_read`.
Propuestas: `pipeline_profile_set`, `trench_template_set`, `manhole_place`.

Entradas requeridas:
- Eje y rasante con saltos explícitos
- Diámetros/espesores y offsets XY en m
- Superficies ordenadas, zanja y materiales de protección

Procedimiento funcional:
1. Priorizar superficie vial sobre terreno donde corresponde
2. Encadenar rasante y segmentos verticales
3. Definir ductos/pozos/materiales y calcular

Aceptación:
- Tapas y excavación siguen la superficie objetivo
- Saltos y cotas de tubo contrastados
- Cinta de advertencia clasificada por su función real

Fallos y límites:
- No calcular pendiente convencional en el salto vertical
- Nombre interno tubo no justifica exportar una cinta como tubería

Evidencia:
- [Vídeo 26](https://www.youtube.com/watch?v=dHNxb7dFvGg) · transcript_reviewed · 00:54–03:04; 07:36–09:19
- [Vídeo 41](https://www.youtube.com/watch?v=DkuxFOa4m1k) · transcript_reviewed · 01:30–03:54; 04:30–04:57
- Cuaderno: Clase 8 · síntesis de Gemini, fuente original pendiente de contraste.

## Ferrocarril, escapes y catenarias (`rail` · P2)

Herramientas actuales: `alignment_read`, `profile_read`.
Propuestas: `rail_turnout_place`, `rail_crossover_generate`, `rail_layers_set`, `catenary_place`.

Entradas requeridas:
- Ejes, entrevía y desplazamientos con signo en m
- Catálogo y orientación de aparatos de vía
- Balasto/capa de forma, puntos de paso y tramos PK

Procedimiento funcional:
1. Preparar sector de doble vía y superficie de balasto
2. Conectar dos desvíos respetando sentidos
3. Encadenar rasante y recalcular plataforma

Aceptación:
- Conexiones continuas con las dos vías
- Sin duplicar balasto ni materiales
- Aparatos y gálibos verificados por especialista

Fallos y límites:
- Los códigos de conexión del tutorial son dependientes de versión
- No inferir orientación a partir del número de eje

Evidencia:
- [Vídeo 8](https://www.youtube.com/watch?v=21L1EojJZtE) · transcript_reviewed · 00:24–01:29; 01:32–03:58; 05:41–06:06
- [Vídeo 25](https://www.youtube.com/watch?v=5p8IOIn2OQ8) · inventory_only
- [Vídeo 32](https://www.youtube.com/watch?v=FC7RSAVPHJ4) · inventory_only
- [Vídeo 69](https://www.youtube.com/watch?v=E_VL495p-N0) · inventory_only
- [Vídeo 86](https://www.youtube.com/watch?v=JE1zz_Y1olc) · inventory_only
- [Vídeo 106](https://www.youtube.com/watch?v=hbF4aHhbkPc) · inventory_only

## Túneles, bóvedas, revestimientos y fases (`tunnels` · P2)

Herramientas actuales: `native_records_read`.
Propuestas: `tunnel_section_set`, `tunnel_lining_set`, `tunnel_progress_compare`.

Entradas requeridas:
- Eje/rasante y zonas PK en m
- Vectores de excavación, bóveda y contrabóveda
- Espesores/materiales, fases y geometría medida

Procedimiento funcional:
1. Definir sección paramétrica/vectorial y transiciones
2. Calcular excavación y revestimientos separados
3. Comparar teórico/ejecutado por fase y exportar

Aceptación:
- Revestimiento presente y espesor contrastado
- Sin huecos en transiciones/intersecciones
- Sobre/subexcavación cuantificada con método y tolerancia

Fallos y límites:
- Detalle del vídeo vectorial pendiente por falta de transcripción
- No certificar continuidad o gálibos por apariencia visual

Evidencia:
- [Vídeo 4](https://www.youtube.com/watch?v=o482XpZBFB8) · inventory_only
- [Vídeo 20](https://www.youtube.com/watch?v=rayfchBt-fs) · inventory_only
- [Vídeo 46](https://www.youtube.com/watch?v=Su4E3jKj8zU) · inventory_only
- [Vídeo 67](https://www.youtube.com/watch?v=A9FPT9n0Myc) · inventory_only
- [Vídeo 92](https://www.youtube.com/watch?v=NpmMOw2gIKw) · inventory_only
- [Vídeo 99](https://www.youtube.com/watch?v=vjYadmPueoQ) · inventory_only
- [Vídeo 119](https://www.youtube.com/watch?v=ZjLUXHiim10) · inventory_only
- Cuaderno: Clase 8 · síntesis de Gemini, fuente original pendiente de contraste.
- Cuaderno: WEBINAR SE SEGUIMIENTO DE OBRAS EJECUTADA · síntesis de Gemini, fuente original pendiente de contraste.

## Muros, cajones, puentes y cimentaciones (`structures` · P2)

Herramientas actuales: `native_records_read`.
Propuestas: `wall_rule_set`, `box_section_place`, `structure_surface_integrate`.

Entradas requeridas:
- Eje/línea y tramo PK en m
- Dimensiones, altura variable y reglas por rango
- Superficies losa/muros y relación con terreno

Procedimiento funcional:
1. Definir sección y reglas de colocación
2. Integrar superficies con prioridades explícitas
3. Regenerar cortes/cantidades y generar BIM

Aceptación:
- Losa/muro alteran el terreno como se pretende
- Sin huecos o doble cómputo
- Modelo y cantidades concuerdan con sección

Fallos y límites:
- El cajón del vídeo es una simplificación geométrica
- No equivale a cálculo estructural resistente

Evidencia:
- [Vídeo 16](https://www.youtube.com/watch?v=VHJoo3ggt0I) · transcript_reviewed · 00:14–02:42
- [Vídeo 17](https://www.youtube.com/watch?v=z0kFCXbBu9g) · inventory_only
- [Vídeo 19](https://www.youtube.com/watch?v=233KzpZRujE) · inventory_only
- [Vídeo 21](https://www.youtube.com/watch?v=etPmNHYvVBc) · inventory_only
- [Vídeo 27](https://www.youtube.com/watch?v=jVuRGK3mEtY) · inventory_only
- [Vídeo 45](https://www.youtube.com/watch?v=Z_m-_uB36Os) · inventory_only
- [Vídeo 81](https://www.youtube.com/watch?v=Qr7-6ot2pU4) · inventory_only
- [Vídeo 84](https://www.youtube.com/watch?v=jYfJFFAVdtU) · inventory_only
- Cuaderno: Clase 7 · síntesis de Gemini, fuente original pendiente de contraste.

## Cubicaciones por perfiles, prismas y parcelas (`quantities` · P1)

Herramientas actuales: `native_records_read`.
Propuestas: `quantity_profiles`, `quantity_prisms`, `quantity_parcels`.

Entradas requeridas:
- Superficie inicial/final y contorno
- Método y resolución/intervalo en m
- Eje/línea persistente y convención desmonte/terraplén

Procedimiento funcional:
1. Identificar y guardar definición de medición
2. Ejecutar método explícito
3. Generar informe y perfiles o mapa justificativo

Aceptación:
- Área m² y volumen m³ con método reproducible
- Refinamiento de muestreo y tolerancia documentados
- Materiales y límites conciliados con ISTRAM

Fallos y límites:
- Título del vídeo prismas y transcripción difieren: contrastar GUI
- Una línea temporal perdida impide repetir la medición

Evidencia:
- [Vídeo 1](https://www.youtube.com/watch?v=b9D9_1NOe7A) · transcript_reviewed · 00:09–01:17
- [Vídeo 3](https://www.youtube.com/watch?v=GQyueuDo5Yk) · inventory_only
- [Vídeo 52](https://www.youtube.com/watch?v=RcBY0lW738U) · inventory_only
- [Vídeo 101](https://www.youtube.com/watch?v=UAWsLkvCvEw) · transcript_reviewed · 00:06–00:50; 01:49–02:57
- Cuaderno: istram-ispol-modelado-superficies-5-pdf-free.pdf · síntesis de Gemini, fuente original pendiente de contraste.

## Seguimiento y comparación de ejecutado (`construction_monitoring` · P2)

Herramientas actuales: `native_records_read`.
Propuestas: `asbuilt_import`, `construction_compare`, `progress_report`.

Entradas requeridas:
- Proyecto teórico y levantamiento fechado
- CRS y unidades compatibles
- Método de medición, fases y tolerancias en m/m³

Procedimiento funcional:
1. Registrar procedencia y fecha del levantamiento
2. Comparar geometría/cantidades por ámbito
3. Emitir avance y discrepancias con evidencia

Aceptación:
- Distinguir periodo medido de acumulado
- No duplicar certificaciones
- Tolerancias y resultados conciliados con datos de campo

Fallos y límites:
- Avance temporal no se deduce de un IFC sin fecha
- No convertir automáticamente una medición en certificación contractual

Evidencia:
- [Vídeo 42](https://www.youtube.com/watch?v=ocwWjiR_9o0) · inventory_only
- [Vídeo 79](https://www.youtube.com/watch?v=G58_cMkgzyQ) · inventory_only
- [Vídeo 87](https://www.youtube.com/watch?v=jJGYDRbCec0) · inventory_only
- Cuaderno: WEBINAR SE SEGUIMIENTO DE OBRAS EJECUTADA · síntesis de Gemini, fuente original pendiente de contraste.

## Planos, guitarras, cajetines y laminado (`drawings` · P1)

Herramientas actuales: ninguna específica.
Propuestas: `drawing_template_set`, `drawing_generate`, `sheet_export`.

Entradas requeridas:
- Eje/tramo y plantilla identificados
- Escalas horizontal/vertical y unidades
- Campos de cajetín, PK por hoja y numeración

Procedimiento funcional:
1. Vincular atributos de plantilla y guitarra
2. Generar/paginar planos
3. Exportar y verificar hojas y rótulos

Aceptación:
- PK inicial/final coincide con contenido de cada hoja
- Numeración y escalas correctas
- PDF/DWG legibles y correspondientes al último cálculo

Fallos y límites:
- No fijar números de campo del vídeo para todas las plantillas
- Un plano existente puede pertenecer a cálculo anterior

Evidencia:
- [Vídeo 2](https://www.youtube.com/watch?v=EMouWF1Y3jg) · inventory_only
- [Vídeo 15](https://www.youtube.com/watch?v=3xE3bsCv5R0) · inventory_only
- [Vídeo 48](https://www.youtube.com/watch?v=dXMxKQbx814) · transcript_reviewed · 00:36–01:24; 03:25–06:49
- Cuaderno: Clase 6 · síntesis de Gemini, fuente original pendiente de contraste.
- Cuaderno: Clase 7 · síntesis de Gemini, fuente original pendiente de contraste.

## Replanteo y listados XYZ (`stakeout` · P1)

Herramientas actuales: ninguna específica.
Propuestas: `stakeout_report`.

Entradas requeridas:
- Eje, superficie, código y lado observados
- PK inicio/fin e intervalo en m
- CRS/unidades y nombre de salida único

Procedimiento funcional:
1. Seleccionar código real de punto de sección
2. Generar listado de coordenadas
3. Normalizar encabezados y comprobar puntos de control

Aceptación:
- XYZ y PK coinciden con sección calculada
- No se omiten puntos singulares requeridos
- No se sobrescribe otro código/superficie

Fallos y límites:
- Código oculto en dibujo puede existir en la sección
- Reinsertar y confirmar eje antes de generar el listado

Evidencia:
- [Vídeo 44](https://www.youtube.com/watch?v=w0nD9lRPe10) · transcript_reviewed · 01:07–03:38; 04:13–05:04
- [Vídeo 60](https://www.youtube.com/watch?v=fl4XHoX-CWY) · inventory_only
- Cuaderno: Clase 7 · síntesis de Gemini, fuente original pendiente de contraste.

## Configuración BIM, clases, PSETs y exportación IFC (`bim` · P0)

Herramientas actuales: `ifc_entity_types`, `ifc_validate`, `operation_start`.
Propuestas: `bim_scope_read`, `bim_properties_set`, `bim_export_configure`, `bim_acceptance_report`.

Entradas requeridas:
- Proyecto calculado y árbol BIM generado
- Ámbito explícito: nodos/ejes/grupos/elementos
- Esquema, CRS/unidades, clases y propiedades tipadas

Procedimiento funcional:
1. Confirmar cálculo vigente y selección
2. Asignar clases, tipos y PSETs por entidad aplicable
3. Generar/exportar y contrastar archivo y modelo fuente

Aceptación:
- Productos esperados y representaciones presentes
- Unidades, georreferencia y propiedades con valores correctos
- Cantidades y geometría dentro de tolerancias del proyecto

Fallos y límites:
- ifc_validate valida reglas y existencia de PSETs, no valores o completitud del modelo
- La existencia de archivo/hash nuevo no certifica semántica

Evidencia:
- [Vídeo 78](https://www.youtube.com/watch?v=-8yDh_lXvL0) · transcript_reviewed · 01:59–04:19; 04:41–05:52; 08:08–09:28
- [Vídeo 100](https://www.youtube.com/watch?v=Rm1KcXlc2ZY) · inventory_only
- Cuaderno: RCEclass · síntesis de Gemini, fuente original pendiente de contraste.
- Cuaderno: Clase 1 · síntesis de Gemini, fuente original pendiente de contraste.
- Cuaderno: ODT (Obra de Drenaje Transversal) - ISTRAM · síntesis de Gemini, fuente original pendiente de contraste.

## Intercambio CAD, LandXML y federación CDE (`interoperability` · P2)

Herramientas actuales: `ifc_validate`.
Propuestas: `landxml_import`, `landxml_export`, `cad_export`, `federation_package`.

Entradas requeridas:
- Receptor y versiones compatibles
- Selección por disciplina/eje/elemento
- CRS/unidades y formatos de terreno/modelo/documentos

Procedimiento funcional:
1. Exportar terreno y elementos con ámbito registrado
2. Preparar paquete con manifiesto y hashes
3. Abrir en receptor y revisar posición y propiedades

Aceptación:
- Coincidencia de puntos de control entre aplicaciones
- Elementos seleccionables y propiedades conservadas
- Pérdidas y conversiones registradas

Fallos y límites:
- Configuración de Infraworks/Navisworks del tutorial es histórica
- Federación y colisiones en CDE no las implementa el MCP actual

Evidencia:
- [Vídeo 33](https://www.youtube.com/watch?v=HX7g2Ish_AA) · transcript_reviewed · 00:06–02:42; 05:21–06:52
- [Vídeo 43](https://www.youtube.com/watch?v=xb7cprgiuyE) · inventory_only
- [Vídeo 93](https://www.youtube.com/watch?v=5RMeG6ypUU0) · inventory_only
- Cuaderno: Clase 2 · síntesis de Gemini, fuente original pendiente de contraste.
- Cuaderno: Clase 3 · síntesis de Gemini, fuente original pendiente de contraste.

## Virtual 3D y visualización externa (`visualization` · P2)

Herramientas actuales: ninguna específica.
Propuestas: `view_model`, `visualization_export`.

Entradas requeridas:
- Modelo calculado y alcance de visualización
- Materiales y formatos compatibles
- CRS/escala y aplicación receptora

Procedimiento funcional:
1. Generar representación 3D
2. Exportar hacia visualizador compatible
3. Comparar escala, origen y objetos visibles

Aceptación:
- Modelo visible sin desplazamiento o escala errónea
- No faltan elementos del ámbito
- La imagen mantiene vínculo con revisión de modelo

Fallos y límites:
- Render fotorrealista no valida diseño ni cantidades
- No confundir vídeo de demostración con receta reproducible

Evidencia:
- [Vídeo 54](https://www.youtube.com/watch?v=BYKVdW0_y08) · inventory_only
- [Vídeo 66](https://www.youtube.com/watch?v=lI528yDtrN8) · inventory_only
- [Vídeo 71](https://www.youtube.com/watch?v=LD5l_7MP5cc) · inventory_only
- [Vídeo 72](https://www.youtube.com/watch?v=fFCVxE69YrE) · inventory_only
- [Vídeo 98](https://www.youtube.com/watch?v=e6-Q1q2xkPs) · inventory_only
- [Vídeo 107](https://www.youtube.com/watch?v=bBF103hmLI0) · inventory_only

## Señalización y equipamiento vial (`road_furniture` · P2)

Herramientas actuales: ninguna específica.
Propuestas: `road_furniture_place`.

Entradas requeridas:
- Eje/PK, lado y posición XYZ en m
- Catálogo, orientación y tipo de objeto
- Clase IFC y propiedades por función

Procedimiento funcional:
1. Identificar catálogo y reglas de colocación
2. Colocar por geometría y tramo
3. Generar representación y exportar atributos

Aceptación:
- Ubicación y orientación contrastadas
- Objetos esperados presentes en exportación
- Clasificación conforme al objeto real

Fallos y límites:
- Procedimiento identificado solo por título de vídeo
- Una instancia 3D no demuestra cumplimiento de señalización

Evidencia:
- [Vídeo 30](https://www.youtube.com/watch?v=2Q4eJ7EGzng) · inventory_only

## Edición por lotes de archivos asociados a elementos (`files_batch` · P0)

Herramientas actuales: `project_prepare_batch`, `project_apply_changes`, `project_restore_changes`.
Propuestas: `element_manifest_import`, `native_parameter_rules`.

Entradas requeridas:
- Listado con elementId único y archivos relativos a la copia
- Por cambio: línea, texto esperado y sustitución revisados
- Máximo 1000 elementos y 10000 cambios de entrada, revisión de formato/encoding

Procedimiento funcional:
1. Exportar listado e identificar archivos compartidos
2. Preparar lote y revisar manifiesto/diff/hashes
3. Aplicar con guardia de formato y sesión, reabrir/calcular/contrastar y restaurar si corresponde

Aceptación:
- Los 350 elementos de prueba se conservan identificados
- Cambios idénticos compartidos se aplican una vez y conflictos se rechazan
- Original intacto; todos los cambios y recuperación verificados

Fallos y límites:
- La prueba de 350 elementos es sintética y no demuestra 350 elementos nativos
- No todos los archivos son texto ni los formatos están documentados públicamente

Evidencia:
- Material aportado: API DE ISTRAM, texto y captura aportados por el usuario; aplicación atribuida a Luis Briceño · resultados reportados, sin ensayo independiente.
