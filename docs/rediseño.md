
Sí. En tu caso **no le daría a Claude Code/otro agente un prompt genérico de “haz la UI más bonita”**. Eso suele terminar en cambios cosméticos, tarjetas innecesarias y, peor, modificaciones de la lógica.

Le daría un **brief de rediseño UX/UI + auditoría + referencias visuales + restricciones técnicas + criterios de aceptación**.

Las referencias que usaría como base son principalmente **IBM Carbon**, **Plotly** y principios de dashboards científicos. Carbon es especialmente útil aquí porque sus guías distinguen entre dashboards de presentación y exploración, recomiendan jerarquía visual fuerte, limitar métricas y usar el espacio en blanco para mejorar comprensión. ([Carbon Design System][1])

## Referencias visuales que le puedes pasar al agente

### 1. IBM Carbon — Dashboards

[Carbon Design System — Dashboards](https://www.carbondesignsystem.com/building-blocks/data-visualization/dashboards?utm_source=chatgpt.com)

**Qué tomar de aquí:**

* Jerarquía visual de KPIs.
* Cómo separar información principal de información secundaria.
* Uso de whitespace.
* Estructura de dashboard de alta densidad.
* No intentar mostrar todas las métricas con la misma importancia.
* Patrón de navegación lateral + área de trabajo.

**No copiar:** colores, branding IBM ni componentes literalmente.

---

### 2. IBM Carbon — Data Visualization

[Carbon Design System — Data Visualization](https://www.carbondesignsystem.com/building-blocks/data-visualization/overview?utm_source=chatgpt.com)

**Qué tomar:**

* Tratamiento profesional de gráficos científicos.
* Line charts para relaciones continuas.
* Bar charts para comparar grados 1–4.
* Scatter plots para datos experimentales.
* Consistencia visual entre gráficos.

En tu aplicación esto encaja especialmente bien con:

```text
ΔT vs masa de NaOH
        ↓
datos experimentales + regresión
```

y:

```text
RMSE LOOCV
grado 1 vs grado 2 vs grado 3 vs grado 4
```

Carbon también recomienda simplificar las leyendas cuando sea posible y etiquetar directamente los datos cuando haya espacio suficiente. ([Carbon Design System][2])

---

### 3. IBM Carbon — Chart Anatomy

[Carbon Design System — Chart Anatomy](https://www.carbondesignsystem.com/building-blocks/data-visualization/chart-anatomy?utm_source=chatgpt.com)

**Qué tomar:**

* Títulos descriptivos.
* Ejes claros.
* Tooltips.
* Área gráfica limpia.
* Controles de zoom cuando tengan sentido.
* Evitar gráficos decorativos que no aporten información.

Esto es importante porque tu aplicación no debe convertirse en un dashboard "bonito" pero científicamente pobre. El gráfico debe ayudar a **interpretar el experimento**. ([Carbon Design System][3])

---

### 4. IBM Carbon — Side navigation

[Carbon Design System — UI Shell / Side Navigation](https://www.carbondesignsystem.com/building-blocks/core/components/ui-shell-left-panel/specifications?utm_source=chatgpt.com)

**Qué tomar:**

* Sidebar consistente.
* Estados `hover`, `active`, `focus`.
* Separación entre navegación y contenido.
* Tamaño compacto.
* Indicador claro de sección activa.

Esto es muy aplicable a tu menú actual. ([Carbon Design System][4])

---

### 5. Plotly Dash — Layout

[Plotly Dash — Layout](https://dash.plotly.com/layout?utm_source=chatgpt.com)

**Qué tomar:**

* Mentalidad de aplicación de análisis de datos.
* Relación entre controles, datos y gráficos.
* Composición de interfaces orientadas a análisis científico.
* Separación entre estructura visual e interacción.

No significa que tengas que migrar a Dash. **Solo es referencia UX para una aplicación Python de análisis de datos.** ([Dash Documentation][5])

---

### 6. Plotly — Dashboard/data visualization

[Plotly Python](https://plotly.com/python/?utm_source=chatgpt.com)

**Qué tomar:**

* Interactividad de gráficos.
* Hover para inspeccionar valores.
* Selección de datos.
* Zoom.
* Visualización de regresiones.
* Comparación de modelos.

La documentación de Dash muestra precisamente la combinación de tablas de datos y gráficos interactivos como patrón de aplicaciones de análisis. ([Dash Documentation][6])

---

# Prompt maestro para tu asistente de código

Te recomiendo **copiar todo esto**, incluyendo las referencias:

```text
Quiero que realices un REDISEÑO PROFESIONAL DE UI/UX de la aplicación Python existente.

IMPORTANTE:
No quiero que reconstruyas la aplicación desde cero.
No quiero que cambies la lógica matemática, cálculos, fórmulas, resultados, flujo científico ni estructura de datos salvo que sea estrictamente necesario para corregir un problema de UI.

Tu trabajo principal es mejorar la EXPERIENCIA DE USUARIO y la PRESENTACIÓN VISUAL de la aplicación existente.

==================================================
1. CONTEXTO DE LA APLICACIÓN
==================================================

La aplicación analiza un experimento de disolución de NaOH y actualmente contiene:

- Datos experimentales.
- Cálculos físicos.
- Regresión lineal.
- Regresión cuadrática.
- Interpolación de Lagrange grados 1 a 4.
- Validación LOOCV.
- Métricas de error.
- Comparación de modelos.
- Selección automática del grado.
- Cálculo de ΔH.
- Validaciones automáticas.
- Exportación de resultados.

La pantalla principal actualmente muestra:

- Sidebar de navegación.
- Header superior.
- Tarjetas KPI.
- Justificación del grado seleccionado.
- Lista de validaciones.
- Resultados numéricos.

El resultado actualmente mostrado incluye, entre otros:

- Grado seleccionado: 1.
- Pendiente a1 ≈ 5.2699 °C/g.
- R² ≈ 0.99999986.
- Error Sy/x ≈ 0.0029 °C.
- ΔH promedio ≈ -44.498 kJ/mol.
- RMSE LOOCV del grado 1 ≈ 0.004031 °C.

Estos valores son solamente contexto visual.
NO los hardcodees.
Los datos deben seguir viniendo de la lógica existente.

==================================================
2. OBJETIVO DEL REDISEÑO
==================================================

Quiero que la aplicación pase de parecer un "panel técnico con muchos textos y tarjetas" a parecer una:

APLICACIÓN CIENTÍFICA PROFESIONAL DE ANÁLISIS EXPERIMENTAL.

La interfaz debe transmitir:

- precisión;
- rigor científico;
- claridad;
- modernidad;
- confianza;
- facilidad de interpretación;
- aspecto profesional.

Debe sentirse como software científico/de ingeniería, NO como una plantilla genérica de dashboard empresarial.

==================================================
3. REGLA PRINCIPAL
==================================================

NO agregues elementos visuales simplemente para hacer que la aplicación parezca más moderna.

Cada componente debe responder a una pregunta:

"¿Esto ayuda al usuario a entender el experimento o utilizar la aplicación?"

Si la respuesta es no, no lo agregues.

Prioriza:

1. Jerarquía visual.
2. Legibilidad.
3. Interpretación de resultados.
4. Visualización científica.
5. Navegación.
6. Consistencia.
7. Accesibilidad.
8. Estética.

==================================================
4. ANTES DE MODIFICAR CÓDIGO
==================================================

PRIMERO inspecciona completamente el proyecto.

Identifica:

- framework GUI utilizado;
- archivos principales;
- sistema de estilos;
- componentes reutilizables;
- arquitectura;
- navegación;
- generación de gráficos;
- manejo de datos;
- lógica matemática;
- sistema de exportación.

Determina qué partes corresponden a:

A. lógica de negocio;
B. cálculos científicos;
C. presentación/UI;
D. estilos;
E. gráficos;
F. navegación.

NO empieces modificando código inmediatamente.

Primero crea mentalmente un mapa del proyecto y determina qué archivos realmente deben cambiar.

Si existe un sistema de componentes/estilos, reutilízalo.

Si no existe, crea uno.

==================================================
5. NO ROMPER FUNCIONALIDAD
==================================================

La prioridad absoluta es:

FUNCIONALIDAD EXISTENTE > REDISEÑO.

No debes romper:

- carga de Excel;
- lectura de datos;
- cálculos;
- regresiones;
- interpolación;
- Lagrange;
- LOOCV;
- cálculo de errores;
- cálculo de ΔH;
- validaciones;
- navegación;
- exportación;
- actualización de datos;
- selección de grado.

No cambies fórmulas ni algoritmos matemáticos para conseguir una UI más bonita.

Si necesitas modificar una parte funcional para integrar un nuevo componente visual, hazlo de forma mínima y documentada.

==================================================
6. NUEVA JERARQUÍA VISUAL
==================================================

La aplicación debe tener una jerarquía mucho más clara.

En el Resumen quiero esta prioridad:

1. Resultado principal.
2. Evidencia numérica.
3. Gráficos.
4. Validaciones.
5. Explicación de por qué se seleccionó el modelo.
6. Información técnica secundaria.

Actualmente hay demasiado texto compitiendo visualmente.

Rediseña para que un estudiante pueda responder en aproximadamente 5 segundos:

- ¿Qué modelo fue seleccionado?
- ¿Por qué?
- ¿Qué tan bueno es?
- ¿Cuál fue el ΔH?
- ¿Está validado?

==================================================
7. RESULTADO PRINCIPAL
==================================================

El "Grado seleccionado" debe convertirse en el resultado protagonista.

Crear una sección visual del tipo:

--------------------------------
RESULTADO DEL ANÁLISIS

✓ Grado 1 seleccionado

Menor error de validación LOOCV

RMSE LOOCV
0.004031 °C

Grados evaluados:
1 · 2 · 3 · 4
--------------------------------

No copies literalmente este diseño si existe una mejor solución en el framework actual.

El objetivo es la jerarquía, no el diseño exacto.

==================================================
8. KPI / MÉTRICAS
==================================================

Reducir la sensación de "cinco tarjetas idénticas".

Las métricas deben tener niveles de importancia.

Principales:

- Grado seleccionado.
- RMSE LOOCV.
- R².
- ΔH.

Secundarias:

- pendiente;
- error Sy/x;
- diferencia respecto al valor teórico;
- otras métricas.

Mostrar unidades correctamente.

Ejemplo:

Pendiente a₁
5.2699 °C/g
Teórica: 5.2697 °C/g
Δ: 0.004%

Evitar descripciones excesivamente largas dentro de las tarjetas.

Usar tooltips o información secundaria cuando sea apropiado.

==================================================
9. VISUALIZACIÓN CIENTÍFICA
==================================================

Esta es una de las mejoras más importantes.

Aprovecha que la aplicación trabaja con datos experimentales.

El Resumen debería incorporar al menos:

A. Gráfico principal:

ΔT vs masa de NaOH

Debe mostrar:

- puntos experimentales;
- regresión seleccionada;
- etiquetas de ejes;
- unidades;
- tooltip si la librería lo permite;
- ecuación del modelo;
- R²;
- leyenda solamente cuando sea necesaria.

B. Comparación de modelos:

Comparar RMSE LOOCV para grados:

1
2
3
4

Preferiblemente con un gráfico de barras horizontal o equivalente.

El grado seleccionado debe ser visualmente distinguible sin depender únicamente del color.

C. Cuando sea útil:

visualización de residuos.

NO llenes el dashboard con gráficos.
Solo mostrar los que ayuden a interpretar los resultados.

==================================================
10. JUSTIFICACIÓN DEL MODELO
==================================================

La sección actual contiene demasiado texto corrido.

Convertir la explicación en bloques visuales escaneables.

Por ejemplo:

PRECISIÓN
RMSE LOOCV = 0.004031 °C

TENDENCIA
El RMSE aumenta con el grado.

COMPLEJIDAD
Los modelos superiores no mejoran la predicción.

ESTABILIDAD
Los grados 3 y 4 presentan mayor comportamiento oscilatorio
en los extremos.

HOMOGENEIDAD
Los residuos del grado seleccionado permanecen dentro del
rango esperado.

Cada bloque debe ser corto.

El texto completo debe seguir disponible mediante:

- tooltip;
- expandible;
- "ver explicación completa";
- modal;
- acordeón;

según lo que mejor encaje con el framework existente.

==================================================
11. VALIDACIONES
==================================================

La lista actual de validaciones es demasiado textual.

Convertirla en un "estado de validación".

Ejemplo:

VALIDACIÓN
8 / 8 comprobaciones superadas

✓ Regresión lineal
✓ Regresión cuadrática
✓ Lagrange grado 1
✓ Lagrange grado 2
✓ Lagrange grado 3
✓ Lagrange grado 4
✓ LOOCV
✓ Curvas consistentes con los datos

Los detalles técnicos como:

numpy.polyfit

deben estar disponibles, pero no dominar la interfaz.

Se pueden mostrar mediante tooltip, expandable, modal o detalle secundario.

==================================================
12. SIDEBAR
==================================================

Rediseñar la navegación.

Actualmente existen categorías como:

VISTA GENERAL
DATOS
REGRESIÓN
INTERPOLACIÓN
CONCLUSIÓN
PROYECTO

Mantener esta organización conceptual, pero mejorar:

- espaciado;
- iconografía;
- jerarquía;
- estado activo;
- hover;
- separación entre categorías;
- legibilidad.

Los códigos de la guía como:

T1
T2
T3
F1
F2
etc.

NO deben dominar visualmente.

Pueden mantenerse como referencia secundaria o aparecer al activar un modo técnico.

La navegación debe sentirse como:

Resumen

Datos
  Datos experimentales
  Cálculos físicos

Modelos
  Regresión lineal
  Regresión cuadrática
  Comparación

Interpolación
  Grados 1–4
  Validación LOOCV
  Métricas de error

Conclusión
  Selección del grado
  Aportes adicionales

Proyecto
  Acerca del proyecto

Usa iconos solo cuando realmente mejoren la identificación.

==================================================
13. HEADER
==================================================

Reducir el peso visual del header.

Debe comunicar:

Disolución de NaOH
Análisis experimental

Y contener acciones importantes:

Abrir datos
Exportar

No permitir que el header ocupe demasiado espacio vertical.

El botón de exportación puede convertirse en menú:

Exportar
- PDF
- Excel
- CSV
- Informe

SOLO si la funcionalidad existente permite esos formatos.

NO inventes formatos que no existen.

==================================================
14. SISTEMA DE DISEÑO
==================================================

Crear o consolidar un pequeño design system.

Definir:

- colores;
- tipografía;
- tamaños;
- espaciado;
- border radius;
- sombras;
- bordes;
- estados;
- botones;
- cards;
- badges;
- tablas;
- navegación;
- gráficos.

Preferir un sistema sobrio.

No usar:

- gradientes exagerados;
- glassmorphism excesivo;
- sombras enormes;
- animaciones decorativas;
- neumorphism;
- colores saturados sin función.

La interfaz debe parecer software científico.

==================================================
15. COLOR
==================================================

Mantener la identidad azul existente, pero hacerla más sofisticada.

Propuesta conceptual:

Azul oscuro:
navegación / header.

Azul principal:
acciones / información / resultados.

Verde:
validación exitosa.

Ámbar:
advertencia.

Rojo:
error.

Grises:
superficies / bordes / información secundaria.

NO depender únicamente del color para comunicar estados.

Por ejemplo:

✓ Validado
⚠ Advertencia
× Error

Además del color.

==================================================
16. TIPOGRAFÍA
==================================================

Mejorar la jerarquía tipográfica.

Debe existir una clara diferencia entre:

- título de aplicación;
- título de página;
- sección;
- KPI;
- valor numérico;
- unidad;
- descripción;
- información secundaria.

Los números científicos importantes deben tener suficiente tamaño y peso.

Ejemplo:

R²
0.99999986

y no:

R²
0.99999986
coeficiente de determinación

con exactamente el mismo peso visual que todo lo demás.

==================================================
17. TABLAS
==================================================

Las tablas experimentales deben ser profesionales.

Aplicar:

- encabezados claros;
- unidades;
- alineación numérica;
- filas alternas solamente si ayudan;
- hover;
- selección;
- scroll cuando sea necesario;
- formato consistente de decimales.

Los números deben estar alineados para facilitar comparación.

==================================================
18. INTERACCIÓN
==================================================

Añadir microinteracciones solo donde tengan utilidad:

- hover;
- active;
- focus;
- selección;
- tooltips;
- expansión;
- feedback al exportar;
- feedback al cargar datos;
- feedback durante cálculos;
- estados vacíos;
- estados de error.

Evitar animaciones largas.

La interfaz debe sentirse rápida.

==================================================
19. RESPONSIVE / REDIMENSIONAMIENTO
==================================================

La ventana puede cambiar de tamaño.

La UI debe comportarse correctamente cuando:

- se maximiza;
- se reduce;
- cambia la relación de aspecto;
- el usuario usa diferentes resoluciones.

Evitar posiciones absolutamente fijadas cuando puedan provocar solapamientos.

Los gráficos deben redimensionarse correctamente.

==================================================
20. ACCESIBILIDAD
==================================================

Aplicar buenas prácticas:

- contraste adecuado;
- estados focus;
- tamaños legibles;
- no depender solo del color;
- tooltips claros;
- navegación consistente;
- iconos con significado;
- textos comprensibles.

==================================================
21. REFERENCIAS DE DISEÑO
==================================================

Utiliza estas referencias como INSPIRACIÓN UX/UI.

NO copies literalmente su branding.

1. IBM Carbon — Dashboards
https://www.carbondesignsystem.com/building-blocks/data-visualization/dashboards

Tomar:
- jerarquía;
- estructura;
- densidad controlada;
- KPI prioritarios;
- whitespace;
- separación entre overview y exploration.

2. IBM Carbon — Data Visualization
https://www.carbondesignsystem.com/building-blocks/data-visualization/overview

Tomar:
- tratamiento de gráficos;
- consistencia;
- selección adecuada del tipo de gráfico;
- visualización de datos científicos.

3. IBM Carbon — Chart Anatomy
https://www.carbondesignsystem.com/building-blocks/data-visualization/chart-anatomy

Tomar:
- ejes;
- títulos;
- tooltips;
- legends;
- estructura de gráficos.

4. IBM Carbon — UI Shell / Left Navigation
https://www.carbondesignsystem.com/building-blocks/core/components/ui-shell-left-panel/specifications

Tomar:
- sidebar;
- estados activo/hover/focus;
- navegación lateral;
- espaciado.

5. Plotly Python
https://plotly.com/python/

Tomar:
- interactividad;
- hover;
- zoom;
- visualización de regresiones;
- exploración de datos.

6. Plotly Dash Layout
https://dash.plotly.com/layout

Tomar:
- composición de interfaces de análisis;
- relación entre gráficos y controles;
- estructura de aplicaciones científicas.

Estas referencias NO implican migrar a React, Dash, Carbon o cualquier otro framework.

La tecnología actual de la aplicación debe mantenerse salvo que exista una razón técnica fuerte.

==================================================
22. IMPORTANTE SOBRE EL FRAMEWORK
==================================================

Primero determina qué tecnología utiliza actualmente la aplicación.

Si utiliza:

- PySide6
- PyQt
- Tkinter
- CustomTkinter
- Dear PyGui
- Kivy
- otra

adapta el rediseño a esa tecnología.

NO migres de framework solamente por estética.

Si la arquitectura actual permite implementar el diseño sin migración, esa es la opción preferida.

==================================================
23. REUTILIZACIÓN DE COMPONENTES
==================================================

Evita crear código visual duplicado.

Si existen múltiples cards, botones, tablas, títulos o paneles similares:

crear componentes reutilizables.

Por ejemplo conceptualmente:

MetricCard
SectionHeader
StatusBadge
ValidationItem
ScientificChart
SidebarSection
PrimaryButton
SecondaryButton
InfoTooltip

Usa los nombres que correspondan al framework real.

==================================================
24. NO HACER
==================================================

NO:

- cambiar la lógica matemática;
- eliminar funcionalidades;
- eliminar datos;
- eliminar validaciones;
- eliminar exportación;
- migrar de framework sin necesidad;
- llenar todo de tarjetas;
- agregar gráficos inútiles;
- usar gradientes exagerados;
- usar glassmorphism;
- usar animaciones decorativas;
- hacer una UI tipo SaaS genérica;
- hardcodear resultados;
- crear dependencias innecesarias;
- instalar librerías grandes sin justificarlo.

==================================================
25. PROCESO DE TRABAJO
==================================================

Trabaja en estas fases:

FASE 1 — AUDITORÍA

Inspecciona el proyecto.

Identifica problemas de:

- UX;
- UI;
- navegación;
- jerarquía;
- accesibilidad;
- responsive;
- consistencia;
- visualización.

NO MODIFIQUES CÓDIGO TODAVÍA.

Después dame un resumen breve de los problemas encontrados.

FASE 2 — PLAN

Propón:

- arquitectura visual;
- componentes;
- cambios de navegación;
- cambios en el Resumen;
- cambios en gráficos;
- sistema de diseño.

FASE 3 — IMPLEMENTACIÓN

Implementa el rediseño.

Mantén la lógica existente.

FASE 4 — VALIDACIÓN

Ejecuta la aplicación.

Comprueba:

- que inicia;
- que carga datos;
- que todos los cálculos siguen funcionando;
- que las pantallas siguen navegables;
- que los gráficos funcionan;
- que exportación funciona;
- que no hay errores;
- que no hay elementos cortados;
- que la ventana puede redimensionarse.

FASE 5 — REVISIÓN VISUAL

Haz una revisión específica como diseñador UX/UI.

Busca:

- elementos desalineados;
- exceso de espacio;
- falta de espacio;
- tamaños incorrectos;
- textos truncados;
- jerarquía débil;
- colores inconsistentes;
- scroll innecesario;
- botones poco claros;
- gráficos difíciles de interpretar.

Corrige lo encontrado.

==================================================
26. ARCHIVOS MODIFICADOS
==================================================

Al terminar, indícame exactamente:

ARCHIVOS MODIFICADOS
- archivo.py — qué cambió y por qué.
- styles.py — qué cambió y por qué.
- etc.

ARCHIVOS NUEVOS
- archivo.py — propósito.

NO quiero una lista de archivos que simplemente hayas inspeccionado.
Solo archivos realmente creados o modificados.

==================================================
27. CRITERIOS DE ACEPTACIÓN
==================================================

Consideraré terminado el trabajo cuando:

[ ] La UI se vea claramente más profesional.
[ ] El resultado principal sea inmediatamente identificable.
[ ] La navegación sea más clara.
[ ] Las métricas tengan jerarquía.
[ ] Exista una visualización científica útil.
[ ] El RMSE de los grados pueda compararse visualmente.
[ ] Las validaciones sean fáciles de interpretar.
[ ] La justificación del grado sea escaneable.
[ ] La interfaz no se sienta saturada.
[ ] Se mantenga la identidad científica.
[ ] La aplicación siga funcionando exactamente igual.
[ ] No se hayan modificado innecesariamente los cálculos.
[ ] No existan textos truncados.
[ ] La interfaz responda correctamente al redimensionamiento.
[ ] Los estados de error/éxito sean claros.
[ ] La UI sea consistente entre las diferentes pantallas.

==================================================
28. PRINCIPIO FINAL
==================================================

No quiero simplemente una aplicación "más bonita".

Quiero una aplicación que sea:

MÁS CLARA
MÁS CIENTÍFICA
MÁS PROFESIONAL
MÁS FÁCIL DE INTERPRETAR
MÁS COHERENTE
MÁS AUDITABLE

El usuario debe poder abrir la aplicación y entender rápidamente:

DATOS → MODELO → VALIDACIÓN → RESULTADO → CONCLUSIÓN

Ese debe ser el hilo conductor de toda la experiencia.
```

### Una instrucción adicional que yo sí pondría al principio

Como ya tienes una captura de la interfaz actual, **adjúntale la captura al agente junto con el prompt** y añade:

```text
La captura adjunta representa el estado visual ACTUAL de la aplicación.

Úsala como baseline para identificar problemas de jerarquía, densidad,
espaciado, navegación y composición.

NO intentes replicarla.
Tu objetivo es evolucionar esa interfaz manteniendo su identidad
científica y su información, pero mejorando sustancialmente la UX/UI.
```

---

## Una decisión que considero especialmente importante

Yo **no le pediría al agente que convierta tu app en "un dashboard moderno"**.

Le pediría que la convierta en un **"scientific analysis workstation"**.

La diferencia es grande.

Tu aplicación no solamente muestra KPIs. Tiene una cadena científica:

**Datos experimentales → cálculos → regresiones → interpolación → validación → selección → ΔH → conclusión.**

Por eso incluso puedes hacer que el `Resumen` tenga una narrativa visual:

```text
┌──────────────────────────────────────────────┐
│ 01  DATOS                                    │
│     20 ensayos                              │
└───────────────────────┬──────────────────────┘
                        ↓
┌──────────────────────────────────────────────┐
│ 02  MODELOS                                  │
│     Regresión + Lagrange                     │
└───────────────────────┬──────────────────────┘
                        ↓
┌──────────────────────────────────────────────┐
│ 03  VALIDACIÓN                               │
│     LOOCV · 8/8 comprobaciones               │
└───────────────────────┬──────────────────────┘
                        ↓
┌──────────────────────────────────────────────┐
│ 04  RESULTADO                                │
│     Grado 1 · RMSE 0.004031 °C              │
└───────────────────────┬──────────────────────┘
                        ↓
┌──────────────────────────────────────────────┐
│ 05  CONCLUSIÓN                               │
│     ΔH = -44.498 kJ/mol                     │
└──────────────────────────────────────────────┘
```

No necesariamente tiene que verse literalmente así; **la idea es que el diseño cuente esa historia**.

Y esa dirección está muy alineada con las recomendaciones de diseño para dashboards de exploración: presentar primero la visión general y permitir después profundizar en los datos, manteniendo consistencia entre gráficos, controles y anotaciones. ([Carbon Design System][1])

**Mi recomendación técnica:** deja que el agente primero haga la auditoría y el plan, **sin tocar código**, y solo después dile que implemente. Esto reduce muchísimo la posibilidad de que un agente de código empiece a "embellecer" componentes aislados sin entender cómo está construida toda la aplicación. Carbon incluso recomienda explícitamente que los prompts de construcción definan objetivo, layout, componentes, espaciado y archivos, en vez de pedir simplemente "build a dashboard". ([Carbon Design System][7])

[1]: https://www.carbondesignsystem.com/building-blocks/data-visualization/dashboards?utm_source=chatgpt.com
[2]: https://www.carbondesignsystem.com/building-blocks/data-visualization/legends?utm_source=chatgpt.com
[3]: https://www.carbondesignsystem.com/building-blocks/data-visualization/chart-anatomy?utm_source=chatgpt.com
[4]: https://www.carbondesignsystem.com/building-blocks/core/components/ui-shell-left-panel/specifications?utm_source=chatgpt.com
[5]: https://dash.plotly.com/layout?utm_source=chatgpt.com
[6]: https://dash.plotly.com/tutorial?utm_source=chatgpt.com
[7]: https://www.carbondesignsystem.com/getting-started/carbon-mcp/prompts?utm_source=chatgpt.com
