import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import WebRTCManager from './WebRTCManager';
import './RoomPage.css';
import { useChat } from '../hooks/useChat';

function RoomPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const { roomId, inviteLink, roomName, isHost } = location.state || {};
  const [webrtcManager, setWebrtcManager] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [error, setError] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const localVideoRef = useRef();
  const remoteVideosRef = useRef({});

  const {
    messages,
    newMessage,
    setNewMessage,
    sendMessage,
    clearChat,
    messagesEndRef
  } = useChat(webrtcManager, currentUser, roomId);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      sendMessage();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    console.log('RoomPage mounted with:', { roomId, currentUserId: currentUser?.id, isHost });
    
    if (!roomId || !currentUser) {
      console.warn('Missing roomId or currentUser, redirecting to home');
      navigate('/');
      return;
    }

    initializeWebRTC();

    return () => {
      console.log('RoomPage unmounting, cleaning up WebRTC');
      if (webrtcManager) {
        webrtcManager.destroy();
      }
    };
  }, [roomId, currentUser]);

  useEffect(() => {
    console.log('Remote streams updated:', Object.keys(remoteStreams).length);
    Object.entries(remoteStreams).forEach(([userId, stream]) => {
      console.log(`User ${userId} has stream:`, stream.getTracks().length > 0);
    });
  }, [remoteStreams]);

  const initializeWebRTC = async () => {
    try {
      console.log('Initializing WebRTC for room:', roomId);
      setConnectionStatus('connecting');
      
      const manager = new WebRTCManager(
        roomId,
        currentUser.id.toString(),
        handleRemoteStream,
        handleUserLeft
      );

      const stream = await manager.initialize();
      console.log('WebRTC initialized successfully');
      
      setWebrtcManager(manager);
      setLocalStream(stream);
      setConnectionStatus('connected');
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('Local video element updated');
      }

      setParticipants([{
        id: currentUser.id,
        name: currentUser.name,
        isHost: isHost
      }]);

    } catch (error) {
      console.error('Failed to initialize WebRTC:', error);
      setError('Не удалось получить доступ к камере/микрофону. Проверьте разрешения.');
      setConnectionStatus('error');
    }
  };

  const handleRemoteStream = (userId, stream) => {
    console.log('Remote stream received from:', userId, 'Tracks:', stream.getTracks().length);

    if (stream.getTracks().length === 0) {
      console.warn('Empty stream received from:', userId);
      return;
    }

    setRemoteStreams(prev => ({
      ...prev,
      [userId]: stream
    }));

    setParticipants(prev => {
      if (!prev.find(p => p.id.toString() === userId.toString())) {
        return [...prev, {
          id: userId,
          name: `Участник ${userId}`,
          isHost: false
        }];
      }
      return prev;
    });

    setTimeout(() => {
      if (remoteVideosRef.current[userId]) {
        remoteVideosRef.current[userId].srcObject = stream;
        console.log('Video element updated for user:', userId);
      }
    }, 100);
  };

  const handleUserLeft = (userId) => {
    console.log('User left:', userId);
    setRemoteStreams(prev => {
      const newStreams = { ...prev };
      delete newStreams[userId];
      return newStreams;
    });

    setParticipants(prev => prev.filter(p => p.id.toString() !== userId.toString()));
  };

  const toggleAudio = () => {
    if (webrtcManager) {
      const enabled = webrtcManager.toggleAudio();
      setIsAudioEnabled(enabled);
    }
  };

  const toggleVideo = () => {
    if (webrtcManager) {
      const enabled = webrtcManager.toggleVideo();
      setIsVideoEnabled(enabled);
    }
  };

  const copyInviteLink = () => {
    const fullInviteLink = `${window.location.origin}/?join=${inviteLink}`;
    navigator.clipboard.writeText(fullInviteLink)
      .then(() => {
        alert('Ссылка скопирована в буфер обмена!');
      })
      .catch(err => {
        console.error('Ошибка копирования: ', err);
        const textArea = document.createElement('textarea');
        textArea.value = fullInviteLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Ссылка скопирована!');
      });
    setShowInviteModal(false);
  };

  const leaveRoom = () => {
    console.log('Leaving room');
    if (webrtcManager) {
      webrtcManager.destroy();
    }
    navigate('/');
  };

  const openInviteModal = () => {
    setShowInviteModal(true);
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
  };

  const restartWebRTC = async () => {
    console.log('Restarting WebRTC connection');
    setError('');
    setConnectionStatus('connecting');
    
    if (webrtcManager) {
      webrtcManager.destroy();
    }
    
    await initializeWebRTC();
  };

  if (!roomId) {
    return <div>Ошибка: Комната не найдена</div>;
  }

  return (
    <div className="room-page">
      <header className="room-header">
        <div className="room-header-content">
          <div className="room-info">
            <h2>Комната: {roomName}</h2>
            <div className="room-details">
              <span className="room-id">ID: {roomId}</span>
              <span className="invite-code">Код: {inviteLink}</span>
              {isHost && <span className="host-badge">👑 Организатор</span>}
              <div className="connection-status">
                Статус: {connectionStatus === 'connected' ? '🟢 Подключено' : 
                        connectionStatus === 'connecting' ? '🟡 Подключение...' : 
                        '🔴 Ошибка'}
              </div>
            </div>
          </div>
          
          <div className="header-controls">
            <button onClick={openInviteModal} className="invite-btn">
              📨 Пригласить
            </button>
            <button onClick={leaveRoom} className="leave-btn">
              📞 Выйти
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={restartWebRTC}>Попробовать снова</button>
        </div>
      )}

      <div className="room-content">
        <div className="video-container">
          {/* Локальное видео */}
          <div className="video-wrapper local-video">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
            />
            <div className="video-label">
              Вы {isHost && '👑'} - {currentUser?.name}
              <div className="status-indicators">
                {!isAudioEnabled && <span className="muted-indicator">🔇</span>}
                {!isVideoEnabled && <span className="muted-indicator">❌</span>}
              </div>
            </div>
          </div>

          {/* Удаленные видео */}
          {Object.entries(remoteStreams).map(([userId, stream]) => (
            <div key={userId} className="video-wrapper remote-video">
              <video
                ref={el => remoteVideosRef.current[userId] = el}
                autoPlay
                playsInline
              />
              <div className="video-label">
                Участник {userId}
              </div>
            </div>
          ))}
        </div>

        {/* Боковая панель с участниками */}
        <div className="sidebar">
          <div className="participants-section">
            <h3>Участники ({participants.length})</h3>
            <div className="participants-list">
              {participants.map(participant => (
                <div key={participant.id} className="participant-item">
                  <span className="participant-name">
                    {participant.name}
                    {participant.isHost && ' 👑'}
                  </span>
                  <span className="participant-status">
                    {remoteStreams[participant.id] ? '🟢' : '⚫'}
                  </span>
                </div>
              ))}
            </div>
  <div className="chat-section">
          <h3>💬 Чат комнаты</h3>
          
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="no-messages">
                💬 Начните общение в чате...
              </div>
            ) : (
              messages.map(message => (
                <div key={message.id} className={`message ${message.isOwn ? 'own-message' : 'other-message'}`}>
                  <div className="message-sender">
                    {message.isOwn ? 'Вы' : message.userName}
                  </div>
                  <div className="message-text">{message.message}</div>
                  <div className="message-time">
                    {new Date(message.timestamp).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="chat-input">
            <input
              type="text"
              placeholder="Введите сообщение..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <button 
              onClick={handleSendMessage} 
              disabled={!newMessage.trim()}
              className="send-btn"
            >
              📤
            </button>
          </div>

          {messages.length > 0 && (
            <button onClick={clearChat} className="clear-chat-btn">
              Очистить чат
            </button>
          )}
        </div>
          </div>

          <div className="controls-section">
            <h3>Управление</h3>
            <div className="control-buttons">
              <button 
                onClick={toggleAudio}
                className={`control-btn ${isAudioEnabled ? 'active' : 'muted'}`}
              >
                {isAudioEnabled ? '🔊 Микрофон' : '🔇 Выкл'}
              </button>
              <button 
                onClick={toggleVideo}
                className={`control-btn ${isVideoEnabled ? 'active' : 'muted'}`}
              >
                {isVideoEnabled ? '📹 Камера' : '❌ Выкл'}
              </button>
              <button onClick={openInviteModal} className="control-btn invite">
                📨 Пригласить
              </button>
              <button onClick={leaveRoom} className="control-btn leave">
                📞 Выйти
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Нижние контролы для мобильных устройств */}
      <div className="mobile-controls">
        <button 
          onClick={toggleAudio}
          className={`control-btn ${isAudioEnabled ? 'active' : 'muted'}`}
        >
          {isAudioEnabled ? '🔊' : '🔇'}
        </button>
        <button 
          onClick={toggleVideo}
          className={`control-btn ${isVideoEnabled ? 'active' : 'muted'}`}
        >
          {isVideoEnabled ? '📹' : '❌'}
        </button>
        <button onClick={openInviteModal} className="control-btn invite">
          📨
        </button>
        <button onClick={leaveRoom} className="control-btn leave">
          📞
        </button>
      </div>

      {/* Модальное окно приглашения */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={closeInviteModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Пригласить в комнату</h3>
            <p>Отправьте эту ссылку участникам:</p>
            <div className="invite-link-container">
              <code className="invite-link">
                {window.location.origin}/?join={inviteLink}
              </code>
            </div>
            <div className="modal-buttons">
              <button onClick={copyInviteLink} className="copy-btn">
                📋 Скопировать ссылку
              </button>
              <button onClick={closeInviteModal} className="close-btn">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoomPage;