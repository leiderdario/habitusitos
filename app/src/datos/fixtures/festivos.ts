/**
 * Festivos de Colombia para el mapa de calor.
 *
 * Marcarlos explica los huecos del calendario: sin esto, un puente de tres dias
 * parece abandono de la aplicacion, y es justo lo contrario — la persona no
 * estaba trabajando.
 *
 * Se consultan de `date.nager.at` (API publica, sin registro ni clave) y se cae
 * a esta tabla local si no hay red. La tabla local NO es un adorno: el dia de la
 * sustentacion no puede depender de que un servicio gratuito este arriba.
 *
 * ATENCION — ESTO ES EXCLUSIVO DEL PROTOTIPO. El software real NO hace ninguna
 * llamada de red: la seccion 8.4 del prompt maestro lo declara como promesa de
 * producto hacia los 15-70 participantes, no como preferencia tecnica. En el
 * producto final esta tabla va embebida o se elimina la funcion.
 */

export interface Festivo {
  fecha: string;
  nombre: string;
}

const URL_FESTIVOS = (anio: number, pais: string) =>
  `https://date.nager.at/api/v3/PublicHolidays/${anio}/${pais}`;

/** Respaldo local. Festivos de Colombia 2026, verificados contra la misma API. */
export const FESTIVOS_RESPALDO: Festivo[] = [
  { fecha: "2026-01-01", nombre: "Ano Nuevo" },
  { fecha: "2026-01-12", nombre: "Dia de los Reyes Magos" },
  { fecha: "2026-03-23", nombre: "Dia de San Jose" },
  { fecha: "2026-04-02", nombre: "Jueves Santo" },
  { fecha: "2026-04-03", nombre: "Viernes Santo" },
  { fecha: "2026-05-01", nombre: "Dia del Trabajo" },
  { fecha: "2026-05-18", nombre: "Ascension de Jesus" },
  { fecha: "2026-06-08", nombre: "Corpus Christi" },
  { fecha: "2026-06-15", nombre: "Sagrado Corazon" },
  { fecha: "2026-06-29", nombre: "San Pedro y San Pablo" },
  { fecha: "2026-07-20", nombre: "Dia de la Independencia" },
  { fecha: "2026-08-07", nombre: "Batalla de Boyaca" },
  { fecha: "2026-08-17", nombre: "La Asuncion" },
  { fecha: "2026-10-12", nombre: "Dia de la Raza" },
  { fecha: "2026-11-02", nombre: "Todos los Santos" },
  { fecha: "2026-11-16", nombre: "Independencia de Cartagena" },
  { fecha: "2026-12-08", nombre: "Inmaculada Concepcion" },
  { fecha: "2026-12-25", nombre: "Navidad" },
];

interface RespuestaNager {
  date: string;
  localName: string;
}

/**
 * Trae los festivos del anio. Nunca lanza: si la red falla, devuelve el respaldo.
 *
 * Es el mismo patron de degradacion con gracia que el proyecto original usa para
 * el fallo de base de datos (seccion 4.3): capturar, seguir funcionando con
 * menos, no romper la pantalla entera por un dato secundario.
 */
export async function obtenerFestivos(
  anio: number,
  pais: string,
): Promise<{ festivos: Festivo[]; desdeRed: boolean }> {
  try {
    const control = new AbortController();
    const corte = setTimeout(() => control.abort(), 3500);
    const respuesta = await fetch(URL_FESTIVOS(anio, pais), { signal: control.signal });
    clearTimeout(corte);

    if (!respuesta.ok) return { festivos: FESTIVOS_RESPALDO, desdeRed: false };

    const datos: RespuestaNager[] = await respuesta.json();
    if (!Array.isArray(datos) || datos.length === 0) {
      return { festivos: FESTIVOS_RESPALDO, desdeRed: false };
    }

    return {
      festivos: datos.map((d) => ({ fecha: d.date, nombre: d.localName })),
      desdeRed: true,
    };
  } catch {
    return { festivos: FESTIVOS_RESPALDO, desdeRed: false };
  }
}
