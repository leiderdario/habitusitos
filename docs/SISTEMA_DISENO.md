# Sistema de diseño — Espinker

| Campo | Detalle |
|---|---|
| Dirección | **Calma y cuidado, no vigilancia** |
| Criterio de accesibilidad | **WCAG 2.2 AA** — el único citable hoy (ver nota sobre APCA abajo) |
| Fuente única de tokens | [`app/src/index.css`](../app/src/index.css) |
| Regla dura | **Ningún componente escribe un hex crudo.** Verificada por test |
| Contraste | Cada par de tokens que la interfaz usa se verifica en `app/src/contraste.test.ts`, en los dos temas |

---

## 1. La dirección y de dónde sale

El §9.1 del prompt maestro es explícito: *"Calma, no ansiedad. Es una app de bienestar/ergonomía; la estética debe transmitir cuidado, no vigilancia ni regaño. Evitar rojos agresivos tipo alarma de incendio."*

Eso descarta dos caminos obvios:

- **El clínico frío** (azules corporativos, gris hospital): comunica "te están midiendo".
- **El de dashboard técnico** (verde/rojo saturados sobre fondo oscuro): comunica "algo va mal".

La paleta, aprobada el 2026-10-08 (ver [PLAN_REDISENO_ESPINKER.md](PLAN_REDISENO_ESPINKER.md), Fase 0), combina cuatro familias con un papel fijo cada una:

- **Azul profundo**: estructura y marca. Transmite confianza sin el frío de hospital porque se acompaña de neutros cálidos.
- **Verde salvia**: secciones suaves y agrupaciones. Es apagado a propósito.
- **Madera**: bordes gruesos y detalles (marco de la cámara, logotipo, notas). Aporta calidez.
- **Crema**: el fondo de lectura en claro y el texto en oscuro.

Ninguna de las cuatro comunica el estado postural. Hasta esta versión, el primario teal y el estado "buena" eran el mismo tono, y un botón se leía igual que un "vas bien": esa fue la razón del cambio de paleta.

---

## 2. Color

### 2.1 Paleta base

| Rol | Claro | Oscuro | Nota |
|---|---|---|---|
| Primario (`--primary`) | azul profundo `#193763` | azul claro `#89beeb` | Sobre fondo azul, el botón no puede ser azul profundo |
| Secundario y hover (`--secondary`, `--accent`) | salvia `#d7ebd7` | salvia apagada `#293e2d` | shadcn usa `accent` como fondo de hover en menús |
| Madera (`--madera`, `--madera-suave`) | `#895e3c` / `#e4ccb6` | `#c99a70` / `#543d2a` | Nunca en botones ni estados: un botón café parece deshabilitado |
| Fondo / tarjeta | crema `#faf6ee` / `#fffdfa` | azul profundo `#0a182d` / `#15253d` | En oscuro el azul pasa a ser el fondo |
| Texto / texto secundario | `#102239` / `#4c5d6e` | `#f4f0e7` / `#a1b4c3` | 14,9:1 y 6,7:1 (claro); 15,6:1 y 7,2:1 (oscuro) |
| Borde de controles (`--input`) | `#738292` | `#6e8398` | ≥ 3:1 (WCAG 1.4.11). `--border` es solo decorativo |
| Notas informativas (`--nota`) | madera oscura sobre crema | madera clara sobre café | Reemplaza al antiguo token `--demo` |

Los hex son orientativos (conversión de los OKLCH de `index.css`, que es la única fuente).

Todos los tokens están en OKLCH dentro de `@theme` de Tailwind v4. No hay `tailwind.config.js`: en v4 se ignora por defecto.

### 2.2 Estado postural — la decisión importante

| Estado | Color | Forma | Palabra |
|---|---|---|---|
| Excelente / Buena | **verde saturado**, más vivo que la salvia | círculo con visto | "Excelente" / "Buena" |
| Vigilando | ámbar dorado, lejos del café de la madera | triángulo | "Atento" |
| Corrige | **coral apagado** (matiz ~18°), no rojo alarma ni ladrillo | octágono | "Corrige" |
| Pausa | gris azulado | dos barras | "En pausa" |

El coral apagado en lugar de `#DC2626` no es una preferencia estética: es el §9.1 aplicado. Un rojo de alarma de incendio en una aplicación de bienestar comunica emergencia, y aquí nunca hay una emergencia.

Los cuatro colores de estado pasan **≥ 4,5:1** sobre la tarjeta y sobre su propia variante suave, en ambos temas (verificado por test).

