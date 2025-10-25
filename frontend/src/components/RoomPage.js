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
  
  // Добавлены недостающие состояния
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const localVideoRef = useRef();
  const remoteVideosRef = useRef({});
  const messagesEndRef = useRef();

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

  // Функция для отправки сообщений
  const sendMessage = () => {
    if (newMessage.trim() === '') return;
    
    const message = {
      id: Date.now(),
      sender: currentUser.name,
      text: newMessage,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setMessages(prev => [...prev, message]);
    setNewMessage('');
    
    // Прокрутка к последнему сообщению
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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
          <button onClick={copyInviteLink} className="invite-btn">
            <span className="material-icons">link</span>
            Пригласить
          </button>
          <button onClick={leaveRoom} className="leave-btn">
            <span className="material-icons">logout</span>
            Выйти
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
          {/* Список участников */}
          <div className="participants-section">
            <h3>Участники ({participants.length})</h3>
            <div className="participants-list">
              {participants.map(participant => (
                <div key={participant.id} className="participant-item">
                  <span className="participant-name">
                    {participant.name} {participant.id === currentUser.id && '(Вы)'}
                  </span>
                  <div className="participant-status">
                    {participant.id !== currentUser.id && <span className="material-icons online-dot">circle</span>}
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
              <button onClick={sendMessage}>
                <span className="material-icons">send</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default RoomPage;