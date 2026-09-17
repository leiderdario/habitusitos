"""Test live websocket broadcasting of multi-person poses."""

import asyncio
import json
import socket
import pytest
from vision_node.websocket_server import VisionWebSocketServer
from vision_node.mapper import coco_to_blazepose_landmarks
from vision_node.geometry import Keypoint


def _get_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_websocket_server_broadcast():
    port = _get_free_port()
    async def _test():
        server = VisionWebSocketServer(host="127.0.0.1", port=port)
        server.start()
        try:
            import websockets
            async with websockets.connect(f"ws://127.0.0.1:{port}") as ws:
                # Wait for client registration
                await asyncio.sleep(0.1)

                # Create synthetic COCO keypoints for 2 people
                person1_coco = [Keypoint(100.0, 200.0, 0.9) for _ in range(17)]
                person2_coco = [Keypoint(300.0, 400.0, 0.85) for _ in range(17)]

                p1_bp = coco_to_blazepose_landmarks(person1_coco, frame_width=640, frame_height=480)
                p2_bp = coco_to_blazepose_landmarks(person2_coco, frame_width=640, frame_height=480)

                personas_payload = [
                    {"track_id": 1, "keypoints": p1_bp},
                    {"track_id": 2, "keypoints": p2_bp},
                ]

                server.broadcast_personas("cam_01", personas_payload)

                msg_raw = await asyncio.wait_for(ws.recv(), timeout=2.0)
                msg = json.loads(msg_raw)

                assert msg["tipo"] == "personas_detectadas"
                assert msg["camera_id"] == "cam_01"
                assert len(msg["personas"]) == 2
                assert msg["personas"][0]["track_id"] == 1
                assert len(msg["personas"][0]["keypoints"]) == 33
                assert msg["personas"][1]["track_id"] == 2
                assert len(msg["personas"][1]["keypoints"]) == 33

        finally:
            server.stop()

    asyncio.run(_test())
