import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import WebRTCManager from './WebRTCManager';
import './RoomPage.css';

function RoomPage() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [roomInfo, setRoomInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [participants, setParticipants] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef({});
  const webrtcManagerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Инициализация комнаты
  useEffect(() => {
    if (location.state) {
      setRoomInfo(location.state);
      initializeWebRTC();
    } else {
      navigate('/');
    }

    return () => {
      // Очистка при размонтировании
      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.destroy();
      }
    };
  }, [location.state]);

  // Прокрутка чата
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Инициализация WebRTC
  const initializeWebRTC = async () => {
    if (!currentUser) return;

    try {
        webrtcManagerRef.current = new WebRTCManager(
            roomId,
            currentUser.id.toString(),
            handleRemoteStream,
            handleUserLeft
        );

        const localStream = await webrtcManagerRef.current.initialize();
        
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }

        // Добавляем только локального пользователя
        setParticipants(prev => {
            // Убедимся, что нет дубликатов
            const withoutMe = prev.filter(p => !p.isLocal);
            return [...withoutMe, {
                id: currentUser.id,
                name: currentUser.name,
                isLocal: true,
                stream: localStream
            }];
        });

    } catch (error) {
        console.error('Failed to initialize WebRTC:', error);
        alert('Не удалось получить доступ к камере и микрофону');
    }
};

  // Обработка удаленного видеопотока
  const handleRemoteStream = (userId, stream) => {
    // Игнорируем свои собственные потоки
    if (parseInt(userId) === currentUser.id) return;
    
    setParticipants(prev => {
        const existing = prev.find(p => p.id === parseInt(userId));
        if (existing) {
            return prev.map(p => 
                p.id === parseInt(userId) ? { ...p, stream } : p
            );
        } else {
            return [...prev, {
                id: parseInt(userId),
                name: `User ${userId}`,
                isLocal: false,
                stream
            }];
        }
    });
};

  // Обработка выхода пользователя
  const handleUserLeft = (userId) => {
    // Игнорируем свои собственные уведомления о выходе
    if (parseInt(userId) === currentUser.id) return;
    
    setParticipants(prev => prev.filter(p => p.id !== parseInt(userId)));
    
    if (remoteVideosRef.current[userId]) {
        delete remoteVideosRef.current[userId];
    }
};

  const toggleAudio = () => {
    if (webrtcManagerRef.current) {
      const isEnabled = webrtcManagerRef.current.toggleAudio();
      setIsAudioMuted(!isEnabled);
    }
  };

  const toggleVideo = () => {
    if (webrtcManagerRef.current) {
      const isEnabled = webrtcManagerRef.current.toggleVideo();
      setIsVideoOff(!isEnabled);
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now(),
      text: newMessage,
      sender: currentUser.name,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  const copyInviteLink = () => {
    if (roomInfo?.inviteLink) {
      navigator.clipboard.writeText(`${window.location.origin}/?join=${roomInfo.inviteLink}`);
      alert('Ссылка скопирована в буфер!');
    }
  };

  const leaveRoom = () => {
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.destroy();
    }
    navigate('/');
  };

  if (!roomInfo) {
    return <div className="loading">Загрузка комнаты...</div>;
  }

  const localParticipant = participants.find(p => p.isLocal);
  const remoteParticipants = participants.filter(p => !p.isLocal);

  return (
    <div className="room-page">
      {/* Header */}
      <header className="room-header">
        <div className="room-info">
          <h2>{roomInfo.roomName || `Комната ${roomId}`}</h2>
          <p>Участников: {participants.length} | {roomInfo.isHost ? 'Вы организатор' : 'Участник'}</p>
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
        {/* Видео контейнер */}
        <section className="video-section">
          <div className="video-grid">
            {/* Локальное видео */}
            {localParticipant && (
              <div className="video-container local">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="video-element"
                />
                <div className="video-overlay">
                  <span className="user-name">Вы ({currentUser.name})</span>
                  {isVideoOff && <span className="status">Камера выключена</span>}
                  {isAudioMuted && <span className="status">Микрофон выключен</span>}
                </div>
              </div>
            )}

            {/* Удаленные видео */}
            {remoteParticipants.map(participant => (
              <div key={participant.id} className="video-container remote">
                <video
                  ref={el => remoteVideosRef.current[participant.id] = el}
                  autoPlay
                  playsInline
                  className="video-element"
                  onLoadedMetadata={() => {
                    if (remoteVideosRef.current[participant.id] && participant.stream) {
                      remoteVideosRef.current[participant.id].srcObject = participant.stream;
                    }
                  }}
                />
                <div className="video-overlay">
                  <span className="user-name">{participant.name}</span>
                </div>
              </div>
            ))}
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

        {/* Чат и участники */}
        <section className="sidebar">
          {/* Список участников */}
          <div className="participants-section">
            <h3>Участники ({participants.length})</h3>
            <div className="participants-list">
              {participants.map(participant => (
                <div key={participant.id} className="participant-item">
                  <span className="participant-name">
                    {participant.name} {participant.isLocal && '(Вы)'}
                  </span>
                  <div className="participant-status">
                    {!participant.isLocal && <span className="online-dot">●</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Чат */}
          <div className="chat-section">
            <div className="chat-header">
              <h3>Чат</h3>
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
          </div>
        </section>
      </div>
    </div>
  );
}

export default RoomPage;