"""Pruebas unitarias para la capa de mapeo COCO-17 a BlazePose-33."""

from vision_node.geometry import Keypoint
from vision_node.mapper import coco_to_blazepose_landmarks


def test_coco_to_blazepose_mapping():
    # 17 keypoints sintéticos en un cuadro de 1000x1000
    coco_kpts = [Keypoint(0.0, 0.0, 0.0) for _ in range(17)]
    # Nariz (COCO 0 -> BlazePose 0)
    coco_kpts[0] = Keypoint(500.0, 200.0, 0.9)
    # Hombro izq (COCO 5 -> BlazePose 11)
    coco_kpts[5] = Keypoint(400.0, 300.0, 0.95)
    # Hombro der (COCO 6 -> BlazePose 12)
    coco_kpts[6] = Keypoint(600.0, 300.0, 0.95)
    # Cadera izq (COCO 11 -> BlazePose 23)
    coco_kpts[11] = Keypoint(420.0, 600.0, 0.85)
    # Cadera der (COCO 12 -> BlazePose 24)
    coco_kpts[12] = Keypoint(580.0, 600.0, 0.85)

    bp = coco_to_blazepose_landmarks(coco_kpts, 1000, 1000)

    assert len(bp) == 33
    assert bp[0]["x"] == 0.5
    assert bp[0]["y"] == 0.2
    assert bp[11]["x"] == 0.4
    assert bp[11]["y"] == 0.3
    assert bp[12]["x"] == 0.6
    assert bp[12]["y"] == 0.3
    assert bp[23]["x"] == 0.42
    assert bp[23]["y"] == 0.6
    assert bp[24]["x"] == 0.58
    assert bp[24]["y"] == 0.6
