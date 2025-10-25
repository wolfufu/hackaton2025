import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import WebRTCManager from './WebRTCManager';
import './RoomPage.css';
import { WS_BASE } from '../config';

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

  // Отладочная информация
  useEffect(() => {
    console.log('🔍 Room Debug Info:', {
      roomId,
      currentUserId: currentUser?.id,
      currentUserName: currentUser?.name,
      isHost,
      participantsCount: participants.length,
      remoteStreamsCount: Object.keys(remoteStreams).length
    });
  }, [roomId, currentUser, isHost, participants, remoteStreams]);

  // WebSocket для синхронизации участников
  useEffect(() => {
    if (!roomId || !currentUser) return;

    const syncWs = new WebSocket(`${WS_BASE}/ws/${roomId}`);
    
    syncWs.onopen = () => {
      console.log('🔄 Sync WebSocket connected');
      syncWs.send(JSON.stringify({
        type: 'user_joined',
        user_id: currentUser.id,
        user_name: currentUser.name,
        is_host: isHost
      }));
    };

    syncWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'user_joined' && data.user_id !== currentUser.id) {
          console.log('🔄 Sync: New user joined:', data.user_name);
          setParticipants(prev => {
            if (!prev.find(p => p.id === data.user_id)) {
              return [...prev, {
                id: data.user_id,
                name: data.user_name,
                isHost: data.is_host
              }];
            }
            return prev;
          });
        }
        
        if (data.type === 'user_left') {
          console.log('🔄 Sync: User left:', data.user_id);
          setParticipants(prev => prev.filter(p => p.id !== data.user_id));
        }
        
      } catch (error) {
        console.error('Sync WebSocket error:', error);
      }
    };

    syncWs.onclose = () => {
      console.log('🔄 Sync WebSocket disconnected');
    };

    return () => {
      syncWs.close();
    };
  }, [roomId, currentUser, isHost]);

  // Инициализация WebRTC
  useEffect(() => {
    if (!roomId || !currentUser) {
      navigate('/');
      return;
    }

    initializeWebRTC();

    return () => {
      if (webrtcManager) {
        webrtcManager.destroy();
      }
    };
  }, [roomId, currentUser]);

  const initializeWebRTC = async () => {
    try {
      setConnectionStatus('connecting');
      const manager = new WebRTCManager(
        roomId,
        currentUser.id.toString(),
        handleRemoteStream,
        handleUserLeft
      );

      const stream = await manager.initialize();
      setWebrtcManager(manager);
      setLocalStream(stream);
      setConnectionStatus('connected');
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Добавляем текущего пользователя в список участников
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
    console.log('🎬 Handling remote stream from:', userId);
    setRemoteStreams(prev => ({
      ...prev,
      [userId]: stream
    }));

    // Добавляем пользователя в список участников
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

    // Устанавливаем поток для видео элемента
    setTimeout(() => {
      if (remoteVideosRef.current[userId]) {
        remoteVideosRef.current[userId].srcObject = stream;
        console.log('✅ Remote video stream set for user:', userId);
      }
    }, 100);
  };

  const handleUserLeft = (userId) => {
    console.log('👤 User left:', userId);
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

  const toggleVideo = async () => {
    if (webrtcManager) {
      try {
        const enabled = webrtcManager.toggleVideo();
        setIsVideoEnabled(enabled);
        
        // Если включаем видео, но поток пустой - перезапускаем камеру
        if (enabled && localStream && localStream.getVideoTracks().length === 0) {
          await restartCamera();
        }
      } catch (error) {
        console.error('Error toggling video:', error);
      }
    }
  };

  const restartCamera = async () => {
    if (webrtcManager) {
      try {
        console.log('🔄 Restarting camera...');
        const newStream = await webrtcManager.restartMedia();
        setLocalStream(newStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newStream;
        }
        setIsVideoEnabled(true);
        console.log('✅ Camera restarted successfully');
      } catch (error) {
        console.error('Failed to restart camera:', error);
        alert('Не удалось перезапустить камеру');
      }
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
          <div className="error-buttons">
            <button onClick={initializeWebRTC} className="retry-btn">
              Попробовать снова
            </button>
            <button onClick={restartCamera} className="retry-btn">
              Перезапустить камеру
            </button>
          </div>
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
              className="video-element"
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
                className="video-element"
              />
              <div className="video-label">
                Участник {userId}
                <div className="remote-status">
                  {stream.getVideoTracks().length > 0 ? '📹' : '❌'}
                  {stream.getAudioTracks().length > 0 ? '🎤' : '🔇'}
                </div>
              </div>
            </div>
          ))}

          {/* Заглушка если нет удаленных видео */}
          {Object.keys(remoteStreams).length === 0 && (
            <div className="video-wrapper empty-video">
              <div className="empty-video-message">
                <div className="empty-icon">👥</div>
                <p>Ожидание участников...</p>
                <p>Отправьте ссылку-приглашение</p>
              </div>
            </div>
          )}
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
                    {remoteStreams[participant.id] ? '🟢 Online' : '⚫ Offline'}
                  </span>
                </div>
              ))}
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
              <button 
                onClick={restartCamera}
                className="control-btn restart"
              >
                🔄 Перезапустить камеру
              </button>
              <button onClick={openInviteModal} className="control-btn invite">
                📨 Пригласить
              </button>
              <button onClick={leaveRoom} className="control-btn leave">
                📞 Выйти
              </button>
            </div>
          </div>

          {/* Информация о комнате */}
          <div className="room-info-section">
            <h3>Информация о комнате</h3>
            <div className="room-info-details">
              <div className="info-item">
                <span className="info-label">ID комнаты:</span>
                <span className="info-value">{roomId}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Код приглашения:</span>
                <span className="info-value">{inviteLink}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Статус:</span>
                <span className={`info-value status-${connectionStatus}`}>
                  {connectionStatus === 'connected' ? 'Подключено' : 
                   connectionStatus === 'connecting' ? 'Подключение...' : 'Ошибка'}
                </span>
              </div>
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
        <button onClick={restartCamera} className="control-btn restart">
          🔄
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
            <div className="invite-tips">
              <p><strong>Советы:</strong></p>
              <ul>
                <li>Отправьте ссылку через мессенджер или email</li>
                <li>Убедитесь, что участник имеет стабильное интернет-соединение</li>
                <li>Попросите участника разрешить доступ к камере и микрофону</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoomPage;