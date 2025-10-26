# websocket.py
from fastapi import WebSocket
from typing import Dict, List
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.room_users: Dict[str, List[str]] = {}
        self.websocket_to_user: Dict[WebSocket, str] = {}
        self.websocket_to_room: Dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, room_id: str, user_id: str):
        await websocket.accept()
        
        # Очищаем старые соединения этого пользователя
        await self._cleanup_user_connections(user_id, room_id)
        
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
            self.room_users[room_id] = []
        
        self.active_connections[room_id].append(websocket)
        self.websocket_to_user[websocket] = user_id
        self.websocket_to_room[websocket] = room_id
        
        if user_id not in self.room_users[room_id]:
            self.room_users[room_id].append(user_id)
        
        logger.info(f"✅ USER {user_id} JOINED ROOM {room_id}")
        logger.info(f"📊 Room {room_id} now has {len(self.room_users[room_id])} users: {self.room_users[room_id]}")
        
        # Отправляем новому пользователю список существующих участников
        existing_users = [uid for uid in self.room_users[room_id] if uid != user_id]
        if existing_users:
            logger.info(f"📋 Sending existing users {existing_users} to new user {user_id}")
            await self._send_to_websocket(websocket, {
                "type": "existing_users",
                "users": existing_users
            })
        
        # Уведомляем всех о новом пользователе
        await self.broadcast({
            "type": "user_joined",
            "user_id": user_id
        }, room_id, exclude_websocket=websocket)

    async def _cleanup_user_connections(self, user_id: str, room_id: str):
        """Удаляем старые соединения пользователя"""
        if room_id not in self.active_connections:
            return
            
        to_remove = []
        for ws in self.active_connections[room_id]:
            if self.websocket_to_user.get(ws) == user_id:
                to_remove.append(ws)
        
        for ws in to_remove:
            await self._safe_disconnect(ws, "replaced by new connection")

    async def _safe_disconnect(self, websocket: WebSocket, reason: str = "unknown"):
        """Безопасное отключение WebSocket"""
        room_id = self.websocket_to_room.get(websocket)
        user_id = self.websocket_to_user.get(websocket)
        
        if room_id and room_id in self.active_connections:
            if websocket in self.active_connections[room_id]:
                self.active_connections[room_id].remove(websocket)
        
        # Очищаем маппинги
        if websocket in self.websocket_to_user:
            del self.websocket_to_user[websocket]
        if websocket in self.websocket_to_room:
            del self.websocket_to_room[websocket]
            
        logger.info(f"🔌 Disconnected user {user_id} from room {room_id}: {reason}")

    async def _send_to_websocket(self, websocket: WebSocket, message: dict):
        """Безопасная отправка сообщения"""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.warning(f"Failed to send message to websocket: {e}")
            await self._safe_disconnect(websocket, "send error")

    async def broadcast(self, message: dict, room_id: str, exclude_websocket: WebSocket = None):
        """Отправка сообщения всем в комнате"""
        if room_id not in self.active_connections:
            return
            
        connections = self.active_connections[room_id]
        if not connections:
            return
            
        logger.info(f"📢 Broadcasting {message.get('type')} to {len(connections)} users in {room_id}")
        
        for websocket in connections[:]:
            if websocket == exclude_websocket:
                continue
                
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to broadcast to user {self.websocket_to_user.get(websocket)}: {e}")
                await self._safe_disconnect(websocket, "broadcast error")

    async def disconnect(self, websocket: WebSocket, room_id: str, user_id: str):
        """Публичный метод для отключения"""
        user_id = user_id or self.websocket_to_user.get(websocket)
        
        await self._safe_disconnect(websocket, "manual disconnect")
        
        # Удаляем пользователя из комнаты
        if room_id in self.room_users and user_id in self.room_users[room_id]:
            self.room_users[room_id].remove(user_id)
            logger.info(f"👋 User {user_id} removed from room {room_id}")
            
        # Уведомляем остальных о выходе пользователя
        if room_id in self.active_connections and self.active_connections[room_id]:
            await self.broadcast({
                "type": "user_left",
                "user_id": user_id
            }, room_id)
            
        # Очищаем пустые комнаты
        if room_id in self.active_connections and not self.active_connections[room_id]:
            del self.active_connections[room_id]
            if room_id in self.room_users:
                del self.room_users[room_id]
            logger.info(f"🏁 Room {room_id} cleaned up")

manager = ConnectionManager()