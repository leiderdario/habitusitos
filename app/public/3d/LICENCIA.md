# Licencia del modelo 3D `columna.glb`

`columna.glb` es una obra derivada y se distribuye bajo
**Creative Commons Atribución-CompartirIgual 4.0 Internacional (CC BY-SA 4.0)**:
<https://creativecommons.org/licenses/by-sa/4.0/deed.es>

Esta licencia aplica solo a este recurso. El código de Espinker sigue bajo AGPL-3.0.

## Atribución

- **Z-Anatomy — The libre 3D atlas of anatomy** — CC BY-SA 4.0.
  Gauthier Kervyn (diseño, 3D, anatomía), Marcin Zielinski, Lluís Vinent y colaboradores.
  <https://github.com/Z-Anatomy/Models-of-human-anatomy>
- **BodyParts3D** — The Database Center for Life Science — CC BY-SA 2.1 Japón.
  Kousaku Okubo (modelo original).
  <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html>

## Cambios realizados

Generado con `herramientas/3d/exportar_columna.py` a partir de `Z-Anatomy/Startup.blend`:

- Se conservaron solo las 24 vértebras (C1–C7, T1–T12, L1–L5) y el sacro; se descartó el resto.
- Cada malla se renombró con su código anatómico (`C1` … `L5`, `Sacro`).
- Se quitaron los materiales, se centró el conjunto y se escaló ×10 (1 unidad = 10 cm).
- Se exportó como glTF binario con compresión Draco.
