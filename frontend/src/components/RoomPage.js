import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './RoomPage.css';

const API_BASE = 'http://localhost:8000/api';

function RoomPage() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [roomInfo, setRoomInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [participants, setParticipants] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const videoRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Получаем данные из навигации
  useEffect(() => {
    if (location.state) {
      setRoomInfo(location.state);
    } else {
      // Если зашли напрямую по ссылке, загружаем данные комнаты
      loadRoomInfo();
    }
  }, [location.state, roomId]);

  // Инициализация медиа
  useEffect(() => {
    initializeMedia();
    
    return () => {
      // Очистка при размонтировании
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Прокрутка чата к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadRoomInfo = async () => {
    try {
      // Здесь можно добавить запрос для получения информации о комнате
      console.log('Loading room info for:', roomId);
    } catch (error) {
      console.error('Error loading room info:', error);
    }
  };

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setLocalStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Не удалось получить доступ к камере/микрофону');
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now(),
      text: newMessage,
      sender: roomInfo?.currentUser?.name || 'User',
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  const copyInviteLink = () => {
    if (roomInfo?.inviteLink) {
      navigator.clipboard.writeText(`${window.location.origin}/room/${roomInfo.inviteLink}`);
      alert('Ссылка скопирована в буфер!');
    }
  };

  const leaveRoom = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    navigate('/');
  };

  if (!roomInfo) {
    return <div className="loading">Загрузка комнаты...</div>;
  }

  return (
    <div className="room-page">
      {/* Header */}
      <header className="room-header">
        <div className="room-info">
          <h2>{roomInfo.roomName || `Комната ${roomId}`}</h2>
          <p>ID: {roomId} | {roomInfo.isHost ? 'Вы организатор' : 'Участник'}</p>
        </div>
        <div className="room-actions">
          <button onClick={copyInviteLink} className="invite-btn">
            📋 Пригласить
          </button>
          <button onClick={leaveRoom} className="leave-btn">
            🚪 Выйти
          </button>
        </div>
      </header>

      <div className="room-content">
        {/* Видео область */}
        <section className="video-section">
          <div className="video-container">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="local-video"
            />
            <div className="video-overlay">
              <p>Ваша камера {isVideoOff ? 'выключена' : 'включена'}</p>
            </div>
          </div>

          {/* Управление медиа */}
          <div className="media-controls">
            <button 
              onClick={toggleAudio} 
              className={`control-btn ${isAudioMuted ? 'muted' : ''}`}
            >
              {isAudioMuted ? '🔇' : '🎤'}
            </button>
            <button 
              onClick={toggleVideo} 
              className={`control-btn ${isVideoOff ? 'off' : ''}`}
            >
              {isVideoOff ? '📷 off' : '📷 on'}
            </button>
          </div>
        </section>

        {/* Чат */}
        <section className="chat-section">
          <div className="chat-header">
            <h3>Чат комнаты</h3>
          </div>
          
          <div className="messages-container">
            {messages.map(message => (
              <div key={message.id} className="message">
                <strong>{message.sender}:</strong> {message.text}
                <span className="timestamp">{message.timestamp}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="message-input">
            <input
              type="text"
              placeholder="Введите сообщение..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button onClick={sendMessage}>Отправить</button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default RoomPage;