### 2.3 Gráficas: nunca rojo/verde como único par

El mapa de calor usa una **escala monocroma azul de cinco pasos**. Una escala verde→rojo es ilegible para el daltonismo rojo-verde, que afecta a cerca del 8 % de los hombres; en una prueba con 15–70 participantes, eso son varias personas que no verían nada.

Con escala monocroma la información está en la **luminancia**, que se percibe igual con cualquier tipo de visión del color.

La escala de series (`--chart-1` a `--chart-5`) combina dos azules, una salvia, una madera y un gris, todos ≥ 3:1 sobre la tarjeta, por la misma razón.

---

## 3. Los tres canales redundantes

**Esta es la pieza central de accesibilidad del proyecto.**

El criterio **WCAG 2.2 1.4.1 ("Use of Color")** prohíbe comunicar información solo con color. Un semáforo verde/ámbar/rojo lo infringe por sí solo.

Cada estado postural viaja **siempre** con tres canales simultáneos:

```
    color        +        forma        +      texto y número
  (percepción)      (inconfundible a       (inequívoco, y lo
                      16×16 px)             único que lee un
                                            lector de pantalla)
```

**El caso crítico es el icono de bandeja de Windows.** Mide 16×16 px: ahí no cabe texto y la forma pasa a ser el único canal disponible además del color. Por eso las siluetas se dibujan **a 16 px reales**, sin escalar desde un tamaño mayor — es la única forma de comprobar que siguen siendo distinguibles.

Las formas se eligieron por convención universal: **triángulo** = precaución, **octágono** = pare. No hay que aprenderlas.

Implementación: [`forma-estado.tsx`](../app/src/componentes/comunes/forma-estado.tsx) · [`insignia-estado.tsx`](../app/src/componentes/comunes/insignia-estado.tsx)

---

## 4. Tipografía

**Plus Jakarta Sans**, variable, **auto-alojada** vía Fontsource.

- **Auto-alojada, no desde CDN**: coherente con la promesa de privacidad. Una aplicación que promete no hacer llamadas de red no debería pedirle la fuente a Google.
- **Una sola familia** para títulos y cuerpo. Con nueve pantallas densas de datos, un segundo tipo añade ruido sin aportar jerarquía; la jerarquía la dan tamaño, peso y espacio.
- Misma familia que el otro prototipo del mismo cliente: consistencia entre entregables.

### Cifras tabulares

Todo puntaje, duración, porcentaje y métrica lleva `font-variant-numeric: tabular-nums` (clase `.tabular`).

Sin esto, el ancho de los dígitos cambia al actualizarse y **toda la fila parece temblar** — especialmente grave en un panel que se actualiza cinco veces por segundo.

---

## 5. Movimiento

Regla única: **el movimiento comunica causa y efecto, o no existe.**

- Transiciones de estado: 300–500 ms con salida suave. El arco del medidor y las barras del desglose interpolan; el resto no se mueve.
- **Cero animación decorativa dentro de la app.** No hay entradas escalonadas, ni parallax, ni contadores que suben.
- **Excepción acotada: la pantalla de acceso.** La columna 3D del panel izquierdo oscila despacio, sigue al mouse con parallax (±11° y ±8°, suavizado exponencial) y resalta en madera la vértebra bajo el puntero, con su nombre en un tooltip. Se permite ahí porque nadie está midiendo su postura y no hay estado que el movimiento pueda tapar. Con `prefers-reduced-motion` la columna queda quieta y solo se mantiene el resaltado, que es respuesta directa a la persona.
- Las gráficas tienen `isAnimationActive={false}`: con datos que llegan cinco veces por segundo, la animación de entrada convierte la gráfica en un temblor.
- `prefers-reduced-motion: reduce` desactiva todo globalmente (WCAG 2.3.3).

### El suavizado también es diseño

Mostrar el puntaje crudo a cinco muestras por segundo hace que el número baile, el semáforo parpadee y el desglose sea ilegible. Se suavizan **las métricas** con τ = 4 s y el puntaje se recalcula a partir de ellas.

Medido tras el cambio: **salto máximo de 1 punto entre ticks** (antes, varios). Y el desglose mantiene **orden fijo**, señalando la peor métrica con una etiqueta en vez de reordenar las filas bajo el cursor.

---

## 5.1 Composición de la pantalla principal

La cámara es la protagonista: va **al centro**, dentro de un marco de madera de bordes muy redondeados, con un anillo interior del color del estado (un canal más; la forma y el texto siguen en la insignia). Sus controles van **en una sola barra debajo del video**, siempre en el mismo sitio, con objetivos de 40 px de alto. Nada de lo que se pulsa tapa la imagen.

