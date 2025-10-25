# webrtc.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from websocket import manager
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.websocket("/ws/webrtc/{room_id}/{user_id}")
async def webrtc_websocket(websocket: WebSocket, room_id: str, user_id: str):
    room_key = f"webrtc_{room_id}"
    
    try:
        await manager.connect(websocket, room_key)
        logger.info(f"User {user_id} connected to room {room_id}")
        
        # Уведомляем других участников о новом пользователе
        await manager.broadcast({
            "type": "user_joined",
            "user_id": user_id
        }, room_key)
        
        # Основной цикл обработки сообщений
        while True:
            try:
                data = await websocket.receive_json()
                logger.debug(f"Received WebRTC message from {user_id}: {data.get('type')}")
                
                # Пересылаем сообщение всем участникам комнаты кроме отправителя
                await manager.broadcast({
                    **data,
                    "from_user_id": user_id
                }, room_key)
                
            except WebSocketDisconnect:
                logger.info(f"User {user_id} disconnected normally")
                break
            except Exception as e:
                logger.error(f"Error processing message from {user_id}: {e}")
                # Продолжаем работу при ошибках обработки сообщений
                continue
                
    except WebSocketDisconnect:
        logger.info(f"User {user_id} disconnected during connection")
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
    finally:
        # Всегда уведомляем о выходе пользователя
        try:
            await manager.broadcast({
                "type": "user_left", 
                "user_id": user_id
            }, room_key)
        except Exception as e:
            logger.error(f"Error broadcasting user_left: {e}")
        
        # Отключаем WebSocket
        try:
            await manager.disconnect(websocket, room_key)
        except Exception as e:
            logger.error(f"Error during disconnect: {e}")
        
        logger.info(f"User {user_id} fully disconnected from room {room_id}")