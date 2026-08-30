/**
 * Escenarios guionados de demostracion.
 *
 * Un mock sin guion se presenta mal: quien lo ensena hace clic al azar y el
 * cliente no entiende que esta viendo. Cada escenario dice que demuestra, que
 * decir mientras corre y que observar al final.
 *
 * EL ORDEN IMPORTA. E1 establece que funciona. E2 y E3 muestran las decisiones
 * de diseno que evitan que la app sea molesta — que es la queja number uno de
 * este tipo de producto. E4 y E5 son el cierre: son los aportes de tesis, lo
 * unico que ninguna app de la competencia tiene.
 */

import type { EstadoPostural } from "@/dominio/tipos";

export type TipoEscenario = "postura" | "error" | "aporte";

export interface Escenario {
  id: string;
  numero: string;
  titulo: string;
  /** Una linea: que demuestra. Se ve en el selector. */
  demuestra: string;
  /** Para quien presenta: que decir mientras se ejecuta. */
  guion: string;
  /** Que debe observar el presentador cuando termine. */
  observar: string[];
  tipo: TipoEscenario;
  duracionAprox: string;
  ruta: string;
  /** Guion de puntajes que se inyecta al motor de simulacion, en orden. */
  inyeccion?: { puntajeObjetivo: number; segundos: number }[];
  /** Estado que se fuerza (para escenarios de error). */
  forzarEstado?: EstadoPostural;
  /** Codigo de error que se dispara. */
  forzarError?: string;
}

export const ESCENARIOS: Escenario[] = [
  {
    id: "e1",
    numero: "E1",
    titulo: "Medicion en tiempo real",
    demuestra: "Que el sistema mide postura de verdad, con las siete metricas del documento.",
    guion:
      "Esto es el panel de la sesion. El numero grande es el puntaje de postura de 0 a 100. Abajo esta el desglose: no es un numero magico, son siete medidas geometricas con un peso cada una, y puedes ver cual esta bajando. Si activas el modo camara, ese numero sale de tu propia postura ahora mismo.",
    observar: [
      "El puntaje se mueve de forma suave, sin saltos erraticos entre muestras.",
      "El desglose de las siete metricas suma exactamente el puntaje total.",
      "El estado se comunica con color, forma de icono Y texto, nunca solo con color.",
    ],
    tipo: "postura",
    duracionAprox: "2 min",
    ruta: "/",
    inyeccion: [
      { puntajeObjetivo: 88, segundos: 12 },
      { puntajeObjetivo: 74, segundos: 15 },
      { puntajeObjetivo: 90, segundos: 12 },
    ],
  },
  {
    id: "e2",
    numero: "E2",
    titulo: "El falso positivo que NO ocurre",
    demuestra:
      "Que agacharse un momento no dispara una alerta. Es la diferencia entre una app util y una que se desinstala el primer dia.",
    guion:
      "Voy a simular que me agacho a recoger algo del piso: el puntaje se desploma. Fijense en el estado: pasa a 'Atento', no a 'Corrige'. El sistema esta esperando a ver si esto se sostiene. Vuelvo a sentarme bien y... no paso nada. Ninguna notificacion. Ahora comparen con el siguiente escenario.",
    observar: [
      "El estado pasa por 'Atento' (triangulo ambar) y nunca llega a 'Corrige'.",
      "No aparece ninguna notificacion en la bandeja.",
      "El contador de vigilancia se reinicia al recuperar la postura.",
    ],
    tipo: "postura",
    duracionAprox: "1 min",
    ruta: "/",
    inyeccion: [
      { puntajeObjetivo: 88, segundos: 8 },
      { puntajeObjetivo: 32, segundos: 6 },
      { puntajeObjetivo: 89, segundos: 10 },
    ],
  },
  {
    id: "e3",
    numero: "E3",
    titulo: "La alerta que si ocurre",
    demuestra: "Que la mala postura sostenida si avisa, y que el aviso es amable, no un regano.",
    guion:
      "Ahora me encorvo y me quedo asi. Miren el cronometro de vigilancia. Cuando pasa el tiempo configurado, ahi si: notificacion. Lean el texto — es un recordatorio, no una orden. Y no se va a repetir cada segundo: hay un tiempo de silencio configurable.",
    observar: [
      "La notificacion aparece solo tras el tiempo sostenido configurado, no antes.",
      "El texto usa tono de recordatorio, sin lenguaje punitivo.",
      "El icono de bandeja cambia de forma ademas de color.",
    ],
    tipo: "postura",
    duracionAprox: "1 min",
    ruta: "/",
    inyeccion: [
      { puntajeObjetivo: 85, segundos: 5 },
      { puntajeObjetivo: 41, segundos: 40 },
    ],
  },
  {
    id: "e4",
    numero: "E4",
    titulo: "Baseline adaptativo y su salvaguarda",
    demuestra:
      "El aporte 1 de la tesis, y sobre todo el problema que resuelve: que el sistema NO se acostumbre a la mala postura.",
    guion:
      "Aqui esta la contribucion principal. El sistema aprende cual es tu buena postura habitual, en vez de compararte contra un ideal de laboratorio. Pero eso tiene una trampa: si aprende de todo, termina aceptando tu mala postura como normal y deja de avisar. Miren la grafica: los puntos verdes son muestras que entraron; los grises, las que se rechazaron. Y la banda punteada es el limite duro del que el baseline no puede salir.",
    observar: [
      "La linea del baseline nunca cruza la banda de deriva maxima.",
      "Las muestras rechazadas aparecen agrupadas por motivo, no como un total opaco.",
      "En estado de alerta el baseline se congela: la curva se aplana.",
    ],
    tipo: "aporte",
    duracionAprox: "3 min",
    ruta: "/baseline",
  },
  {
    id: "e5",
    numero: "E5",
    titulo: "Consumo de recursos medido",
    demuestra:
      "El aporte 2: la comparacion antes/despues exportable, que es la evidencia del capitulo de resultados.",
    guion:
      "Esta pantalla convierte 'la app es liviana' en una tabla que se puede defender. Dos configuraciones, misma metodologia, y el CSV sale listo para el documento. Ojo con el aviso de arriba: estas cifras son de ejemplo, la medicion real se hace con psutil sobre el software final.",
    observar: [
      "La zona de calentamiento aparece sombreada y NO entra en el promedio.",
      "El CPU siempre se reporta junto al FPS efectivo: sin la carga, el porcentaje no dice nada.",
      "El aviso de que las cifras son simuladas esta visible y no se puede cerrar.",
    ],
    tipo: "aporte",
    duracionAprox: "2 min",
    ruta: "/benchmark",
  },
  {
    id: "e6",
    numero: "E6",
    titulo: "Cuando algo falla",
    demuestra:
      "Que ningun error deja al usuario en un callejon sin salida. Importa porque son 15 a 70 personas en equipos que nadie controla.",
    guion:
      "Estos son todos los fallos previstos en el documento. Fijense en el patron: cada uno dice que paso en lenguaje normal, y cada uno ofrece algo que hacer. Ninguno muestra una traza de Python. Si se cae la base de datos, la app sigue midiendo: simplemente no guarda.",
    observar: [
      "Cada error tiene titulo, explicacion y una accion concreta.",
      "Ningun mensaje contiene jerga tecnica ni rutas de archivo internas.",
      "El fallo de base de datos degrada la funcion, no tumba la aplicacion.",
    ],
    tipo: "error",
    duracionAprox: "2 min",
    ruta: "/ayuda",
  },
];

export const ESCENARIO_POR_ID = new Map(ESCENARIOS.map((e) => [e.id, e]));
