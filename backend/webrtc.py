# webrtc.py
from fastapi import APIRouter
from websocket import manager

router = APIRouter()

@router.post("/webrtc/offer")
async def handle_offer(offer: dict, room_id: str):
    # Обработка WebRTC оффера
    await manager.broadcast({
        "type": "webrtc_offer",
        "offer": offer,
        "room_id": room_id
    }, room_id)

@router.post("/webrtc/answer")
async def handle_answer(answer: dict, room_id: str):
    # Обработка WebRTC ответа
    await manager.broadcast({
        "type": "webrtc_answer", 
        "answer": answer,
        "room_id": room_id
    }, room_id)