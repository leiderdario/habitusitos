"""
Exporta la columna vertebral de Z-Anatomy a `app/public/3d/columna.glb`.

Autoria: aporte propio de Espinker (no heredado de BatesPosture). Vive fuera de
`app/` porque no es codigo de la aplicacion: es la receta, repetible, con la que
se fabrica el recurso 3D del fondo de la pantalla de acceso. Ver
docs/PLAN_REDISENO_ESPINKER.md, Fase 3, "Fondo 3D".

Origen del modelo: plantilla de Blender de Z-Anatomy (CC BY-SA 4.0), derivada de
BodyParts3D (CC BY-SA 2.1 JP). El .glb resultante hereda CC BY-SA 4.0: ver
app/public/3d/LICENCIA.md.

Que hace:
1. Toma solo las 24 vertebras y el sacro (sin discos, costillas ni coccix).
2. Copia cada malla en coordenadas de mundo, sin padres ni
   materiales (el color lo pone la app segun el tema), y exporta solo esas copias.
3. Nombra cada malla con su codigo (C1..C7, T1..T12, L1..L5, Sacro). La logica de
   interaccion de la app depende SOLO de esos nombres.
4. Centra el conjunto en el origen y escala x10 (1 unidad = 10 cm).
5. Exporta glTF binario con compresion Draco y, al final, lo vuelve a importar
   para comprobar que estan exactamente las 25 mallas esperadas.

Uso (Blender 4.2 o superior, sin interfaz):
    blender -b --disable-autoexec --factory-startup <ruta>/Z-Anatomy/Startup.blend \
        --python herramientas/3d/exportar_columna.py -- app/public/3d/columna.glb

`--disable-autoexec` importa: el .blend trae un script propio que no hace falta
ejecutar para leer las mallas.
"""

import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

# Nombre del objeto en Z-Anatomy -> codigo que usa la app.
ORIGEN_A_CODIGO = {
    "Atlas (C1)": "C1",
    "Axis (C2)": "C2",
    **{f"Vertebra C{i}": f"C{i}" for i in range(3, 8)},
    **{f"Vertebra T{i}": f"T{i}" for i in range(1, 13)},
    **{f"Vertebra L{i}": f"L{i}" for i in range(1, 6)},
    "Sacrum": "Sacro",
}

ESCALA = 10.0  # metros -> unidades de 10 cm


def ruta_salida() -> Path:
    argumentos = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(argumentos) != 1:
        raise SystemExit("Uso: ... --python exportar_columna.py -- <salida.glb>")
    return Path(argumentos[0]).resolve()


def copiar_mallas() -> list[bpy.types.Object]:
    faltan = [n for n in ORIGEN_A_CODIGO if n not in bpy.data.objects]
    if faltan:
        raise SystemExit(f"El .blend no tiene estas mallas: {faltan}")

    escena = bpy.context.scene
    for objeto in escena.objects:
        objeto.select_set(False)
    copias = []
    for nombre_origen, codigo in ORIGEN_A_CODIGO.items():
        origen = bpy.data.objects[nombre_origen]
        malla = origen.data.copy()
        malla.name = codigo
        malla.materials.clear()
        malla.transform(origen.matrix_world)
        objeto = bpy.data.objects.new(codigo, malla)
        escena.collection.objects.link(objeto)
        objeto.select_set(True)
        copias.append(objeto)
    return copias


def centrar_y_escalar(objetos: list[bpy.types.Object]) -> None:
    puntos = [v.co for o in objetos for v in o.data.vertices]
    minimo = Vector(min(p[i] for p in puntos) for i in range(3))
    maximo = Vector(max(p[i] for p in puntos) for i in range(3))
    centro = (minimo + maximo) / 2
    global_ = Matrix.Scale(ESCALA, 4) @ Matrix.Translation(-centro)

    for objeto in objetos:
        objeto.data.transform(global_)
        # Origen de cada vertebra en su propio centro: el resaltado y cualquier
        # movimiento por vertebra giran sobre la pieza, no sobre la columna.
        cs = [v.co for v in objeto.data.vertices]
        propio = Vector(sum(c[i] for c in cs) / len(cs) for i in range(3))
        objeto.data.transform(Matrix.Translation(-propio))
        objeto.location = propio


def exportar(salida: Path) -> None:
    salida.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(salida),
        export_format="GLB",
        use_selection=True,
        export_materials="NONE",
        export_yup=True,
        export_normals=True,
        export_texcoords=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )


def verificar(salida: Path) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(salida))
    encontrados = sorted(o.name for o in bpy.data.objects if o.type == "MESH")
    esperados = sorted(ORIGEN_A_CODIGO.values())
    if encontrados != esperados:
        raise SystemExit(f"El .glb no tiene las mallas esperadas: {encontrados}")
    triangulos = sum(len(p.vertices) - 2 for o in bpy.data.objects for p in o.data.polygons)
    alto = max(o.location.z for o in bpy.data.objects) - min(o.location.z for o in bpy.data.objects)
    print(
        f"COLUMNA_OK mallas={len(encontrados)} triangulos={triangulos} "
        f"kb={salida.stat().st_size // 1024} alto_centros={alto:.2f}"
    )


salida = ruta_salida()
centrar_y_escalar(copiar_mallas())
exportar(salida)
verificar(salida)
