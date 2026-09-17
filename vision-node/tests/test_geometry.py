"""Pruebas unitarias de cálculo geométrico y métricas posturales."""

import pytest
from vision_node.geometry import (
    Keypoint,
    calculate_posture_metrics,
    angle_with_vertical,
    distance_2d,
    midpoint,
    COCO_NOSE,
    COCO_LEFT_EAR,
    COCO_RIGHT_EAR,
    COCO_LEFT_SHOULDER,
    COCO_RIGHT_SHOULDER,
    COCO_LEFT_HIP,
    COCO_RIGHT_HIP,
)


def make_blank_kpts(n: int = 17, default_conf: float = 0.9) -> list[Keypoint]:
    return [Keypoint(x=0.0, y=0.0, conf=default_conf) for _ in range(n)]


def test_angle_with_vertical_perfect_upright():
    # Vector apuntando perfectamente hacia arriba en coordenadas de imagen (dy < 0)
    p_from = Keypoint(x=300.0, y=400.0)
    p_to = Keypoint(x=300.0, y=200.0)
    ang = angle_with_vertical(p_from, p_to)
    assert pytest.approx(ang, abs=0.1) == 0.0


def test_angle_with_vertical_45_degrees():
    # Inclinación de 45 grados hacia la derecha (dx = 100, dy = -100)
    p_from = Keypoint(x=300.0, y=400.0)
    p_to = Keypoint(x=400.0, y=300.0)
    ang = angle_with_vertical(p_from, p_to)
    assert pytest.approx(ang, abs=0.1) == 45.0


def test_perfect_posture_metrics():
    kpts = make_blank_kpts()
    # Caderas
    kpts[COCO_LEFT_HIP] = Keypoint(x=280.0, y=450.0, conf=0.95)
    kpts[COCO_RIGHT_HIP] = Keypoint(x=320.0, y=450.0, conf=0.95)
    # Hombros nivelados perfectamente centrados sobre caderas
    kpts[COCO_LEFT_SHOULDER] = Keypoint(x=260.0, y=300.0, conf=0.95)
    kpts[COCO_RIGHT_SHOULDER] = Keypoint(x=340.0, y=300.0, conf=0.95)
    # Cabeza y orejas centradas sobre hombros
    kpts[COCO_LEFT_EAR] = Keypoint(x=285.0, y=220.0, conf=0.95)
    kpts[COCO_RIGHT_EAR] = Keypoint(x=315.0, y=220.0, conf=0.95)
    kpts[COCO_NOSE] = Keypoint(x=300.0, y=230.0, conf=0.95)

    metrics = calculate_posture_metrics(
        kpts=kpts,
        min_conf=0.35,
        trunk_max_angle=25.0,
        neck_max_angle=30.0,
        shoulder_diff_max=0.07,
    )

    assert metrics.is_valid is True
    assert metrics.trunk_angle is not None
    assert metrics.neck_angle is not None
    assert pytest.approx(metrics.trunk_angle, abs=1.0) == 0.0
    assert pytest.approx(metrics.neck_angle, abs=1.0) == 0.0
    assert pytest.approx(metrics.shoulder_diff, abs=0.01) == 0.0
    assert metrics.is_correct is True


def test_slouched_trunk_bad_posture():
    kpts = make_blank_kpts()
    # Caderas en x=300
    kpts[COCO_LEFT_HIP] = Keypoint(x=280.0, y=450.0, conf=0.95)
    kpts[COCO_RIGHT_HIP] = Keypoint(x=320.0, y=450.0, conf=0.95)
    # Hombros desplazados fuertemente hacia adelante (dx=100, dy=-150) -> ~33.7°
    kpts[COCO_LEFT_SHOULDER] = Keypoint(x=360.0, y=300.0, conf=0.95)
    kpts[COCO_RIGHT_SHOULDER] = Keypoint(x=440.0, y=300.0, conf=0.95)
    # Orejas sobre hombros
    kpts[COCO_LEFT_EAR] = Keypoint(x=385.0, y=220.0, conf=0.95)
    kpts[COCO_RIGHT_EAR] = Keypoint(x=415.0, y=220.0, conf=0.95)

    metrics = calculate_posture_metrics(
        kpts=kpts,
        min_conf=0.35,
        trunk_max_angle=25.0,
        neck_max_angle=30.0,
        shoulder_diff_max=0.07,
    )

    assert metrics.is_valid is True
    assert metrics.trunk_angle is not None
    assert metrics.trunk_angle > 30.0
    assert metrics.is_correct is False


