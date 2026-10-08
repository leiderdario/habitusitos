/**
 * Interaccion con la columna 3D: resaltado por vertebra y parallax.
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
 * - Parallax: el grupo gira hacia el puntero con interpolacion exponencial que
 *   depende de `delta`, asi la suavidad no cambia con los fps.
 * - Movimiento continuo: oscilacion lenta y una "respiracion" leve, para que la
 *   escena no se congele cuando el mouse esta quieto.
 */

import { useEffect, useRef } from "react";
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
const INTENSIDAD_RESALTE = 0.35;

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
  const invalidate = useThree((s) => s.invalidate);

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
    for (const [codigo, material] of materiales.current) {
      pintar(material, codigo === resaltada.current, colores);
    }
    invalidate();
  }, [escena, colores, invalidate]);

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

  useEffect(() => () => void (document.body.style.cursor = ""), []);

  useFrame((estado, delta) => {
    const g = grupo.current;
    if (!g || movimientoReducido) return;
    const t = estado.clock.elapsedTime;
    const destinoY = GIRO_BASE_Y + Math.sin(t * 0.3) * OSCILACION_Y + puntero.current.x * PARALLAX_Y;
    const destinoX = puntero.current.y * PARALLAX_X;
    const paso = 1 - Math.exp(-SUAVIDAD * delta);
    g.rotation.y += (destinoY - g.rotation.y) * paso;
    g.rotation.x += (destinoX - g.rotation.x) * paso;
    g.position.y = Math.sin(t * 0.9) * 0.05;
  });

  function resaltar(codigo: string | null) {
    if (resaltada.current === codigo) return;
    const anterior = resaltada.current && materiales.current.get(resaltada.current);
    if (anterior) pintar(anterior, false, colores);
    const nueva = codigo && materiales.current.get(codigo);
    if (nueva) pintar(nueva, true, colores);
    resaltada.current = codigo;
    document.body.style.cursor = codigo ? "pointer" : "";
    invalidate();
  }

  return {
    grupo,
    giroInicial: GIRO_BASE_Y,
    alEntrar(e: ThreeEvent<PointerEvent>) {
      e.stopPropagation();
      resaltar(e.object.name);
      onVertebra({ codigo: e.object.name, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
    },
    alMover(e: ThreeEvent<PointerEvent>) {
      e.stopPropagation();
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
