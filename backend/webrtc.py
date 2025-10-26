# webrtc.py - ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ ФАЙЛ
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from websocket import manager
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.websocket("/ws/webrtc/{room_id}/{user_id}")
async def webrtc_websocket(websocket: WebSocket, room_id: str, user_id: str):
    room_key = f"webrtc_{room_id}"
    
    logger.info(f"🎯 NEW WEBSOCKET: User {user_id} connecting to room {room_id}")
    
    try:
        # Подключаем пользователя
        await manager.connect(websocket, room_key, user_id)
        logger.info(f"✅ CONNECTED: User {user_id} in room {room_id}")
        
        # Основной цикл обработки сообщений
        while True:
            try:
                # Ждем сообщение от клиента
                data = await websocket.receive_json()
                message_type = data.get('type', 'unknown')
                
                logger.info(f"📨 MESSAGE: {type} from {user_id}")
                
                # ✅ ПРОСТО ПЕРЕСЫЛАЕМ ВСЕ СООБЩЕНИЯ ВСЕМ УЧАСТНИКАМ
                await manager.broadcast({
                    **data,
                    "from_user_id": user_id  # Добавляем ID отправителя
                }, room_key, exclude_websocket=websocket)
                
            except WebSocketDisconnect:
                logger.info(f"🔌 NORMAL DISCONNECT: User {user_id} from room {room_id}")
                break
            except Exception as e:
                logger.error(f"❌ MESSAGE ERROR: User {user_id}: {e}")
                continue
                
    except WebSocketDisconnect:
        logger.info(f"🔌 DISCONNECT DURING CONNECT: User {user_id}")
    except Exception as e:
        logger.error(f"❌ WEBSOCKET ERROR: User {user_id}: {e}")
    finally:
        # Всегда очищаем соединение
        logger.info(f"🧹 CLEANUP: User {user_id} from room {room_id}")
        await manager.disconnect(websocket, room_key, user_id)