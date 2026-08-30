# Guía de demostración — 12 minutos

| Campo | Detalle |
|---|---|
| Duración | 12 minutos de recorrido + preguntas |
| Público | Cliente, director de trabajo de grado, jurado |
| Guion en vivo | La ruta `/demo` del prototipo trae los seis escenarios con su guion y qué observar |

---

## Antes de entrar a la sala

```bash
cd app
npm run preparar-camara   # solo si vas a mostrar el modo cámara real
npm run dev
```

- [ ] Abre `/demo` y pulsa **Reiniciar la sesión**. Los escenarios se entienden mejor desde cero.
- [ ] Prueba el permiso de cámara **en el equipo donde vas a presentar**. El navegador solo lo pide una vez por dominio, y no quieres descubrirlo en vivo.
- [ ] Elige el tema según el proyector: el claro se lee mejor con luz ambiente alta.
- [ ] Ten a mano [INVESTIGACION_2026.md](INVESTIGACION_2026.md) por si preguntan por las fuentes.

---

## El recorrido

### Apertura — 30 segundos

> "Esto es un prototipo navegable de Habitusitos. Tiene todas las pantallas del producto y la lógica de puntuación implementada de verdad — la misma fórmula de siete métricas del documento. Lo que está simulado son los datos históricos, y donde algo es simulado la propia pantalla lo dice."

**Señala el aviso naranja.** Está en todas las pantallas y no se puede cerrar. Es lo que separa una demostración honesta de una que se puede confundir con producto terminado.

---

### E1 · Que funciona de verdad — 2 min · ruta `/`

> "El número grande es el puntaje de postura, de 0 a 100. No es un número mágico: son siete medidas geométricas con un peso cada una. A la derecha ves cuál te está restando más puntos ahora mismo."

**Qué señalar:**
- Las siete medidas **suman exactamente** el puntaje total. Está escrito al pie del desglose — cualquiera puede verificarlo.
- El estado se comunica con **color, forma de icono y palabra**. Los tres a la vez, siempre.
- El puntaje se mueve suave. No salta.

**Si hay cámara disponible, este es el momento:** activa *"Usar mi cámara de verdad"* e invita a alguien a sentarse frente a ella.

> "Esto no es una animación. Está corriendo detección de pose en el navegador, sacando los mismos 33 puntos del cuerpo que usa el software final, y aplicando la fórmula del documento. Encórvate un poco... ahí lo tienes."

---

### E2 · El falso positivo que NO ocurre — 1 min · ruta `/`

Ejecuta el escenario E2 desde `/demo`.

> "Voy a simular que me agacho a recoger algo del piso. Miren el puntaje: se desploma. Pero fíjense en el estado — pasa a **'Atento'**, no a 'Corrige'. El sistema está esperando a ver si esto se sostiene."

Deja pasar unos segundos. La postura se recupera.

> "Y no pasó nada. Ninguna notificación. Esto parece un detalle y es la diferencia entre una aplicación que se usa y una que se desinstala el primer día."

---

### E3 · La alerta que sí ocurre — 1 min · ruta `/`

Ejecuta E3.

> "Ahora me encorvo y me quedo así. Cuando pasa el tiempo configurado... ahí sí, aviso."

**Qué señalar:**
- Lee el texto del aviso en voz alta: *"Llevas un rato inclinado. Estira la espalda cuando puedas."* Es un recordatorio, no una orden.
- No se repite cada segundo: hay un tiempo de silencio configurable.
- El icono de la bandeja cambió de forma, no solo de color.

---

### E4 · El aporte principal — 3 min · ruta `/baseline`

**Este es el centro de la presentación.** Es lo que ninguna aplicación de la competencia tiene.

> "El sistema aprende cuál es tu buena postura habitual, en vez de compararte contra un ideal de laboratorio. Nadie se sienta igual, y exigirle a todo el mundo la misma postura es por lo que estas aplicaciones terminan desinstaladas."

Pausa en el bloque ámbar.

> "Pero eso tiene una trampa, y es la parte interesante. Si el sistema aprende de *cualquier* postura, termina aceptando tu mala postura como si fuera la normal. Cada vez avisaría menos — no porque tú mejoraras, sino porque él se acostumbró. Ese fallo hunde la idea entera."

Señala las tres tarjetas.

