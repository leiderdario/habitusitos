# Habitusitos — instrucciones del agente

> **Al iniciar sesión:** leer [MEMORY.md](MEMORY.md) (estado vivo, decisiones tomadas, pendientes).
> **Este archivo** = reglas durables, el "cómo". **MEMORY.md** = estado mutable, el "qué".
> Nunca mezclar los dos.

---

## 1. Qué es esto

Prototipo navegable de **Habitusitos**, aplicación de escritorio Windows que monitorea la postura por webcam. Trabajo de grado, Universidad de Cartagena. Derivado de BatesPosture bajo **AGPL-3.0**.

**El prototipo no es el producto.** El producto final es Python + PyQt6 + MediaPipe. Antes de tocar nada, leer:

1. [PROMPT_MAESTRO_HABITUSITOS.md](PROMPT_MAESTRO_HABITUSITOS.md) — la especificación
2. [docs/INVESTIGACION_2026.md](docs/INVESTIGACION_2026.md) §1 — **seis contradicciones** entre esa especificación y la realidad de julio de 2026
3. [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) — las capas y sus reglas

---

## 2. Idioma

- **Todo en español**: identificadores, comentarios, textos de interfaz, mensajes de commit, respuestas al usuario.
- **Español neutro, sin voseo.** Tercera persona o tuteo neutral ("tienes", "puedes", "verifica"), **nunca** voseo ("tenés", "podés", "vos", "verificá"). Aplica también a los prompts para otros agentes, planes y respuestas de chat.
- **Regla ñ**: NO usar `ñ` ni tildes en identificadores ni nombres de archivo. SÍ en textos de interfaz y documentación.
- **Excepción deliberada**: los campos que espejan columnas de la base de datos van en `snake_case` **inglés** (`timestamp`, `metric_name`, `baseline_value`). **Ya existen** en `data/database.py`; traducirlos crearía una capa de conversión que mantener y un sitio donde el prototipo y la base de datos podrían divergir en silencio.

### Jerga prohibida en la interfaz

El §5 del prompt maestro lo exige. Válido en código, comentarios y documentación; **prohibido en pantalla**:

| No decir | Decir |
|---|---|
| landmark | punto del cuerpo (o no mencionarlo) |
| CLAHE | "mejorar la imagen con poca luz" |
| EMA, media móvil exponencial | "el sistema aprende tu postura habitual" |
| baseline | "tu referencia personal" |
| score, threshold | puntaje, umbral |

Hay un test que lo verifica en la frase generada del panel.

---

## 3. Arquitectura — reglas duras

```
config → dominio → datos → camara → componentes → funcionalidades
```

Una capa solo importa de capas anteriores o de sí misma. **Todo esto se verifica en `app/src/arquitectura.test.ts`; si se rompe, la suite se pone roja.**

| Regla | Por qué |
|---|---|
| **`dominio/` no importa NADA externo** — ni React, ni config, ni store | Es lo único que se traduce a Python línea por línea |
| Ninguna funcionalidad importa de otra funcionalidad | Si algo se comparte, sube a `componentes/comunes/` |
| Las pantallas nunca importan `datos/fixtures/*`, `almacen.ts` ni `semilla.ts` | Todo pasa por `datos/api/*`. Si una pantalla lee la fixture directo, migrar al backend obliga a reescribirla |
| **Ningún componente escribe un hex crudo** | Sin esto el modo oscuro y el contraste AA se rompen a pedazos |
| **Nada usa `Math.random()` ni `new Date()` sin argumentos** | Dos demostraciones consecutivas deben verse idénticas |

> Estas reglas ya cazaron dos violaciones reales durante la construcción (ajustes y demo importaban fixtures). Se corrigieron **moviendo los datos a la frontera**, no silenciando el test. Ese es el patrón: si el test molesta, el código está mal, no el test.

### Principios de código

- **SOLID práctico**: un módulo = un dominio. El baseline adaptativo **extiende** el motor de puntaje sin tocarlo (transforma las métricas antes de que las reciba) y se puede apagar.
- **Reúso primero**: buscar en `componentes/comunes/` y `dominio/` antes de crear. Un archivo por componente; evitar >500 líneas.
- **Tipado estricto**, evitar `any`. `erasableSyntaxOnly` está activo: **sin enums ni propiedades de parámetro en constructores**.
- **Alias `@/` obligatorio.** Nunca rutas relativas que suban más de un nivel.
- **`config` es `as const`**: sus valores son literales. `useState(config.X)` infiere el literal, no `number` — hay que tipar explícitamente.
- **Comentarios solo del porqué no obvio** (invariante, gotcha, decisión). Nunca del qué.
- **Sin código muerto ni shims de retrocompatibilidad** salvo petición explícita.

---

## 4. Trazabilidad de autoría — no negociable

El §0.3 del prompt maestro lo exige: el autor debe defender el código ante un jurado.

**Cada archivo declara en su cabecera si es heredado de BatesPosture o aporte propio de Habitusitos, y por qué está donde está.** No es documentación decorativa; es un requisito evaluable.

Los aportes de tesis viven en **módulos propios y claramente nombrados**, nunca mezclados dentro de archivos heredados.

---

## 5. Honestidad de los datos

- **Todo lo simulado se declara en la propia pantalla.** El aviso de demostración no se cierra ni se atenúa.
- **Las cifras del benchmark NO pueden citarse en la tesis.** La pantalla lo dice con un aviso permanente. Si alguien pide "quitar el aviso para que se vea mejor", la respuesta es no.
- **Nunca inventar un dato y presentarlo como medido.** Si un valor es una decisión de diseño y no un resultado, se marca como PENDIENTE con su razón.
- **`MODO_DATOS=http` lanza un error explícito** en vez de devolver datos simulados en silencio.
- Si un test está en rojo, se dice. Si un paso se saltó, se dice.

---

## 6. Diseño e interfaz

Detalle completo en [docs/SISTEMA_DISENO.md](docs/SISTEMA_DISENO.md).

- **Dirección: calma, no vigilancia.** El §9.1 prohíbe los rojos agresivos tipo alarma de incendio.
- **WCAG 2.2 AA es el criterio.** APCA fue retirado de WCAG 3 en 2023 y es indefendible hoy.
- **El estado postural viaja SIEMPRE en tres canales**: color + forma de icono + texto. El icono de bandeja mide 16×16 px: ahí la forma es el único canal además del color, y ~8 % de los hombres no distingue rojo de verde.
- **Gráficas: nunca rojo/verde como único par.** El mapa de calor es monocromo teal.
- **Valores numéricos de configuración = opciones etiquetadas**, no campos libres. Nadie que no haya escrito el algoritmo sabe qué implica poner el muestreo en 17.
- **Cifras tabulares** en todo puntaje, duración y métrica, o la fila tiembla al actualizarse.
- **Cero animación decorativa.** El movimiento comunica causa y efecto o no existe. `prefers-reduced-motion` respetado.
- **Decisiones visuales con varias opciones viables → presentar referencias visuales** y dejar elegir al usuario. Nunca elegir por él ni describir las opciones solo en texto.

---

## 7. Trabajo

- **Brainstorming antes de cualquier feature.** TDD en lógica no trivial. Verificación real (tests + build + smoke) antes de decir "listo".
- **Plan mode** antes de features con >3 archivos o que crucen capas. **TodoWrite** para 3+ pasos.
- **Bug = causa raíz, no síntoma.** Antes de editar, revisar quién más llama a la función. Un arreglo en la función compartida es un diff más pequeño que un parche en cada llamador.
- **Verificar contra el árbol real, no contra la memoria.** Antes de tipar o asumir una forma de datos, leerla.
- **Reportar en vez de asumir.** Si el código base no está claro o contradice el documento, se dice antes de parchear (§0.5 del prompt maestro).
- Respuestas concisas. Referencias como `archivo:línea` en formato de enlace markdown.

### Gates antes de "listo"

```bash
cd app && npm run verificar     # lint + test + build
```

Más smoke visual de las rutas tocadas si el cambio es de interfaz.

---

## 8. Gotchas de este proyecto

| Área | Gotcha |
|---|---|
| **Tailwind v4** | Sin `tailwind.config.js`: los tokens van en `@theme` dentro de `index.css`. `@tailwind base/components/utilities` ya no existe. `tailwindcss` y `@tailwindcss/vite` deben ir en lockstep |
| **Base UI (shadcn `base-nova`)** | Usa `render={<Componente/>}`, no `asChild`. `SelectValue` muestra el **valor crudo**: usar `CampoSelect` de `componentes/comunes/`. Las clases `data-horizontal:` que genera shadcn **no funcionan**: hace falta `data-[orientation=horizontal]:` |
| **lucide-react 1.x** | Eliminó los iconos de marca. `Github` ya no existe |
| **react-router 8** | Todo se importa de `react-router`. **No instalar `react-router-dom`**: está congelado en 7.18.2 |
| **TypeScript 6** | `baseUrl` está obsoleto: usar solo `paths`. `tsc -b` a veces falla con códigos raros — `npm run build` lo ejecuta igual y es fiable |
| **MediaPipe** | Los `.wasm` **no se pueden renombrar**: viven en `public/` y no pasan por el bundler. `detectForVideo` exige timestamps estrictamente crecientes |
| **Windows / PowerShell 5.1** | Sin `&&` ni `??`. `[System.Text.Encoding]::Latin1` no existe (usar `GetEncoding(28591)`). Para heredocs y texto multilínea, preferir la herramienta Bash |

---

## 9. Git

- **Stage por ruta**, nunca `git add .` ni `-A`.
- Commits `tipo(scope): descripción`, en español.
- **Sin trailer `Co-Authored-By`.**
- Nunca `--force`, `--amend` ni `--no-verify` sin OK explícito. Nunca `push` sin que el usuario lo pida.
- No versionar: `app/public/wasm/`, `app/public/modelos/`, `app/public/documentos/`, `dist/`, `node_modules/`. Se regeneran con `npm run preparar-camara` y `python documentos/generar_documentos.py`.

---

## 10. Lo que NO se hace

- Quitar el aviso de demostración de ninguna pantalla.
- Presentar cifras simuladas como medidas.
- Añadir llamadas de red al software real. El §8.4 promete que no las hay, y es una promesa hacia los 15-70 participantes.
- Cambiar la licencia o cerrar el código: la AGPL-3.0 es hereditaria.
- Silenciar un test de arquitectura en vez de arreglar el código.
- Usar jerga técnica en la interfaz.
