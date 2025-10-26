import os
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
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
@app.websocket("/ws/webrtc/{room_id}/{user_id}")
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
                
                logger.info(f"📨 MESSAGE: {message_type} from {user_id} to {data.get('to_user_id', 'all')}")
                
                # Пересылаем сообщение всем в комнате кроме отправителя
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