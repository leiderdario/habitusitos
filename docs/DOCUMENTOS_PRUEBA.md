# Documentos para la prueba con usuarios

| Campo | Detalle |
|---|---|
| Qué es | Catálogo de los documentos de apoyo: quién los usa, cuándo y para qué |
| Se generan con | `python documentos/generar_documentos.py` |
| Salida | `app/public/documentos/` |
| Se descargan desde | La pantalla **Ayuda y errores** del prototipo (`/ayuda`) |
| Versionados | **No.** Están en `.gitignore` y se regeneran con el script |

---

## Cómo generarlos

```bash
cd "LD MOCKS/MSTR"
python documentos/generar_documentos.py
```

Requiere **Python 3.10 o superior** y **nada más**: sin `pip install`, sin reportlab, sin conexión a internet. Los PDF se escriben a mano con las fuentes base-14 que todo lector de PDF incorpora.

Esa decisión es deliberada: un script de apoyo que exige instalar dependencias es un script que alguien no va a poder correr el día que lo necesite, probablemente en el equipo prestado de un laboratorio.

El script es **determinista**: dos ejecuciones producen archivos idénticos, con la misma fecha ancla que el prototipo.

---

## El catálogo

### 1. `Consentimiento_Informado.pdf` — 2 páginas

| | |
|---|---|
| **Quién lo usa** | Cada participante |
| **Cuándo** | **Antes** de instalar nada |
| **Para qué** | Autorización firmada de participación |

Cubre la promesa de privacidad del §8.4 en lenguaje de persona normal, no de abogado: qué se calcula, qué no se guarda, dónde queda, cómo borrarlo, y el derecho a retirarse sin justificarse.

**Detalles que importan:**
- La sección de privacidad está escrita con viñetas marcadas `*`, no enterrada en un párrafo.
- Advierte de que **la luz de la cámara va a estar encendida**. Es normal y significa que está midiendo, no grabando. Sin esa frase, es la primera alarma que salta un participante.
- Tres casillas separadas: participar / ceder los datos / recibir resultados. Son decisiones distintas y no deben ir juntas.
- Campo para el **código de participante** (`P-____`), que es lo que enlaza este documento con la ficha de incidencias y con el CSV exportado.

> Conviene que lo revise quien dirija el trabajo de grado antes de usarlo, y que se ajuste a lo que exija el comité de ética de la universidad.

---

### 2. `Protocolo_Prueba_Usuario.pdf` — 2 páginas

| | |
|---|---|
| **Quién lo usa** | Quien aplica la prueba |
| **Cuándo** | Durante toda la sesión |
| **Para qué** | Guion completo, en cuatro fases |

Fases: instalación → configuración inicial → sesión de uso → cierre.

**Lo más importante del documento es la sección "Qué NO hacer":**

- **No ayudar salvo bloqueo de más de dos minutos.** El objetivo de la fase 1 es medir si alguien puede instalar la aplicación **sin asistencia**. Cada intervención destruye ese dato.
- **No explicar el algoritmo.** Si preguntan, se responde después.
- **No corregir la postura del participante** — falsearía la medición.
- **No arreglar el equipo del participante.** Registrar y seguir: la incidencia es un dato de la investigación, no un contratiempo.

Incluye las cinco preguntas de cierre **textuales**, para que se formulen igual a todos los participantes.

Un detalle a vigilar durante la calibración: si la persona **posa** para la cámara en vez de sentarse como se sienta siempre, la referencia queda inservible. Es el error más común.

---

### 3. `Guia_Rapida_Participante.pdf` — 1 página

| | |
|---|---|
| **Quién lo usa** | Cada participante |
| **Cuándo** | Junto con el instalador |
| **Para qué** | Es **lo único** que necesita leer alguien no técnico |

Una página, cero jerga. Qué hace / qué no hace / cinco pasos para empezar / dónde queda la aplicación / qué significa cada icono / qué hacer si algo no funciona.

