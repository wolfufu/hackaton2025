from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from websocket import manager
from database import SessionLocal, engine, get_db
from models import Base, Room, User
import schemas
import secrets
import string

app = FastAPI()

# Настройка CORS для React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.post("/api/rooms")
def create_room(room_data: schemas.RoomCreate, db: Session = Depends(get_db)):
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
        created_by=room_data.created_by
    )
    
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    
    return {"room_id": db_room.id, "invite_link": invite_link}

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