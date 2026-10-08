/**
 * Interaccion con la columna 3D: resaltado por vertebra, parallax y vista libre.
 *
 * Aporte propio de Espinker (docs/PLAN_REDISENO_ESPINKER.md, Fase 3).
 *
 * - Raycasting: lo hacen los eventos de puntero de React Three Fiber sobre cada
 *   malla. `stopPropagation` deja responder solo a la vertebra mas cercana.
 * - Resaltado: la vertebra toma el color madera y un brillo emisivo. Solo con
 *   `emissive` no se notaba: el hueso ya es casi blanco. Se cambian propiedades
 *   del material, no el material, para no crear objetos en cada evento. Cada
 *   vertebra recibe SU material al cargar: si compartieran uno, resaltar una
 *   encenderia todas.
 * - Vista libre: arrastrar con el boton principal gira la columna (vuelta
 *   completa, para ver la otra cara; la inclinacion se limita para no ponerla de
 *   cabeza) y la rueda acerca o aleja la camara. Doble clic restablece la vista.
 *   Mientras se arrastra no hay resaltado ni parallax: pelearian con el gesto.
 * - Parallax: el grupo gira hacia el puntero con interpolacion exponencial que
 *   depende de `delta`, asi la suavidad no cambia con los fps. Se SUMA a la vista
 *   libre, no la reemplaza.
 * - Movimiento continuo: oscilacion lenta y una "respiracion" leve, para que la
 *   escena no se congele cuando el mouse esta quieto.
 * - Movimiento reducido: sin parallax ni oscilacion, pero arrastrar y hacer zoom
 *   siguen funcionando porque los pide la persona; se aplican directo y se pide
 *   un cuadro (`invalidate`), ya que ahi la escena solo se dibuja a demanda.
 */

import { useCallback, useEffect, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { type Group, Mesh, MeshStandardMaterial, type Object3D } from "three";
import type { ColoresColumna } from "./colores";
import { CODIGOS_VERTEBRAS } from "./vertebras";

/** Giro base: tres cuartos de perfil, para que se vean las curvas de la columna. */
const GIRO_BASE_Y = -0.9;
const PARALLAX_Y = 0.2; // ~11°
const PARALLAX_X = 0.14; // ~8°
const OSCILACION_Y = 0.22;
const SUAVIDAD = 4;
const SUAVIDAD_ARRASTRE = 16;
const INTENSIDAD_RESALTE = 0.35;

const RADIANES_POR_PIXEL = 0.009;
/** ~63°: mas alla la columna quedaria de cabeza y costaria volver a verla de frente. */
const INCLINACION_MAXIMA = 1.1;
export const ZOOM_INICIAL = 14.5;
const ZOOM_MINIMO = 6;
const ZOOM_MAXIMO = 26;
const SENSIBILIDAD_RUEDA = 0.0012;

const limitar = (valor: number, minimo: number, maximo: number) =>
  Math.min(maximo, Math.max(minimo, valor));

function pintar(material: MeshStandardMaterial, activa: boolean, colores: ColoresColumna) {
  material.color.copy(activa ? colores.resalte : colores.hueso);
  material.emissive.copy(colores.resalte);
  material.emissiveIntensity = activa ? INTENSIDAD_RESALTE : 0;
}

export interface VertebraBajoPuntero {
  codigo: string;
  x: number;
  y: number;
}

export function useInteraccionColumna({
  escena,
  colores,
  movimientoReducido,
  onVertebra,
}: {
  escena: Object3D;
  colores: ColoresColumna;
  movimientoReducido: boolean;
  onVertebra(info: VertebraBajoPuntero | null): void;
}) {
  const grupo = useRef<Group>(null);
  const resaltada = useRef<string | null>(null);
  const puntero = useRef({ x: 0, y: 0 });
  /** Lo que la persona pidio con el mouse; la escena se acerca a esto suavemente. */
  const vista = useRef({ yaw: 0, pitch: 0, zoom: ZOOM_INICIAL });
  const arrastrando = useRef(false);
  const coloresActuales = useRef(colores);
  const invalidate = useThree((s) => s.invalidate);
  const camara = useThree((s) => s.camera);
  const lienzo = useThree((s) => s.gl.domElement);

  const materiales = useRef(new Map<string, MeshStandardMaterial>());

  // Asignar materiales a las mallas es un efecto secundario: va en un efecto y no
  // en useMemo. En desarrollo, StrictMode ejecuta useMemo dos veces y las mallas
  // terminaban con materiales distintos de los que despues se pintaban.
  useEffect(() => {
    const porCodigo = new Map<string, MeshStandardMaterial>();
    escena.traverse((objeto) => {
      if (!(objeto instanceof Mesh) || !CODIGOS_VERTEBRAS.includes(objeto.name)) return;
      const material = new MeshStandardMaterial({ roughness: 0.6, metalness: 0.05 });
      objeto.material = material;
      porCodigo.set(objeto.name, material);
    });
    materiales.current = porCodigo;
    return () => porCodigo.forEach((m) => m.dispose());
  }, [escena]);

  useEffect(() => {
    coloresActuales.current = colores;
    for (const [codigo, material] of materiales.current) {
      pintar(material, codigo === resaltada.current, colores);
    }
    invalidate();
  }, [escena, colores, invalidate]);

  const resaltar = useCallback(
    (codigo: string | null) => {
      if (resaltada.current === codigo) return;
      const anterior = resaltada.current && materiales.current.get(resaltada.current);
      if (anterior) pintar(anterior, false, coloresActuales.current);
      const nueva = codigo && materiales.current.get(codigo);
      if (nueva) pintar(nueva, true, coloresActuales.current);
      resaltada.current = codigo;
      lienzo.style.cursor = codigo ? "pointer" : arrastrando.current ? "grabbing" : "grab";
      invalidate();
    },
    [invalidate, lienzo],
  );

  // El parallax sigue al mouse en TODA la ventana, no solo sobre el lienzo: el
  // formulario ocupa el 45 % derecho y ahi tambien debe reaccionar.
  useEffect(() => {
    if (movimientoReducido) return;
    const alMover = (e: PointerEvent) => {
      puntero.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
    };
    window.addEventListener("pointermove", alMover);
    return () => window.removeEventListener("pointermove", alMover);
  }, [movimientoReducido]);

  // Vista libre: arrastrar para girar, rueda para el zoom, doble clic para volver.
  useEffect(() => {
    lienzo.style.touchAction = "none";
    lienzo.style.cursor = "grab";
    let gesto: { id: number; x: number; y: number } | null = null;

    // Con movimiento reducido no hay bucle de animacion: se aplica en el acto.
    const aplicarSiEsDirecto = () => {
      if (!movimientoReducido) return;
      const g = grupo.current;
      if (g) {
        g.rotation.y = GIRO_BASE_Y + vista.current.yaw;
        g.rotation.x = vista.current.pitch;
      }
      camara.position.z = vista.current.zoom;
      invalidate();
    };

    const alBajar = (e: PointerEvent) => {
      if (e.button !== 0) return;
      gesto = { id: e.pointerId, x: e.clientX, y: e.clientY };
      arrastrando.current = true;
      lienzo.setPointerCapture(e.pointerId);
      resaltar(null);
      onVertebra(null);
      lienzo.style.cursor = "grabbing";
    };
    const alArrastrar = (e: PointerEvent) => {
      if (!gesto || e.pointerId !== gesto.id) return;
      vista.current.yaw += (e.clientX - gesto.x) * RADIANES_POR_PIXEL;
      vista.current.pitch = limitar(
        vista.current.pitch + (e.clientY - gesto.y) * RADIANES_POR_PIXEL,
        -INCLINACION_MAXIMA,
        INCLINACION_MAXIMA,
      );
      gesto.x = e.clientX;
      gesto.y = e.clientY;
      aplicarSiEsDirecto();
    };
    const alSoltar = (e: PointerEvent) => {
      if (!gesto || e.pointerId !== gesto.id) return;
      gesto = null;
      arrastrando.current = false;
      lienzo.releasePointerCapture?.(e.pointerId);
      lienzo.style.cursor = "grab";
    };
    const alRueda = (e: WheelEvent) => {
      e.preventDefault();
      vista.current.zoom = limitar(
        vista.current.zoom * Math.exp(e.deltaY * SENSIBILIDAD_RUEDA),
        ZOOM_MINIMO,
        ZOOM_MAXIMO,
      );
      aplicarSiEsDirecto();
    };
    const alDobleClic = () => {
      vista.current = { yaw: 0, pitch: 0, zoom: ZOOM_INICIAL };
      aplicarSiEsDirecto();
    };

    lienzo.addEventListener("pointerdown", alBajar);
    lienzo.addEventListener("pointermove", alArrastrar);
    lienzo.addEventListener("pointerup", alSoltar);
    lienzo.addEventListener("pointercancel", alSoltar);
    lienzo.addEventListener("wheel", alRueda, { passive: false });
    lienzo.addEventListener("dblclick", alDobleClic);
    return () => {
      lienzo.removeEventListener("pointerdown", alBajar);
      lienzo.removeEventListener("pointermove", alArrastrar);
      lienzo.removeEventListener("pointerup", alSoltar);
      lienzo.removeEventListener("pointercancel", alSoltar);
      lienzo.removeEventListener("wheel", alRueda);
      lienzo.removeEventListener("dblclick", alDobleClic);
    };
  }, [lienzo, camara, invalidate, movimientoReducido, onVertebra, resaltar]);

  useFrame((estado, delta) => {
    const g = grupo.current;
    if (!g || movimientoReducido) return;
    const t = estado.clock.elapsedTime;
    const { yaw, pitch, zoom } = vista.current;
    const enArrastre = arrastrando.current;
    const px = enArrastre ? 0 : puntero.current.x;
    const py = enArrastre ? 0 : puntero.current.y;
    const destinoY = GIRO_BASE_Y + yaw + Math.sin(t * 0.3) * OSCILACION_Y + px * PARALLAX_Y;
    const destinoX = pitch + py * PARALLAX_X;
    const paso = 1 - Math.exp(-(enArrastre ? SUAVIDAD_ARRASTRE : SUAVIDAD) * delta);
    g.rotation.y += (destinoY - g.rotation.y) * paso;
    g.rotation.x += (destinoX - g.rotation.x) * paso;
    g.position.y = Math.sin(t * 0.9) * 0.05;
    camara.position.z += (zoom - camara.position.z) * (1 - Math.exp(-8 * delta));
  });

  return {
    grupo,
    giroInicial: GIRO_BASE_Y,
    alEntrar(e: ThreeEvent<PointerEvent>) {
      e.stopPropagation();
      if (arrastrando.current) return;
      resaltar(e.object.name);
      onVertebra({ codigo: e.object.name, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
    },
    alMover(e: ThreeEvent<PointerEvent>) {
      e.stopPropagation();
      if (arrastrando.current) return;
      if (resaltada.current !== e.object.name) resaltar(e.object.name);
      onVertebra({ codigo: e.object.name, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
    },
    alSalir(e: ThreeEvent<PointerEvent>) {
      if (resaltada.current !== e.object.name) return;
      resaltar(null);
      onVertebra(null);
    },
  };
}
