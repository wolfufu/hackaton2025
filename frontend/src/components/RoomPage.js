import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import WebRTCManager from './WebRTCManager';
import { useChat } from '../hooks/useChat';
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
  const [activeTab, setActiveTab] = useState('participants');

  // Используем хук чата
  const {
    messages,
    newMessage,
    setNewMessage,
    sendMessage,
    clearChat,
    messagesEndRef
  } = useChat(webrtcManager, currentUser);

  const localVideoRef = useRef();
  const remoteVideosRef = useRef({});
  const messageInputRef = useRef();

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
    console.log('🚀 RoomPage mounted with:', { roomId, currentUserId: currentUser?.id, isHost });
    
    if (!roomId || !currentUser) {
      console.warn('❌ Missing roomId or currentUser, redirecting to home');
      navigate('/');
      return;
    }

    initializeWebRTC();

    return () => {
      console.log('🧹 RoomPage unmounting, cleaning up WebRTC');
      if (webrtcManager) {
        webrtcManager.destroy();
      }
    };
  }, [roomId, currentUser]);

  useEffect(() => {
    console.log('📊 Remote streams updated:', Object.keys(remoteStreams).length);
    Object.entries(remoteStreams).forEach(([userId, stream]) => {
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      console.log(`📹 User ${userId} stream:`, {
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        videoEnabled: videoTracks[0]?.enabled,
        audioEnabled: audioTracks[0]?.enabled,
        videoReadyState: videoTracks[0]?.readyState,
        audioReadyState: audioTracks[0]?.readyState
      });
    });
  }, [remoteStreams]);

  // Фокус на поле ввода при переключении на чат
  useEffect(() => {
    if (activeTab === 'chat' && messageInputRef.current) {
      setTimeout(() => {
        messageInputRef.current.focus();
      }, 100);
    }
  }, [activeTab]);

  const initializeWebRTC = async () => {
    try {
      console.log('🎯 Initializing WebRTC for room:', roomId);
      setConnectionStatus('connecting');
      
      const manager = new WebRTCManager(
        roomId,
        currentUser.id.toString(),
        handleRemoteStream,
        handleUserLeft
      );

      const stream = await manager.initialize();
      console.log('✅ WebRTC initialized successfully');
      
      setWebrtcManager(manager);
      setLocalStream(stream);
      setConnectionStatus('connected');
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('🎥 Local video element updated');
      }

      // Добавляем текущего пользователя в список участников
      setParticipants([{
        id: currentUser.id,
        name: currentUser.name,
        isHost: isHost
      }]);

    } catch (error) {
      console.error('❌ Failed to initialize WebRTC:', error);
      setError('Не удалось получить доступ к камере/микрофону. Проверьте разрешения.');
      setConnectionStatus('error');
    }
  };

  const handleRemoteStream = (userId, stream) => {
    console.log('🎬 Remote stream received from:', userId, 'Tracks:', stream.getTracks().length);
    
    if (stream.getTracks().length === 0) {
      console.warn('⚠️ Empty stream received from:', userId);
      return;
    }

    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];
    
    if (videoTrack) {
      console.log(`📹 Video track from ${userId}:`, {
        enabled: videoTrack.enabled,
        readyState: videoTrack.readyState,
        settings: videoTrack.getSettings()
      });
    }

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
      const videoElement = remoteVideosRef.current[userId];
      if (videoElement) {
        videoElement.srcObject = stream;
        console.log('✅ Video element updated for user:', userId);
        
        videoElement.onloadedmetadata = () => {
          console.log(`🎬 Video metadata loaded for user ${userId}`);
        };
        
        videoElement.oncanplay = () => {
          console.log(`▶️ Video can play for user ${userId}`);
        };
      } else {
        console.warn(`❌ Video element not found for user ${userId}`);
      }
    }, 100);
  };

  const handleUserLeft = (userId) => {
    console.log('👋 User left:', userId);
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
      console.log(`🎤 Audio ${enabled ? 'enabled' : 'disabled'}`);
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
    console.log('🚪 Leaving room');
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
    console.log('🔄 Restarting WebRTC connection');
    setError('');
    setConnectionStatus('connecting');
    
    if (webrtcManager) {
      webrtcManager.destroy();
    }
    
    await initializeWebRTC();
  };

  // ✅ ФУНКЦИЯ ДЛЯ ОТПРАВКИ СООБЩЕНИЯ
  const handleSendMessage = () => {
    console.log('🔄 handleSendMessage called');
    if (newMessage.trim()) {
      console.log('📝 Message to send:', newMessage);
      sendMessage();
    } else {
      console.log('⚠️ Empty message, not sending');
    }
  };

  // ✅ ФУНКЦИЯ ДЛЯ ОБРАБОТКИ КЛАВИШИ ENTER
  const handleKeyPress = (e) => {
    console.log('⌨️ Key pressed:', e.key);
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      console.log('✅ Enter pressed, sending message');
      handleSendMessage();
    }
  };

  if (!roomId) {
    return <div>Ошибка: Комната не найдена</div>;
  }

  // Подготовка данных для отображения
  const localParticipant = participants.find(p => p.id === currentUser.id);
  const remoteParticipants = participants
    .filter(p => p.id !== currentUser.id)
    .map(p => ({
      ...p,
      stream: remoteStreams[p.id]
    }));

  const isAudioMuted = !isAudioEnabled;
  const isVideoOff = !isVideoEnabled;

  return (
    <div className="room-page">
      {/* Header */}
      <header className="room-header">
        <div className="room-info">
          <h2>{roomName || `Комната ${roomId}`}</h2>
          <p>Участников: {participants.length} | {isHost ? 'Вы организатор' : 'Участник'}</p>
        </div>
        <div className="room-actions">
          <button onClick={openInviteModal} className="invite-btn">
            <span className="material-icons">link</span>
            Пригласить
          </button>
          <button onClick={leaveRoom} className="leave-btn">
            <span className="material-icons">logout</span>
            Выйти
          </button>
        </div>
      </header>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={restartWebRTC}>Попробовать снова</button>
        </div>
      )}

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
                  onLoadedMetadata={() => console.log('🎥 Local video metadata loaded')}
                  onCanPlay={() => console.log('▶️ Local video can play')}
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
                      console.log(`🎥 Remote video ${participant.id} metadata loaded`);
                    }
                  }}
                  onCanPlay={() => console.log(`▶️ Remote video ${participant.id} can play`)}
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
              <span className="material-icons">
                {isAudioMuted ? 'mic_off' : 'mic'}
              </span>
            </button>
            <button 
              onClick={toggleVideo} 
              className={`control-btn ${isVideoOff ? 'off' : ''}`}
            >
              <span className="material-icons">
                {isVideoOff ? 'videocam_off' : 'videocam'}
              </span>
            </button>
          </div>
        </section>

        {/* Чат и участники */}
        <section className="sidebar">
          <div className="sidebar-tabs">
            <button 
              className={`tab-button ${activeTab === 'participants' ? 'active' : ''}`}
              onClick={() => setActiveTab('participants')}
            >
              👥 Участники ({participants.length})
            </button>
            <button 
              className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              💬 Чат {messages.length > 0 && `(${messages.length})`}
            </button>
          </div>

          {activeTab === 'participants' && (
            <div className="tab-content">
              {/* Список участников */}
              <div className="participants-section">
                <h3>Участники ({participants.length})</h3>
                <div className="participants-list">
                  {participants.map(participant => (
                    <div key={participant.id} className="participant-item">
                      <span className="participant-name">
                        {participant.name} {participant.id === currentUser.id && '(Вы)'}
                        {participant.isHost && ' 👑'}
                      </span>
                      <div className="participant-status">
                        {participant.id !== currentUser.id && <span className="material-icons online-dot">circle</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Управление */}
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
                  <button onClick={restartWebRTC} className="control-btn refresh">
                    🔄 Переподключиться
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
          )}

          {activeTab === 'chat' && (
            <div className="tab-content chat-tab">
              {/* Чат */}
              <div className="chat-section">
                <div className="chat-header">
                  <h3>Чат</h3>
                </div>
                
                <div className="messages-container">
                  {messages.length === 0 ? (
                    <div className="no-messages">
                      💬 Начните общение в чате...
                    </div>
                  ) : (
                    messages.map(message => (
                      <div key={message.id} className={`message ${message.isOwn ? 'own-message' : 'other-message'}`}>
                        <div className="message-header">
                          <span className="message-sender">
                            {message.isOwn ? 'Вы' : message.userName}
                          </span>
                          <span className="message-time">
                            {new Date(message.timestamp).toLocaleTimeString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="message-text">{message.message}</div>
                        <div className="message-date">
                          {new Date(message.timestamp).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'short'
                          })}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="message-input">
                  <input
                    ref={messageInputRef}
                    type="text"
                    placeholder="Введите сообщение..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                  />
                  <button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                    <span className="material-icons">send</span>
                  </button>
                </div>
                {messages.length > 0 && (
                  <button onClick={clearChat} className="clear-chat-btn">
                    Очистить чат
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

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
        <button onClick={() => setActiveTab('chat')} className="control-btn">
          💬
        </button>
        <button onClick={leaveRoom} className="control-btn leave">
          📞
        </button>
      </div>

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