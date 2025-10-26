import { useState, useCallback } from 'react';
import WebRTCManager from '../components/WebRTCManager';

export const useWebRTC = (roomId, currentUser, isHost) => {
  const [webrtcManager, setWebrtcManager] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const initializeWebRTC = useCallback(async () => {
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
      
      return stream;

    } catch (error) {
      console.error('Failed to initialize WebRTC:', error);
      setError('Не удалось получить доступ к камере/микрофону. Проверьте разрешения.');
      setConnectionStatus('error');
      throw error;
    }
  }, [roomId, currentUser]);

  const handleRemoteStream = useCallback((userId, stream) => {
    console.log('🎬 Remote stream received from:', userId, 'Tracks:', stream.getTracks().length);
    
    // Проверяем что поток содержит треки
    if (stream.getTracks().length === 0) {
      console.warn('⚠️ Empty stream received from:', userId);
      return;
    }

    setRemoteStreams(prev => ({
      ...prev,
      [userId]: stream
    }));
  }, []);

  const handleUserLeft = useCallback((userId) => {
    setRemoteStreams(prev => {
      const newStreams = { ...prev };
      delete newStreams[userId];
      return newStreams;
    });
  }, []);

  const toggleAudio = useCallback(() => {
    if (webrtcManager) {
      const enabled = webrtcManager.toggleAudio();
      setIsAudioEnabled(enabled);
      return enabled;
    }
    return false;
  }, [webrtcManager]);

  const toggleVideo = useCallback(() => {
    if (webrtcManager) {
      const enabled = webrtcManager.toggleVideo();
      setIsVideoEnabled(enabled);
      return enabled;
    }
    return false;
  }, [webrtcManager]);

  const restartCamera = useCallback(async () => {
    if (webrtcManager) {
      try {
        const newStream = await webrtcManager.restartMedia();
        setLocalStream(newStream);
        setIsVideoEnabled(true);
        return newStream;
      } catch (error) {
        console.error('Failed to restart camera:', error);
        throw error;
      }
    }
  }, [webrtcManager]);

  const destroy = useCallback(() => {
    if (webrtcManager) {
      webrtcManager.destroy();
    }
  }, [webrtcManager]);

  return {
    webrtcManager,
    localStream,
    remoteStreams,
    isAudioEnabled,
    isVideoEnabled,
    error,
    connectionStatus,
    initializeWebRTC,
    toggleAudio,
    toggleVideo,
    restartCamera,
    destroy,
    setLocalStream
  };
};