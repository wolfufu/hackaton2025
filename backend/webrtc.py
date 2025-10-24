# webrtc.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from websocket import manager

router = APIRouter()

@router.websocket("/ws/webrtc/{room_id}/{user_id}")
async def webrtc_websocket(websocket: WebSocket, room_id: str, user_id: str):
    await manager.connect(websocket, f"webrtc_{room_id}")
    
    # Уведомляем других участников о новом пользователе
    await manager.broadcast({
        "type": "user_joined",
        "user_id": user_id
    }, f"webrtc_{room_id}")
    
    try:
        while True:
            data = await websocket.receive_json()
            
            # Пересылаем сообщение всем участникам комнаты кроме отправителя
            await manager.broadcast({
                **data,
                "from_user_id": user_id
            }, f"webrtc_{room_id}")
            
    except WebSocketDisconnect:
        # Уведомляем о выходе пользователя
        await manager.broadcast({
            "type": "user_left", 
            "user_id": user_id
        }, f"webrtc_{room_id}")
        
        if f"webrtc_{room_id}" in manager.active_connections:
            manager.active_connections[f"webrtc_{room_id}"].remove(websocket)