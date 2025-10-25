import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import axios from 'axios';
import './HomePage.css';
import { API_BASE } from '../config';

function HomePage() {
  const [newRoomName, setNewRoomName] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  // Автоматическое присоединение по ссылке
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('join');
    
    if (joinCode) {
      setInviteLink(joinCode);
      setTimeout(() => {
        joinRoomAuto(joinCode);
      }, 500);
    }
  }, []);

  const joinRoomAuto = async (code) => {
    setLoading(true);
    try {
      let cleanCode = code;
      if (code.includes('join=')) {
        cleanCode = code.split('join=')[1];
      }
      cleanCode = cleanCode.split('&')[0];
      cleanCode = cleanCode.trim();
      
      console.log('Auto-joining room with code:', cleanCode);
      const response = await axios.get(`${API_BASE}/rooms/${cleanCode}`);
      
      navigate(`/room/${response.data.room_id}`, {
        state: {
          roomId: response.data.room_id,
          inviteLink: cleanCode,
          roomName: response.data.room_name,
          isHost: false
        }
      });
      
    } catch (error) {
      console.error('Auto-join room error:', error);
      alert('Комната не найдена или неактивна');
      window.history.replaceState({}, document.title, window.location.pathname);
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async () => {
    if (!newRoomName.trim()) {
      alert('Введите название комнаты');
      return;
    }

    setLoading(true);
    try {
      console.log('Creating room at:', `${API_BASE}/rooms`);
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
      let cleanCode = inviteLink;
      if (inviteLink.includes('join=')) {
        cleanCode = inviteLink.split('join=')[1];
      }
      cleanCode = cleanCode.split('&')[0];
      cleanCode = cleanCode.trim();
      
      console.log('Joining room with code:', cleanCode);
      const response = await axios.get(`${API_BASE}/rooms/${cleanCode}`);
      
      navigate(`/room/${response.data.room_id}`, {
        state: {
          roomId: response.data.room_id,
          inviteLink: cleanCode,
          roomName: response.data.room_name,
          isHost: false
        }
      });
      
    } catch (error) {
      console.error('Join room error:', error);
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