**La tabla de iconos describe la FORMA, no el color:** "círculo con visto", "triángulo con signo", "octágono". Es la misma decisión de accesibilidad que gobierna toda la interfaz, y funciona igual para quien no distingue rojo de verde.

Cierra pidiendo que reporten **cualquier** problema, por pequeño que sea — porque eso es exactamente lo que se está midiendo.

---

### 4. `Ficha_Incidencias.pdf` — 2 páginas

| | |
|---|---|
| **Quién lo usa** | Quien aplica la prueba |
| **Cuándo** | Una ficha por participante |
| **Para qué** | Registro estructurado de todo lo que ocurre |

Secciones: identificación del equipo · instalación · configuración inicial · durante el uso · comprensión de la interfaz · cierre · observaciones libres.

**Por qué está estructurada así:** las incidencias que no se registran en el momento se olvidan, y las que se registran en texto libre no se pueden agregar después. Las casillas capturan lo previsible (alerta del antivirus, dudó al elegir cámara, posó en la calibración) y los campos abiertos capturan lo demás.

Incluye un campo textual clave: **"Qué dijo que significaba el puntaje"**. Si los participantes no lo entienden, eso es un hallazgo de usabilidad de primer orden, y solo se detecta preguntando antes de explicar.

---

### 5. `habitusitos_export_ejemplo.csv`

| | |
|---|---|
| **Quién lo usa** | Quien analice los resultados |
| **Cuándo** | **Antes** de la prueba |
| **Para qué** | Preparar los scripts de análisis contra el formato real |

Columnas: `fecha`, `promedio_score`, `minutos_activos`, `es_festivo`. 98 filas.

Coincide **campo por campo** con lo que genera el prototipo. Si uno cambia, cambia el otro.

> Tener el formato antes de recoger los datos evita el clásico: terminar la prueba y descubrir que falta una columna.

---

### 6. `benchmark_antes_despues.csv`

| | |
|---|---|
| **Quién lo usa** | Quien redacte el capítulo de resultados |
| **Cuándo** | Al preparar la metodología |
| **Para qué** | Formato de exportación del benchmark |

Dos corridas de 300 muestras. Empieza con **líneas de metadatos** (`#`) que declaran equipo, sistema operativo, **plan de energía** y segundos de calentamiento descartados.

Esos metadatos no son decoración: una corrida sin su configuración y su equipo **no es comparable con nada** y no sirve para el capítulo de resultados. El plan de energía se declara porque Windows reduce la frecuencia del procesador en modo equilibrado, y eso cambia las cifras.

Lleva una columna `en_calentamiento` para poder filtrar en el análisis.

⚠️ **La segunda línea del archivo dice que las cifras NO pueden citarse en la tesis.** Son de ejemplo.

---

## Flujo completo de una sesión

```
ANTES
  └─ Generar los documentos e imprimirlos
  └─ Preparar el CSV de ejemplo para los scripts de análisis

CON EL PARTICIPANTE
  1. Consentimiento informado  → lo lee y lo firma
  2. Guía rápida + instalador  → se le entrega, sin más explicación
  3. Protocolo                 → lo sigue quien aplica la prueba
  4. Ficha de incidencias      → se rellena sobre la marcha

DESPUÉS
  └─ Exportar los datos si autorizó, con su código de participante
  └─ Archivar consentimiento + ficha + CSV juntos
```

---

## Modificarlos

Todo el contenido está en [`documentos/generar_documentos.py`](../documentos/generar_documentos.py), en funciones separadas por documento: `consentimiento()`, `protocolo()`, `guia_rapida()`, `ficha_incidencias()`.

El motor de PDF ofrece: `titulo_principal`, `subtitulo`, `parrafo`, `vineta`, `campo` (rellenable a mano), `casilla`, `tabla` y `separador`. El salto de página es automático.

Si añades un documento, catalógalo aquí y añádelo a la lista `DOCUMENTOS` de [`app/src/funcionalidades/ayuda/pantalla.tsx`](../app/src/funcionalidades/ayuda/pantalla.tsx) para que se pueda descargar desde el prototipo.
