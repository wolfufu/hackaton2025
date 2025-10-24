# schemas.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    email: str
    name: str

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

class RoomBase(BaseModel):
    name: str
    created_by: int

class RoomCreate(RoomBase):
    pass

class Room(RoomBase):
    id: int
    invite_link: str
    created_at: datetime
    is_active: bool
    
    class Config:
        orm_mode = True