- Desde 1360 px: estado y cifras del día a la izquierda (las cifras sobre salvia), cámara al centro, desglose del puntaje a la derecha (fijo al hacer scroll) y la tendencia debajo, a todo el ancho.
- De 1024 a 1359 px: la cámara arriba (tope de 44 rem) y los dos rieles en dos columnas.
- Por debajo de 1024 px: una columna, con la cámara primero.
- El orden del DOM es el orden de tabulación: cámara, barra de controles, rieles.

---

## 6. Interacción y formularios

| Regla | Aplicación |
|---|---|
| Objetivo táctil ≥ 24×24 px (SC 2.5.8) | Las celdas del mapa de calor son botones de 24 px con un cuadro visual de 18 px dentro |
| Alternativa al arrastre (SC 2.5.7) | Cada deslizador de peso lleva botones de − y + |
| Foco siempre visible (SC 2.4.7) | Anillo de 2 px con desplazamiento, nunca retirado por estética |
| Etiqueta visible, no solo marcador de posición | Todos los campos |
| Valores de configuración como opciones etiquetadas | "5 por segundo — recomendado", no un campo numérico libre. Nadie que no haya escrito el algoritmo sabe qué implica poner el muestreo en 17 |
| Confirmación antes de acciones destructivas | Restablecer la referencia personal |
| Estado de carga visible | Exportaciones y corridas de benchmark |

---

## 7. Voz y copy

**Español neutro de Colombia. Tono de recordatorio, nunca de orden.**

| Prohibido en la interfaz | Se dice |
|---|---|
| landmark | punto del cuerpo (o no se menciona) |
| CLAHE | "mejorar la imagen con poca luz" |
| EMA, media móvil exponencial | "el sistema aprende tu postura habitual" |
| baseline | "tu referencia personal" |
| threshold, score | umbral, puntaje |

El §5 del prompt maestro lo exige: esos términos son válidos en el código, en los comentarios y en la documentación técnica, **pero no en la cara de un participante de la prueba**.

Comprobado por test: `resumirEnPalabras` falla si la frase generada contiene cualquiera de esas palabras.

**Ejemplos del tono:**

- ✅ *"Llevas un rato inclinado. Estira la espalda cuando puedas."*
- ❌ *"Postura incorrecta detectada. Corrija su posición."*
- ✅ *"Siéntate como te sientas siempre, no te alinees perfecto."*
- ✅ *"No te veo en cámara. La sesión se reanuda sola cuando vuelvas."*

---

## 8. Modo claro y oscuro

Diseñados **juntos**, no uno derivado del otro. El error habitual —añadir el modo oscuro tarde e invertir los colores— produce contraste insuficiente y saturaciones imposibles.

Cada paleta tiene sus propios valores y **su contraste se verificó por separado**. El primario, por ejemplo, no es el mismo tono con otra luminancia: el azul profundo desaparece sobre el fondo azul del modo oscuro, así que ahí pasa a azul claro.

Por defecto se sigue **la preferencia del sistema**, como pide el §9.1 (adaptarse al modo claro/oscuro de Windows). El tema se aplica **antes del primer render** para evitar el destello blanco.

---

## 9. Nota sobre APCA

Durante la investigación se verificó que **APCA fue retirado del borrador de WCAG 3 en 2023** y que el Editor's Draft de abril de 2026 declara el algoritmo de contraste como "por determinarse".

Cualquier decisión de contraste justificada con APCA es indefendible ante un jurado hoy. **Todo este sistema se construyó contra WCAG 2.2 AA.**

---

## 10. Cómo extenderlo

1. **¿Falta un color?** Se añade como token en `index.css`, en las dos paletas, y si forma un par de texto o de control se añade a `contraste.test.ts`. Nunca un hex en un componente — hay un test que lo impide.
2. **¿Un estado nuevo?** Necesita las tres cosas: token de color, forma propia distinguible a 16 px, y etiqueta de texto.
3. **¿Una gráfica nueva?** Usa `Grafica` de [`graficas.tsx`](../app/src/componentes/comunes/graficas.tsx): ya trae estado vacío, rejilla de bajo contraste y tooltip accesible. Un eje sin datos parece un error de carga, no una ausencia de información.
4. **¿Copy nuevo?** Pasa por el filtro de la sección 7. Si un participante de la prueba no lo entendería, se reescribe.
