"""Pruebas unitarias de mapeo espacial de personas a escritorios (ROIs)."""

import pytest
from vision_node.config import DeskZone
from vision_node.geometry import COCO_LEFT_HIP, COCO_RIGHT_HIP, Keypoint
from vision_node.spatial_mapping import (
    PersonDetection,
    match_people_to_desks,
    point_in_polygon,
    polygon_centroid,
)


def make_detection(x_px: float, y_px: float, track_id: int) -> PersonDetection:
    kpts = [Keypoint(0.0, 0.0, 0.1) for _ in range(17)]
    # Caderas como ancla principal
    kpts[COCO_LEFT_HIP] = Keypoint(x=x_px - 10, y=y_px, conf=0.9)
    kpts[COCO_RIGHT_HIP] = Keypoint(x=x_px + 10, y=y_px, conf=0.9)
    return PersonDetection(
        track_id=track_id,
        keypoints=kpts,
        bbox=(x_px - 20, y_px - 50, x_px + 20, y_px + 50),
    )


def test_point_in_polygon():
    # Polígono rectangular normalizado
    poly = [[0.1, 0.1], [0.5, 0.1], [0.5, 0.8], [0.1, 0.8]]
    assert point_in_polygon(0.3, 0.4, poly) is True
    assert point_in_polygon(0.6, 0.4, poly) is False
    assert point_in_polygon(0.0, 0.0, poly) is False


def test_match_people_to_desks_and_passersby():
    # Dos escritorios (izq y der) con un pasillo en el centro
    desk_left = DeskZone(
        desk_id="desk_left",
        label="Puesto Izq",
        roi_polygon=[[0.0, 0.0], [0.4, 0.0], [0.4, 1.0], [0.0, 1.0]],
    )
    desk_right = DeskZone(
        desk_id="desk_right",
        label="Puesto Der",
        roi_polygon=[[0.6, 0.0], [1.0, 0.0], [1.0, 1.0], [0.6, 1.0]],
    )

    frame_w = 1000
    frame_h = 1000

    # Persona 1 en escritorio izq (x=200, y=500 -> norm: 0.2, 0.5)
    p1 = make_detection(200, 500, track_id=1)
    # Persona 2 en escritorio der (x=800, y=500 -> norm: 0.8, 0.5)
    p2 = make_detection(800, 500, track_id=2)
    # Persona 3 en el pasillo (x=500, y=500 -> norm: 0.5, 0.5)
    p3 = make_detection(500, 500, track_id=3)

    matches, passersby = match_people_to_desks(
        detections=[p1, p2, p3],
        desks=[desk_left, desk_right],
        frame_width=frame_w,
        frame_height=frame_h,
    )

    assert matches["desk_left"] is not None
    assert matches["desk_left"].track_id == 1
    assert matches["desk_right"] is not None
    assert matches["desk_right"].track_id == 2

    # Persona 3 debe ser clasificada como de paso (ignorada)
    assert len(passersby) == 1
    assert passersby[0].track_id == 3


def test_two_people_in_same_desk_zone_resolves_to_closest():
    # Un solo escritorio centrado en (0.25, 0.5)
    desk = DeskZone(
        desk_id="desk_01",
        label="Puesto",
        roi_polygon=[[0.1, 0.2], [0.4, 0.2], [0.4, 0.8], [0.1, 0.8]],
    )
    centroid = polygon_centroid(desk.roi_polygon)
    assert pytest.approx(centroid[0], abs=0.01) == 0.25
    assert pytest.approx(centroid[1], abs=0.01) == 0.5

    frame_w = 1000
    frame_h = 1000

    # Persona sentada exactamente en el centro (x=250, y=500 -> norm: 0.25, 0.5)
    p_main = make_detection(250, 500, track_id=10)
    # Alguien de visita apoyado en el borde (x=380, y=750 -> norm: 0.38, 0.75)
    p_visitor = make_detection(380, 750, track_id=11)

    matches, passersby = match_people_to_desks(
        detections=[p_main, p_visitor],
        desks=[desk],
        frame_width=frame_w,
        frame_height=frame_h,
    )

    # Debe seleccionar a la persona más cercana al centro
    assert matches["desk_01"] is not None
    assert matches["desk_01"].track_id == 10
    # La otra persona queda como de paso
    assert len(passersby) == 1
    assert passersby[0].track_id == 11


def test_non_participating_desk_is_excluded():
    desk = DeskZone(
        desk_id="desk_opt_out",
        label="No participante",
        roi_polygon=[[0.1, 0.1], [0.5, 0.1], [0.5, 0.8], [0.1, 0.8]],
        participating=False,
    )
    p = make_detection(300, 400, track_id=99)

    matches, passersby = match_people_to_desks(
        detections=[p],
        desks=[desk],
        frame_width=1000,
        frame_height=1000,
    )

    assert "desk_opt_out" not in matches
    assert len(passersby) == 1
