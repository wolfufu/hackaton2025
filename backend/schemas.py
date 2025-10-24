# schemas.py
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class User(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

class RoomBase(BaseModel):
    name: str

class RoomCreate(RoomBase):
    pass

class Room(RoomBase):
    id: int
    invite_link: str
    created_at: datetime
    is_active: bool
    
    class Config:
        orm_mode = True

class RoomResponse(RoomBase):
    id: int
    invite_link: str
    created_at: datetime
    is_active: bool
    created_by: int
    
    class Config:
        from_attributes = True