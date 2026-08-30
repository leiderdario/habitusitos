# Sistema de diseño — Habitusitos

| Campo | Detalle |
|---|---|
| Dirección | **Calma y cuidado, no vigilancia** |
| Criterio de accesibilidad | **WCAG 2.2 AA** — el único citable hoy (ver nota sobre APCA abajo) |
| Fuente única de tokens | [`app/src/index.css`](../app/src/index.css) |
| Regla dura | **Ningún componente escribe un hex crudo.** Verificada por test |

---

## 1. La dirección y de dónde sale

El §9.1 del prompt maestro es explícito: *"Calma, no ansiedad. Es una app de bienestar/ergonomía; la estética debe transmitir cuidado, no vigilancia ni regaño. Evitar rojos agresivos tipo alarma de incendio."*

Eso descarta dos caminos obvios:

- **El clínico frío** (azules corporativos, gris hospital): comunica "te están midiendo".
- **El de dashboard técnico** (verde/rojo saturados sobre fondo oscuro): comunica "algo va mal".

La dirección elegida es un **teal sereno** como primario. Está lo bastante cerca del azul médico para leerse como salud, y lo bastante lejos del rojo/verde de semáforo para no sentirse punitivo.

---

## 2. Color

### 2.1 Paleta base

| Rol | Claro | Oscuro | Nota |
|---|---|---|---|
| Primario | `#0E7490` teal sereno | luminancia elevada | El teal oscuro no alcanza contraste sobre fondo oscuro |
| Acento | `#059669` verde | idem | Confirmaciones, privacidad, aportes de tesis |
| Fondo | casi blanco con matiz frío | azul muy oscuro | |
| Texto secundario | 4,6:1 sobre el fondo | 4,7:1 | Ajustado **hasta** cumplir AA, no por gusto |

Todos los tokens están en OKLCH dentro de `@theme` de Tailwind v4. No hay `tailwind.config.js`: en v4 se ignora por defecto.

### 2.2 Estado postural — la decisión importante

| Estado | Color | Forma | Palabra |
|---|---|---|---|
| Excelente / Buena | teal profundo | círculo con visto | "Excelente" / "Buena" |
| Vigilando | ámbar | triángulo | "Atento" |
| Corrige | **ladrillo apagado**, no rojo alarma | octágono | "Corrige" |
| Pausa | gris azulado | dos barras | "En pausa" |

El ladrillo apagado en lugar de `#DC2626` no es una preferencia estética: es el §9.1 aplicado. Un rojo de alarma de incendio en una aplicación de bienestar comunica emergencia, y aquí nunca hay una emergencia.

Los tres colores de estado pasan **≥ 4,5:1** sobre la superficie de tarjeta, en ambos temas.

### 2.3 Gráficas: nunca rojo/verde como único par

El mapa de calor usa una **escala monocroma teal de cinco pasos**. Una escala verde→rojo es ilegible para el daltonismo rojo-verde, que afecta a cerca del 8 % de los hombres; en una prueba con 15–70 participantes, eso son varias personas que no verían nada.

Con escala monocroma la información está en la **luminancia**, que se percibe igual con cualquier tipo de visión del color.

La escala de series (`--chart-1` a `--chart-5`) es monocroma azul con un ámbar de contraste, por la misma razón.

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
- **Cero animación decorativa.** No hay entradas escalonadas, ni parallax, ni contadores que suben.
- Las gráficas tienen `isAnimationActive={false}`: con datos que llegan cinco veces por segundo, la animación de entrada convierte la gráfica en un temblor.
- `prefers-reduced-motion: reduce` desactiva todo globalmente (WCAG 2.3.3).

### El suavizado también es diseño

Mostrar el puntaje crudo a cinco muestras por segundo hace que el número baile, el semáforo parpadee y el desglose sea ilegible. Se suavizan **las métricas** con τ = 4 s y el puntaje se recalcula a partir de ellas.

Medido tras el cambio: **salto máximo de 1 punto entre ticks** (antes, varios). Y el desglose mantiene **orden fijo**, señalando la peor métrica con una etiqueta en vez de reordenar las filas bajo el cursor.

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

Cada paleta tiene sus propios valores y **su contraste se verificó por separado**. El primario, por ejemplo, no es el mismo tono con otra luminancia: el teal oscuro simplemente no alcanza contraste sobre fondo oscuro.

Por defecto se sigue **la preferencia del sistema**, como pide el §9.1 (adaptarse al modo claro/oscuro de Windows). El tema se aplica **antes del primer render** para evitar el destello blanco.

---

## 9. Nota sobre APCA

Durante la investigación se verificó que **APCA fue retirado del borrador de WCAG 3 en 2023** y que el Editor's Draft de abril de 2026 declara el algoritmo de contraste como "por determinarse".

Cualquier decisión de contraste justificada con APCA es indefendible ante un jurado hoy. **Todo este sistema se construyó contra WCAG 2.2 AA.**

---

## 10. Cómo extenderlo

1. **¿Falta un color?** Se añade como token en `index.css`, en las dos paletas, y se verifica el contraste en ambas. Nunca un hex en un componente — hay un test que lo impide.
2. **¿Un estado nuevo?** Necesita las tres cosas: token de color, forma propia distinguible a 16 px, y etiqueta de texto.
3. **¿Una gráfica nueva?** Usa `Grafica` de [`graficas.tsx`](../app/src/componentes/comunes/graficas.tsx): ya trae estado vacío, rejilla de bajo contraste y tooltip accesible. Un eje sin datos parece un error de carga, no una ausencia de información.
4. **¿Copy nuevo?** Pasa por el filtro de la sección 7. Si un participante de la prueba no lo entendería, se reescribe.
