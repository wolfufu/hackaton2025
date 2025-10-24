import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:8000/api';

function App() {
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [joinStatus, setJoinStatus] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Создать пользователя при загрузке
  useEffect(() => {
    const createTestUser = async () => {
      try {
        const response = await axios.post(`${API_BASE}/users`, {
          email: `user_${Date.now()}@test.com`,
          name: 'Test User'
        });
        setCurrentUser(response.data);
        console.log('Пользователь создан:', response.data);
      } catch (error) {
        console.error('Error creating user:', error);
        // Если эндпоинта нет, создаем фиктивного пользователя
        setCurrentUser({ id: 1, name: 'Test User', email: 'test@test.com' });
      }
    };
    createTestUser();
  }, []);

  // Тест базового API
  const testApi = async () => {
    try {
      const response = await axios.get(`${API_BASE}/items`);
      console.log('API Response:', response.data);
      alert('API работает! Ответ: ' + JSON.stringify(response.data));
    } catch (error) {
      alert('API не отвечает');
    }
  };

  // Создание комнаты
  const createRoom = async () => {
    if (!currentUser) {
      alert('Пользователь не создан');
      return;
    }

    try {
      const response = await axios.post(`${API_BASE}/rooms`, {
        name: newRoomName,
        created_by: currentUser.id  // Используем реальный ID
      });
      
      setInviteLink(response.data.invite_link);
      setNewRoomName('');
      alert(`Комната создана! Ссылка: ${response.data.invite_link}`);
    } catch (error) {
      console.error('Ошибка создания комнаты:', error);
      
      // Если основная ручка не работает, пробуем тестовую
      try {
        const testResponse = await axios.post(`${API_BASE}/rooms/test`, {
          name: newRoomName
        });
        setInviteLink(testResponse.data.invite_link);
        setNewRoomName('');
        alert(`Комната создана (тест)! Ссылка: ${testResponse.data.invite_link}`);
      } catch (testError) {
        alert('Ошибка создания комнаты: ' + (testError.response?.data?.detail || testError.message));
      }
    }
  };

  // Вход в комнату
  const joinRoom = async () => {
    try {
      const response = await axios.get(`${API_BASE}/rooms/${inviteLink}`);
      setJoinStatus(`Успешно вошли в комнату: ${response.data.room_name}`);
    } catch (error) {
      setJoinStatus('Ошибка: комната не найдена');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Video Conference Test</h1>
        
        {/* Информация о пользователе */}
        {currentUser && (
          <section className="user-info">
            <h2>Текущий пользователь</h2>
            <p>ID: {currentUser.id}, Имя: {currentUser.name}</p>
          </section>
        )}

        {/* Тест базового API */}
        <section className="test-section">
          <h2>Тест API</h2>
          <button onClick={testApi}>Проверить соединение с бэкендом</button>
        </section>

        {/* Создание комнаты */}
        <section className="create-room">
          <h2>Создать комнату</h2>
          <input
            type="text"
            placeholder="Название комнаты"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
          />
          <button onClick={createRoom} disabled={!currentUser}>
            {currentUser ? 'Создать' : 'Загрузка...'}
          </button>
        </section>

        {/* Вход в комнату */}
        <section className="join-room">
          <h2>Войти в комнату</h2>
          <input
            type="text"
            placeholder="Ссылка-приглашение"
            value={inviteLink}
            onChange={(e) => setInviteLink(e.target.value)}
          />
          <button onClick={joinRoom}>Войти</button>
          {joinStatus && <p>{joinStatus}</p>}
        </section>

        {/* Список комнат */}
        <section className="rooms-list">
          <h2>Комнаты</h2>
          {rooms.length === 0 ? (
            <p>Нет созданных комнат</p>
          ) : (
            <ul>
              {rooms.map(room => (
                <li key={room.id}>{room.name} - {room.invite_link}</li>
              ))}
            </ul>
          )}
        </section>
      </header>
    </div>
  );
}

export default App;