/**
 * Escena 3D de la columna vertebral del login.
 *
 * Aporte propio de Espinker. Se importa SOLO con React.lazy desde
 * fondo-columna.tsx: three y react-three-fiber pesan cientos de kB y no deben
 * llegar al resto de la app.
 *
 * El modelo es public/3d/columna.glb (Z-Anatomy, CC BY-SA 4.0), comprimido con
 * Draco. DRACO_GLTF_CONFIG apunta al decodificador de three con `new URL(...,
 * import.meta.url)`, asi que Vite lo empaqueta con la app: se sirve desde el
 * propio dominio, sin CDN de terceros.
 */

import { Canvas, useLoader } from "@react-three/fiber";
import { DRACO_GLTF_CONFIG, DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useColoresColumna } from "./colores";
import { useInteraccionColumna, type VertebraBajoPuntero, ZOOM_INICIAL } from "./use-interaccion-columna";

const URL_MODELO = `${import.meta.env.BASE_URL}3d/columna.glb`;

function conDraco(loader: GLTFLoader) {
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_GLTF_CONFIG);
  loader.setDRACOLoader(draco);
}

function Columna({
  movimientoReducido,
  onVertebra,
}: {
  movimientoReducido: boolean;
  onVertebra(info: VertebraBajoPuntero | null): void;
}) {
  const gltf = useLoader(GLTFLoader, URL_MODELO, conDraco);
  const colores = useColoresColumna();
  const { grupo, giroInicial, alEntrar, alMover, alSalir } = useInteraccionColumna({
    escena: gltf.scene,
    colores,
    movimientoReducido,
    onVertebra,
  });

  return (
    <>
      <ambientLight intensity={0.75} color={colores.luz} />
      <directionalLight position={[4, 6, 8]} intensity={2.2} color={colores.luz} />
      {/* Luz de contorno calida desde atras: separa la silueta del fondo azul. */}
      <directionalLight position={[-6, -2, -5]} intensity={1.1} color={colores.resalte} />
      {/* Desplazada a la derecha del panel: la frase ocupa la esquina superior izquierda. */}
      <group position={[1.6, -0.2, 0]}>
        <group ref={grupo} rotation={[0, giroInicial, 0]}>
          <primitive
            object={gltf.scene}
            onPointerOver={alEntrar}
            onPointerMove={alMover}
            onPointerOut={alSalir}
          />
        </group>
      </group>
    </>
  );
}

export default function EscenaColumna({
  movimientoReducido,
  onVertebra,
}: {
  movimientoReducido: boolean;
  onVertebra(info: VertebraBajoPuntero | null): void;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, ZOOM_INICIAL], fov: 35 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      // Con movimiento reducido no hay animacion: se dibuja solo cuando cambia algo.
      frameloop={movimientoReducido ? "demand" : "always"}
      aria-hidden
    >
      <Columna movimientoReducido={movimientoReducido} onVertebra={onVertebra} />
    </Canvas>
  );
}
