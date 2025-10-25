import os
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from websocket import manager
from database import SessionLocal, engine, get_db
from models import Base, Room, User
import schemas
import auth
import secrets
import string
from datetime import timedelta
from webrtc import router as webrtc_router

from database import Base, engine


# Создаем таблицы в БД
Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS настройки для продакшена
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000", 
    "http://83.234.174.96:3000",  # ваш React фронтенд
    "http://83.234.174.96:8000",
]

app.include_router(webrtc_router, prefix="/api")

# Настройка CORS для React
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Регистрация пользователя
@app.post("/api/auth/register", response_model=schemas.Token)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    """Регистрация нового пользователя"""
    # Проверяем, нет ли пользователя с таким email
    db_user = db.query(User).filter(User.email == user_data.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Создаем пользователя
    db_user = User(email=user_data.email, name=user_data.name)
    db_user.set_password(user_data.password)
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Создаем токен
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
    
    # Создаем токен
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

# Обновляем создание комнаты с авторизацией


@app.get("/")
def read_root():
    return {"message": "Hello from FastAPI!"}

@app.get("/api/items")
def get_items():
    return {"items": ["item1", "item2", "item3"]}

@app.post("/api/items")
def create_item(item: dict):
    return {"status": "created", "item": item}

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await manager.connect(websocket, room_id)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(data, room_id)
    except WebSocketDisconnect:
        manager.active_connections[room_id].remove(websocket)

def generate_invite_link(length=10):
    """Генерация уникальной ссылки для комнаты"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


@app.post("/api/rooms", response_model=schemas.RoomResponse)
def create_room(
    room_data: schemas.RoomCreate,
    current_user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Создание комнаты с уникальной ссылкой"""
    # Генерируем уникальную ссылку
    invite_link = generate_invite_link()
    
    # Проверяем, что ссылка уникальна
    while db.query(Room).filter(Room.invite_link == invite_link).first():
        invite_link = generate_invite_link()
    
    # Создаем комнату
    db_room = Room(
        name=room_data.name,
        invite_link=invite_link,
        created_by=current_user.id
    )
    
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    
    return db_room

@app.websocket("/ws/test/{room_id}")
async def simple_websocket(websocket: WebSocket, room_id: str):
    await manager.connect(websocket, f"test_{room_id}")
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast({"message": data}, f"test_{room_id}")
    except WebSocketDisconnect:
        await manager.disconnect(websocket, f"test_{room_id}")

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

@app.post("/api/users", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Создание пользователя"""
    # Проверяем, нет ли пользователя с таким email
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_user = User(email=user.email, name=user.name)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.get("/api/users/{user_id}", response_model=schemas.User)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Получение пользователя по ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# Создаем тестового пользователя при старте
@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        # Проверяем, есть ли тестовый пользователь
        test_user = db.query(User).filter(User.email == "test@example.com").first()
        if not test_user:
            test_user = User(email="test@example.com", name="Test User")
            db.add(test_user)
            db.commit()
            print("Создан тестовый пользователь с ID:", test_user.id)
    finally:
        db.close()

# Тестовый эндпоинт для создания комнаты
@app.post("/api/rooms/test")
def create_room_test(room_data: dict, db: Session = Depends(get_db)):
    """Создание комнаты для тестирования"""
    try:
        # Сначала создаем тестового пользователя если нет
        test_user = db.query(User).first()
        if not test_user:
            test_user = User(email="test@example.com", name="Test User")
            db.add(test_user)
            db.commit()
            db.refresh(test_user)
        
        # Генерируем уникальную ссылку
        invite_link = generate_invite_link()
        while db.query(Room).filter(Room.invite_link == invite_link).first():
            invite_link = generate_invite_link()
        
        # Создаем комнату
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