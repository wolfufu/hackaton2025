import React, { useRef, useEffect, useState } from 'react';

class WebRTCManager {
  constructor(roomId, userId, onRemoteStream, onUserLeft) {
    this.roomId = roomId;
    this.userId = userId;
    this.onRemoteStream = onRemoteStream;
    this.onUserLeft = onUserLeft;
    
    this.localStream = null;
    this.peerConnections = {};
    this.websocket = null;
    this.configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
  }

  // Инициализация WebRTC
  async initialize() {
    try {
      // Получаем доступ к медиаустройствам
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      // Подключаемся к WebSocket для сигналинга
      this.connectWebSocket();
      
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  // Подключение к WebSocket
  connectWebSocket() {
    this.websocket = new WebSocket(`ws://localhost:8000/api/ws/webrtc/${this.roomId}/${this.userId}`);
    
    this.websocket.onopen = () => {
        console.log('WebRTC WebSocket connected');
    };

    this.websocket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        
        // Игнорируем сообщения от самого себя
        if (data.from_user_id === this.userId) return;
        
        switch (data.type) {
            case 'offer':
                await this.handleOffer(data.offer, data.from_user_id);
                break;
            case 'answer':
                await this.handleAnswer(data.answer, data.from_user_id);
                break;
            case 'ice-candidate':
                await this.handleIceCandidate(data.candidate, data.from_user_id);
                break;
            case 'user_joined':
                // Игнорируем уведомление о своем подключении
                if (data.user_id !== this.userId) {
                    await this.createOffer(data.user_id);
                }
                break;
            case 'user_left':
                if (data.user_id !== this.userId) {
                    this.handleUserLeft(data.user_id);
                }
                break;
        }
    };

    this.websocket.onclose = () => {
        console.log('WebRTC WebSocket disconnected');
    };
}

  // Создание PeerConnection
  createPeerConnection(userId) {
    const peerConnection = new RTCPeerConnection(this.configuration);
    
    // Добавляем локальный поток
    this.localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, this.localStream);
    });

    // Обработка ICE кандидатов
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendWebSocketMessage({
          type: 'ice-candidate',
          candidate: event.candidate,
          to_user_id: userId
        });
      }
    };

    // Получение удаленного потока
    peerConnection.ontrack = (event) => {
      const remoteStream = event.streams[0];
      this.onRemoteStream(userId, remoteStream);
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state with ${userId}:`, peerConnection.connectionState);
    };

    this.peerConnections[userId] = peerConnection;
    return peerConnection;
  }

  // Создание оффера для нового пользователя
    async createOffer(userId) {
        // Не создаем оффер для самого себя
        if (userId === this.userId) return;

        const peerConnection = this.createPeerConnection(userId);
        
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            this.sendWebSocketMessage({
                type: 'offer',
                offer: offer,
                to_user_id: userId
            });
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }

  // Обработка входящего оффера
  async handleOffer(offer, fromUserId) {
    // Игнорируем офферы от самого себя
    if (fromUserId === this.userId) return;

    let peerConnection = this.peerConnections[fromUserId];
    if (!peerConnection) {
        peerConnection = this.createPeerConnection(fromUserId);
    }

    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        this.sendWebSocketMessage({
            type: 'answer',
            answer: answer,
            to_user_id: fromUserId
        });
    } catch (error) {
        console.error('Error handling offer:', error);
    }
}

  // Обработка ответа
  async handleAnswer(answer, fromUserId) {
    const peerConnection = this.peerConnections[fromUserId];
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    }
  }

  // Обработка ICE кандидатов
  async handleIceCandidate(candidate, fromUserId) {
    const peerConnection = this.peerConnections[fromUserId];
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  }

  // Обработка выхода пользователя
  handleUserLeft(userId) {
    if (this.peerConnections[userId]) {
      this.peerConnections[userId].close();
      delete this.peerConnections[userId];
    }
    this.onUserLeft(userId);
  }

  // Отправка сообщения через WebSocket
  sendWebSocketMessage(message) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  // Переключение аудио
  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }

  // Переключение видео
  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }

  // Остановка всех соединений
  destroy() {
    // Закрываем все PeerConnection
    Object.values(this.peerConnections).forEach(pc => pc.close());
    this.peerConnections = {};

    // Останавливаем локальный поток
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    // Закрываем WebSocket
    if (this.websocket) {
      this.websocket.close();
    }
  }
}

export default WebRTCManager;