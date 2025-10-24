import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import axios from 'axios';
import './HomePage.css';

const API_BASE = 'http://localhost:8000/api';

function HomePage() {
  const [newRoomName, setNewRoomName] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const createRoom = async () => {
    if (!newRoomName.trim()) {
      alert('Введите название комнаты');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/rooms`, {
        name: newRoomName
      });
      
      navigate(`/room/${response.data.id}`, { 
        state: { 
          roomId: response.data.id,
          inviteLink: response.data.invite_link,
          roomName: response.data.name,
          isHost: true
        }
      });
      
    } catch (error) {
      console.error('Ошибка создания комнаты:', error);
      alert('Ошибка создания комнаты: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!inviteLink.trim()) {
      alert('Введите ссылку-приглашение');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/rooms/${inviteLink}`);
      
      navigate(`/room/${response.data.room_id}`, {
        state: {
          roomId: response.data.room_id,
          inviteLink: inviteLink,
          roomName: response.data.room_name,
          isHost: false
        }
      });
      
    } catch (error) {
      alert('Комната не найдена или неактивна');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="header-content">
          <h1>🎥 Video Conference</h1>
          <div className="user-menu">
            <span>Привет, {currentUser.name}!</span>
            <button onClick={logout} className="logout-btn">Выйти</button>
          </div>
        </div>
        <p>Создайте или присоединитесь к видеовстрече</p>
      </header>

      <div className="home-content">
        {/* Остальной код без изменений */}
        <section className="create-section">
          <h2>Создать новую комнату</h2>
          <div className="input-group">
            <input
              type="text"
              placeholder="Название комнаты"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              disabled={loading}
            />
            <button 
              onClick={createRoom} 
              disabled={loading || !newRoomName.trim()}
              className="create-btn"
            >
              {loading ? 'Создание...' : 'Создать комнату'}
            </button>
          </div>
        </section>

        <div className="divider">
          <span>или</span>
        </div>

        <section className="join-section">
          <h2>Присоединиться к комнате</h2>
          <div className="input-group">
            <input
              type="text"
              placeholder="Ссылка-приглашение"
              value={inviteLink}
              onChange={(e) => setInviteLink(e.target.value)}
              disabled={loading}
            />
            <button 
              onClick={joinRoom} 
              disabled={loading || !inviteLink.trim()}
              className="join-btn"
            >
              {loading ? 'Вход...' : 'Присоединиться'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default HomePage;