> "Por eso hay tres salvaguardas, y cada una lleva su contador real de cuántas muestras ha bloqueado."

Baja a la gráfica.

> "Y esta es la evidencia. Los círculos son muestras que entraron a la referencia; las cruces, las que se rechazaron. La línea morada es la referencia, y la banda punteada es el límite del que no puede salir. Miren dónde se aplana la línea: choca contra el límite y se queda ahí. La salvaguarda está funcionando y se ve."

**Si preguntan por la literatura:** el trabajo más cercano (Odesola et al., *Sensors* 2025) declara la calibración personalizada como trabajo futuro y no la implementa. No encontramos ningún trabajo que trate el problema de que el baseline se adapte hacia la mala postura. Ese es el hueco.

---

### E5 · Consumo medido — 2 min · ruta `/benchmark`

> "Esta pantalla convierte 'la aplicación es liviana' en una tabla que se puede defender."

**Sé el primero en decirlo:**

> "Ojo con el aviso de arriba: estas cifras son de ejemplo, no medidas. Lo que se demuestra aquí es el formato del entregable y la metodología. La medición real se hace con psutil sobre el software final."

**Qué señalar:**
- La zona sombreada del principio es el calentamiento, y **no entra en el promedio**. Incluye la carga de librerías y del modelo.
- El FPS baja a propósito: procesar menos imágenes **es** la optimización. Lo que importa es que la tasa de detección apenas cambie.
- El CPU siempre va junto al FPS. Sin saber la carga, un porcentaje no significa nada.

---

### E6 · Cuando algo falla — 2 min · ruta `/ayuda`

> "Esto va a probarse con 15 a 70 personas, en sus propios computadores, muchas veces sin nadie al lado. Así que todos los fallos previstos tienen una respuesta diseñada."

**Qué señalar:**
- El patrón se repite en los nueve: **qué pasó en lenguaje normal + una acción concreta**. Ninguno muestra una traza de Python.
- Si falla la base de datos, la aplicación **sigue midiendo**: simplemente no guarda.
- Las limitaciones conocidas están escritas, no escondidas. Poca luz, cámaras malas, ropa holgada.

Baja a los documentos.

> "Y aquí están los documentos de la prueba, listos para imprimir: consentimiento informado, protocolo, guía del participante y ficha de incidencias."

---

### Cierre — 30 segundos

> "Resumiendo: la lógica de puntuación y el aporte principal están implementados de verdad y con pruebas. Las pantallas están todas. Y hay un documento que le dice al desarrollador qué se traduce, qué se tira y en qué orden atacarlo — incluyendo cuatro cosas del documento original que ya no son ciertas en 2026."

---

## Preguntas probables

| Pregunta | Respuesta corta |
|---|---|
| *¿Esto es el producto?* | No. Es el prototipo navegable. El producto es una aplicación de escritorio Windows en Python. Lo que sí es real es la lógica de puntuación y el aporte de tesis. |
| *¿Los números del benchmark son reales?* | No, y la pantalla lo dice. Son el formato del entregable. La medición real se hace con psutil sobre el software final. |
| *¿Graba vídeo?* | Nunca. Se calcula y se descarta. No hay ninguna ruta de red de salida para datos de postura, y es auditable porque el código es abierto. |
| *¿Por qué web y no Python?* | Para poder enseñar todas las pantallas antes de que exista el producto. La capa de lógica está escrita sin dependencias precisamente para traducirse línea por línea. |
| *¿Cuánto falta?* | El orden de ataque está en [DE_MOCK_A_REAL.md](DE_MOCK_A_REAL.md), con los riesgos identificados. El mayor es el empaquetado: no existe hook de PyInstaller para MediaPipe. |
| *¿Y si alguien no distingue los colores?* | Cada estado lleva color, forma y palabra. El mapa de calor es monocromo. Está diseñado para eso desde el principio. |

---

## Si algo falla en vivo

| Problema | Qué hacer |
|---|---|
| La cámara no arranca | Apaga el interruptor y sigue en modo simulado. Los escenarios funcionan igual. |
| Los festivos no cargan | No pasa nada: hay tabla local de respaldo y la pantalla lo indica. |
| Un escenario se atasca | `/demo` → **Detener el escenario en curso** → **Reiniciar la sesión**. |
| Se pierde el hilo | Vuelve a `/demo`. Cada escenario trae qué decir y qué observar. |
