import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import axios from 'axios';
import './HomePage.css';
import { API_BASE } from '../config';
import logoIcon from './logo-icon.svg';

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

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Ошибка при выходе:', error);
    }
  };

  return (
    <div className="home-page">
      <header className="home-header">
        <div className='home-logo-icon'>
            <h3>ТЕЛЕВИД</h3>
            <img src={logoIcon} alt="Logo Icon" />
        </div>
        <div className='home-buttons'>
          <div className="user-menu">
            <span className="user-greeting">Привет, {currentUser.name}!</span>
            <button onClick={handleLogout} className="logout-button">
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="home-content">
        <section className="welcome-section">
          <h2>Добро пожаловать в видеоконференции</h2>
          <p>Создайте новую комнату или присоединитесь к существующей</p>
        </section>
        
        <section className='boxes'>
          <section className="action-section">
            <h3>Создать новую комнату</h3>
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
                className="action-button create-btn"
              >
                {loading ? 'Создание...' : 'Создать комнату'}
              </button>
            </div>
          </section>

          <section className="action-section">
            <h3>Присоединиться к комнате</h3>
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
                className="action-button join-btn"
              >
                {loading ? 'Вход...' : 'Присоединиться'}
              </button>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

export default HomePage;