def test_forward_head_bad_posture():
    kpts = make_blank_kpts()
    # Caderas y hombros alineados
    kpts[COCO_LEFT_HIP] = Keypoint(x=280.0, y=450.0, conf=0.95)
    kpts[COCO_RIGHT_HIP] = Keypoint(x=320.0, y=450.0, conf=0.95)
    kpts[COCO_LEFT_SHOULDER] = Keypoint(x=260.0, y=300.0, conf=0.95)
    kpts[COCO_RIGHT_SHOULDER] = Keypoint(x=340.0, y=300.0, conf=0.95)
    # Cabeza proyectada hacia adelante (dx=60, dy=-80) -> ~36.8°
    kpts[COCO_LEFT_EAR] = Keypoint(x=345.0, y=220.0, conf=0.95)
    kpts[COCO_RIGHT_EAR] = Keypoint(x=375.0, y=220.0, conf=0.95)

    metrics = calculate_posture_metrics(
        kpts=kpts,
        min_conf=0.35,
        trunk_max_angle=25.0,
        neck_max_angle=30.0,
        shoulder_diff_max=0.07,
    )

    assert metrics.is_valid is True
    assert metrics.neck_angle is not None
    assert metrics.neck_angle > 32.0
    assert metrics.is_correct is False


def test_shoulder_asymmetry():
    kpts = make_blank_kpts()
    kpts[COCO_LEFT_HIP] = Keypoint(x=280.0, y=450.0, conf=0.95)
    kpts[COCO_RIGHT_HIP] = Keypoint(x=320.0, y=450.0, conf=0.95)
    # Hombro izquierdo visiblemente más caído que el derecho
    # Ancho ~80px, desnivel vertical 20px -> diff = 20 / 80 = 0.25 (excede 0.07)
    kpts[COCO_LEFT_SHOULDER] = Keypoint(x=260.0, y=310.0, conf=0.95)
    kpts[COCO_RIGHT_SHOULDER] = Keypoint(x=340.0, y=290.0, conf=0.95)
    kpts[COCO_LEFT_EAR] = Keypoint(x=285.0, y=220.0, conf=0.95)
    kpts[COCO_RIGHT_EAR] = Keypoint(x=315.0, y=220.0, conf=0.95)

    metrics = calculate_posture_metrics(
        kpts=kpts,
        min_conf=0.35,
        trunk_max_angle=25.0,
        neck_max_angle=30.0,
        shoulder_diff_max=0.07,
    )

    assert metrics.is_valid is True
    assert metrics.shoulder_diff is not None
    assert metrics.shoulder_diff > 0.2
    assert metrics.is_correct is False


def test_occlusion_guard_does_not_invent_metrics():
    kpts = make_blank_kpts()
    # Hombros con confianza por debajo del umbral
    kpts[COCO_LEFT_SHOULDER] = Keypoint(x=260.0, y=300.0, conf=0.20)
    kpts[COCO_RIGHT_SHOULDER] = Keypoint(x=340.0, y=300.0, conf=0.15)

    metrics = calculate_posture_metrics(kpts=kpts, min_conf=0.35)
    assert metrics.is_valid is False
    assert "Hombros ocluidos" in (metrics.reason_invalid or "")
    assert metrics.is_correct is None
