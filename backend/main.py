import os
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from typing import List 
from sqlalchemy.orm import Session
from websocket import manager
from database import SessionLocal, engine, get_db
from models import Base, Room, User
import schemas
import auth
import secrets
import string
from datetime import timedelta
import logging
from typing import List, Optional
from fastapi import WebSocket, WebSocketDisconnect
import os
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from sqlalchemy.orm import Session
from websocket import manager
from database import SessionLocal, engine, get_db
from models import Base, Room, User, Message
import schemas
import auth
import secrets
import string
from datetime import timedelta
import os
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from sqlalchemy.orm import Session
from websocket import manager
from database import SessionLocal, engine, get_db
# Import models module directly instead of individual classes
import models
import schemas
import auth
import secrets
import string
from datetime import timedelta
import logging
from typing import List, Optional
# Настройка логгера
logger = logging.getLogger(__name__)

# Создаем таблицы в БД
Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS настройки
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Регистрация пользователя
@app.post("/api/auth/register", response_model=schemas.Token)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    """Регистрация нового пользователя"""
    db_user = db.query(User).filter(User.email == user_data.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_user = User(email=user_data.email, name=user_data.name)
    db_user.set_password(user_data.password)
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    access_token = auth.create_access_token(
        data={"sub": str(db_user.id)}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": db_user
    }

# Авторизация пользователя
@app.post("/api/auth/login", response_model=schemas.Token)
def login(user_data: schemas.UserLogin, db: Session = Depends(get_db)):
    """Авторизация пользователя"""
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not user.check_password(user_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth.create_access_token(
        data={"sub": str(user.id)}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

# Получение текущего пользователя
@app.get("/api/auth/me", response_model=schemas.UserResponse)
def get_current_user(current_user: User = Depends(auth.get_current_user)):
    """Получение информации о текущем пользователе"""
    return current_user

@app.get("/")
def read_root():
    return {"message": "Hello from FastAPI!"}

@app.get("/api/items")
def get_items():
    return {"items": ["item1", "item2", "item3"]}

@app.post("/api/items")
def create_item(item: dict):
    return {"status": "created", "item": item}

# WebSocket endpoints
@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await manager.connect(websocket, room_id)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(data, room_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)

def generate_invite_link(length=10):
    """Генерация уникальной ссылки для комнаты"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

# Создание комнаты
@app.post("/api/rooms", response_model=schemas.RoomResponse)
def create_room(
    room_data: schemas.RoomCreate,
    current_user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Создание комнаты с уникальной ссылкой"""
    invite_link = generate_invite_link()
    
    while db.query(Room).filter(Room.invite_link == invite_link).first():
        invite_link = generate_invite_link()
    
    db_room = Room(
        name=room_data.name,
        invite_link=invite_link,
        created_by=current_user.id
    )
    
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    
    return db_room

# WebRTC WebSocket endpoint
# WebRTC WebSocket endpoint
# WebRTC WebSocket endpoint
# WebRTC WebSocket endpoint
# В main.py добавьте этот endpoint для чата и синхронизации
from fastapi import WebSocket, WebSocketDisconnect

# WebRTC WebSocket endpoint
# main.py - ОБНОВИТЬ WebSocket endpoint
# main.py - ОБНОВИТЬ WebSocket endpoint
@app.websocket("/ws/webrtc/{room_id}/{user_id}")
async def webrtc_websocket(websocket: WebSocket, room_id: str, user_id: str):
    room_key = f"webrtc_{room_id}"
    
    logger.info(f"🎯 NEW WEBSOCKET: User {user_id} connecting to room {room_id}")
    
    try:
        await manager.connect(websocket, room_key, user_id)
        logger.info(f"✅ CONNECTED: User {user_id} in room {room_id}")
        
        while True:
            try:
                data = await websocket.receive_json()
                message_type = data.get('type', 'unknown')
                
                logger.info(f"📨 MESSAGE: {message_type} from {user_id}")
                
                if message_type == 'chat_message':
                    # Обрабатываем сообщение чата
                    message_text = data.get('message', '')
                    if message_text.strip():
                        await handle_chat_message(room_id, user_id, message_text, room_key)
                else:
                    # WebRTC сообщения (существующая логика)
                    await manager.broadcast({
                        **data,
                        "from_user_id": user_id
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
        logger.info(f"🧹 CLEANUP: User {user_id} from room {room_id}")
        await manager.disconnect(websocket, room_key, user_id)

async def handle_chat_message(room_id: str, user_id: str, message: str, room_key: str):
    """Обработка сообщения чата"""
    try:
        # Создаем сессию БД
        db = SessionLocal()
        
        # Получаем пользователя
        user = db.query(models.User).filter(models.User.id == int(user_id)).first()
        if not user:
            logger.error(f"User {user_id} not found")
            return
        
        # Сохраняем сообщение в БД
        db_message = models.Message(
            room_id=int(room_id),
            user_id=int(user_id),
            content=message
        )
        
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        
        # Формируем ответ
        chat_message = {
            "type": "chat_message",
            "id": db_message.id,
            "user_id": user_id,
            "user_name": user.name,
            "message": message,
            "content": message,  # для совместимости
            "timestamp": db_message.created_at.isoformat(),
            "created_at": db_message.created_at.isoformat()
        }
        
        # Рассылаем всем в комнате
        await manager.broadcast(chat_message, room_key)
        
        logger.info(f"💬 CHAT: User {user_id} sent message in room {room_id}")
        
    except Exception as e:
        logger.error(f"❌ CHAT ERROR: {e}")
    finally:
        db.close()
 # Дополнительный WebSocket для синхронизации участников (для версии с чатом)
@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await manager.connect(websocket, room_id, "sync_user")
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(data, room_id)
    except WebSocketDisconnect:
        await manager.disconnect(websocket, room_id, "sync_user")
@app.get("/api/rooms/{invite_link}")
def join_room(invite_link: str, db: Session = Depends(get_db)):
    """Вход в комнату по ссылке"""
    room = db.query(Room).filter(Room.invite_link == invite_link).first()
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if not room.is_active:
        raise HTTPException(status_code=400, detail="Room is not active")
    
    return {
        "room_id": room.id,
        "room_name": room.name,
        "status": "success"
    }

# Создание пользователя
@app.post("/api/users", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_user = User(email=user.email, name=user.name)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# Получение пользователя по ID
@app.get("/api/users/{user_id}", response_model=schemas.User)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# Создаем тестового пользователя при старте
@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        test_user = db.query(User).filter(User.email == "test@example.com").first()
        if not test_user:
            test_user = User(email="test@example.com", name="Test User")
            test_user.set_password("test123")
            db.add(test_user)
            db.commit()
            print("Создан тестовый пользователь с ID:", test_user.id)
    finally:
        db.close()

# Тестовый эндпоинт для создания комнаты
@app.post("/api/rooms/test")
def create_room_test(room_data: dict, db: Session = Depends(get_db)):
    try:
        test_user = db.query(User).first()
        if not test_user:
            test_user = User(email="test@example.com", name="Test User")
            test_user.set_password("test123")
            db.add(test_user)
            db.commit()
            db.refresh(test_user)
        
        invite_link = generate_invite_link()
        while db.query(Room).filter(Room.invite_link == invite_link).first():
            invite_link = generate_invite_link()
        
        db_room = Room(
            name=room_data.get('name', 'Test Room'),
            invite_link=invite_link,
            created_by=test_user.id
        )
        
        db.add(db_room)
        db.commit()
        db.refresh(db_room)
        
        return {"room_id": db_room.id, "invite_link": invite_link}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/rooms/{room_id}/messages", response_model=List[schemas.MessageResponse])
def get_room_messages(room_id: int, db: Session = Depends(get_db)):
    """Получить историю сообщений комнаты"""
    messages = db.query(models.Message).filter(
        models.Message.room_id == room_id
    ).order_by(models.Message.created_at.asc()).all()
    
    # Добавляем имена пользователей к сообщениям
    result = []
    for message in messages:
        user = db.query(models.User).filter(models.User.id == message.user_id).first()
        result.append({
            "id": message.id,
            "user_id": message.user_id,
            "user_name": user.name if user else "Unknown",
            "content": message.content,
            "created_at": message.created_at
        })
    
    return result

@app.post("/api/rooms/{room_id}/messages", response_model=schemas.MessageResponse)
def create_message(
    room_id: int,
    message_data: schemas.MessageCreate,
    current_user: User = Depends(auth.get_current_user), 
    db: Session = Depends(get_db)
):
    """Создать новое сообщение в чате"""
    # Проверяем что комната существует
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    db_message = models.Message(
        room_id=room_id,
        user_id=current_user.id,
        content=message_data.content
    )
    
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    
    # Возвращаем сообщение с именем пользователя
    return {
        "id": db_message.id,
        "user_id": db_message.user_id,
        "user_name": current_user.name,
        "content": db_message.content,
        "created_at": db_message.created_at
    }
# WebSocket endpoint для WebRTC и чата
@app.websocket("/ws/webrtc/{room_id}/{user_id}")
async def webrtc_websocket(websocket: WebSocket, room_id: str, user_id: str):
    room_key = f"webrtc_{room_id}"
    
    logger.info(f"🎯 NEW WEBSOCKET: User {user_id} connecting to room {room_id}")
    
    try:
        await manager.connect(websocket, room_key, user_id)
        logger.info(f"✅ CONNECTED: User {user_id} in room {room_id}")
        
        while True:
            try:
                data = await websocket.receive_json()
                message_type = data.get('type', 'unknown')
                
                logger.info(f"📨 MESSAGE: {message_type} from {user_id}")
                
                if message_type == 'chat_message':
                    # Обрабатываем сообщение чата
                    message_text = data.get('message', '')
                    if message_text.strip():
                        await handle_chat_message(room_id, user_id, message_text, room_key)
                else:
                    # WebRTC сообщения (существующая логика)
                    await manager.broadcast({
                        **data,
                        "from_user_id": user_id
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
        logger.info(f"🧹 CLEANUP: User {user_id} from room {room_id}")
        await manager.disconnect(websocket, room_key, user_id)

async def handle_chat_message(room_id: str, user_id: str, message: str, room_key: str):
    """Обработка сообщения чата"""
    try:
        # Создаем сессию БД
        db = SessionLocal()
        
        # Получаем пользователя
        user = db.query(models.User).filter(models.User.id == int(user_id)).first()
        if not user:
            logger.error(f"User {user_id} not found")
            return
        
        # Сохраняем сообщение в БД
        db_message = models.Message(
            room_id=int(room_id),
            user_id=int(user_id),
            content=message
        )
        
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        
        # Формируем ответ
        chat_message = {
            "type": "chat_message",
            "id": db_message.id,
            "user_id": user_id,
            "user_name": user.name,
            "message": message,
            "content": message,  # для совместимости
            "timestamp": db_message.created_at.isoformat(),
            "created_at": db_message.created_at.isoformat()
        }
        
        # Рассылаем всем в комнате
        await manager.broadcast(chat_message, room_key)
        
        logger.info(f"💬 CHAT: User {user_id} sent message in room {room_id}")
        
    except Exception as e:
        logger.error(f"❌ CHAT ERROR: {e}")
    finally:
        db.close()