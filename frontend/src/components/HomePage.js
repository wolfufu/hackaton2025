import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './HomePage.css';

const API_BASE = 'http://localhost:8000/api';

function HomePage() {
  const [newRoomName, setNewRoomName] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Создать пользователя при загрузке
  useEffect(() => {
    const createTestUser = async () => {
      try {
        const response = await axios.post(`${API_BASE}/users`, {
          email: `user_${Date.now()}@test.com`,
          name: `User${Date.now().toString().slice(-4)}`
        });
        setCurrentUser(response.data);
      } catch (error) {
        console.error('Error creating user:', error);
        // Создаем фиктивного пользователя для тестов
        setCurrentUser({ id: 1, name: 'Test User', email: 'test@test.com' });
      }
    };
    createTestUser();
  }, []);

  // Создание комнаты и переход в нее
  const createRoom = async () => {
    if (!currentUser || !newRoomName.trim()) {
      alert('Введите название комнаты');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/rooms`, {
        name: newRoomName,
        created_by: currentUser.id
      });
      
      const roomId = response.data.room_id;
      setInviteLink(response.data.invite_link);
      
      // Переходим в комнату
      navigate(`/room/${roomId}`, { 
        state: { 
          roomId: roomId,
          inviteLink: response.data.invite_link,
          roomName: newRoomName,
          isHost: true,
          currentUser: currentUser
        }
      });
      
    } catch (error) {
      console.error('Ошибка создания комнаты:', error);
      
      // Пробуем тестовый эндпоинт
      try {
        const testResponse = await axios.post(`${API_BASE}/rooms/test`, {
          name: newRoomName
        });
        
        navigate(`/room/${testResponse.data.room_id}`, {
          state: {
            roomId: testResponse.data.room_id,
            inviteLink: testResponse.data.invite_link,
            roomName: newRoomName,
            isHost: true,
            currentUser: currentUser
          }
        });
        
      } catch (testError) {
        alert('Ошибка создания комнаты: ' + (testError.response?.data?.detail || testError.message));
      }
    } finally {
      setLoading(false);
    }
  };

  // Вход в существующую комнату
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
          isHost: false,
          currentUser: currentUser
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
        <h1>🎥 Video Conference</h1>
        <p>Создайте или присоединитесь к видеовстрече</p>
      </header>

      <div className="home-content">
        {/* Создание комнаты */}
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
              disabled={!currentUser || loading || !newRoomName.trim()}
              className="create-btn"
            >
              {loading ? 'Создание...' : 'Создать комнату'}
            </button>
          </div>
        </section>

        <div className="divider">
          <span>или</span>
        </div>

        {/* Вход в комнату */}
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

        {/* Информация о пользователе */}
        {currentUser && (
          <div className="user-info">
            <p>Вы вошли как: <strong>{currentUser.name}</strong></p>
          </div>
        )}
      </div>
    </div>
  );
}

export default HomePage;