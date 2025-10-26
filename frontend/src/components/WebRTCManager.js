import { WS_BASE } from '../config';

class WebRTCManager {
  constructor(roomId, userId, onRemoteStream, onUserLeft) {
    this.roomId = roomId;
    this.userId = userId;
    this.onRemoteStream = onRemoteStream;
    this.onUserLeft = onUserLeft;
    
    this.localStream = null;
    this.peerConnections = {};
    this.websocket = null;
    this.connectedUsers = new Set();
    
    this.configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    };

    this.chatMessageHandler = null;
  }

  async initialize() {
    try {
      console.log('🎥 Initializing WebRTC for user:', this.userId);
      
      await this.initializeMediaDevices();
      await this.connectWebSocket();
      
      console.log('✅ WebRTC initialized successfully');
      return this.localStream;
      
    } catch (error) {
      console.error('❌ WebRTC initialization failed:', error);
      throw error;
    }
  }

  async initializeMediaDevices() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('✅ Media devices accessed:', {
        video: this.localStream.getVideoTracks().length > 0,
        audio: this.localStream.getAudioTracks().length > 0
      });

    } catch (error) {
      console.warn('⚠️ Cannot access camera/microphone:', error);
      this.localStream = new MediaStream();
      console.log('📱 Created empty stream for connection testing');
    }
  }

  connectWebSocket() {
    return new Promise((resolve, reject) => {
      const wsUrl = `${WS_BASE}/ws/webrtc/${this.roomId}/${this.userId}`;
      console.log('🔌 Connecting to WebSocket:', wsUrl);
      
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('✅ WebSocket connected');
        
        setTimeout(() => {
          this.sendWebSocketMessage({
            type: 'user_joined',
            user_id: this.userId
          });
        }, 1000);
        
        resolve();
      };

      this.websocket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      };

      this.websocket.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
      };

      this.websocket.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          await this.handleSignalingMessage(data);
        } catch (error) {
          console.error('❌ Error processing message:', error);
        }
      };
    });
  }

  async handleSignalingMessage(data) {
    if (data.from_user_id === this.userId) return;

    console.log(`📨 ${data.type} from ${data.from_user_id}`);

    if (data.type === 'chat_message' && this.chatMessageHandler) {
      this.chatMessageHandler({
        id: Date.now(),
        message: data.message,
        userName: data.from_user_id === this.userId ? 'Вы' : `Участник ${data.from_user_id}`,
        isOwn: data.from_user_id === this.userId,
        timestamp: data.timestamp || new Date().toISOString()
      });
      return; // Важно: возвращаемся, чтобы не обрабатывать как WebRTC сообщение
    }

    switch (data.type) {
      case 'user_joined':
        await this.handleUserJoined(data.user_id);
        break;
      case 'user_left':
        this.handleUserLeft(data.user_id);
        break;
      case 'offer':
        await this.handleOffer(data.offer, data.from_user_id);
        break;
      case 'answer':
        await this.handleAnswer(data.answer, data.from_user_id);
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(data.candidate, data.from_user_id);
        break;
    }
  }

  async handleUserJoined(userId) {
    if (userId === this.userId) return;
    
    console.log(`👤 New user joined: ${userId}`);
    this.connectedUsers.add(userId);
    
    setTimeout(async () => {
      await this.createOffer(userId);
    }, 2000);
  }

  createPeerConnection(userId) {
    console.log(`🔗 Creating peer connection for ${userId}`);
    
    const peerConnection = new RTCPeerConnection(this.configuration);
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        console.log(`➕ Adding ${track.kind} track to ${userId}`);
        try {
          peerConnection.addTrack(track, this.localStream);
        } catch (error) {
          console.error(`❌ Error adding ${track.kind} track:`, error);
        }
      });
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendWebSocketMessage({
          type: 'ice-candidate',
          candidate: event.candidate,
          to_user_id: userId
        });
      }
    };

    peerConnection.ontrack = (event) => {
      console.log(`🎬 Received remote ${event.track.kind} track from ${userId}`);
      
      if (event.streams && event.streams[0]) {
        console.log(`📹 Stream received from ${userId} with ${event.streams[0].getTracks().length} tracks`);
        this.onRemoteStream(userId, event.streams[0]);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log(`🔗 ${userId} connection state:`, state);
    };

    this.peerConnections[userId] = peerConnection;
    return peerConnection;
  }

  async createOffer(userId) {
    if (userId === this.userId) return;
    
    console.log(`📝 Creating offer for ${userId}`);
    
    let peerConnection = this.peerConnections[userId];
    if (!peerConnection) {
      peerConnection = this.createPeerConnection(userId);
    }
    
    try {
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await peerConnection.setLocalDescription(offer);
      
      this.sendWebSocketMessage({
        type: 'offer',
        offer: offer,
        to_user_id: userId
      });
      
      console.log(`✅ Offer sent to ${userId}`);
    } catch (error) {
      console.error(`❌ Error creating offer for ${userId}:`, error);
    }
  }

  async handleOffer(offer, fromUserId) {
    if (fromUserId === this.userId) return;
    
    console.log(`📝 Handling offer from ${fromUserId}`);
    
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
      
      console.log(`✅ Answer sent to ${fromUserId}`);
    } catch (error) {
      console.error(`❌ Error handling offer from ${fromUserId}:`, error);
    }
  }

  async handleAnswer(answer, fromUserId) {
    const peerConnection = this.peerConnections[fromUserId];
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`✅ Answer processed from ${fromUserId}`);
      } catch (error) {
        console.error(`❌ Error handling answer from ${fromUserId}:`, error);
      }
    }
  }

  async handleIceCandidate(candidate, fromUserId) {
    const peerConnection = this.peerConnections[fromUserId];
    if (peerConnection && peerConnection.remoteDescription) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error(`❌ Error adding ICE candidate from ${fromUserId}:`, error);
      }
    }
  }

  handleUserLeft(userId) {
    console.log(`👤 User left: ${userId}`);
    if (this.peerConnections[userId]) {
      this.peerConnections[userId].close();
      delete this.peerConnections[userId];
    }
    this.connectedUsers.delete(userId);
    this.onUserLeft(userId);
  }

  sendWebSocketMessage(message) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      const messageWithSender = {
        ...message,
        from_user_id: this.userId
      };
      this.websocket.send(JSON.stringify(messageWithSender));
    }
  }

  toggleAudio() {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const enabled = !audioTracks[0].enabled;
        audioTracks[0].enabled = enabled;
        console.log(`🎤 Audio ${enabled ? 'enabled' : 'disabled'}`);
        return enabled;
      }
    }
    return false;
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const enabled = !videoTracks[0].enabled;
        videoTracks[0].enabled = enabled;
        console.log(`📹 Video ${enabled ? 'enabled' : 'disabled'}`);
        return enabled;
      }
    }
    return false;
  }

  async restartMedia() {
    try {
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
      }
      
      await this.initializeMediaDevices();
      
      Object.keys(this.peerConnections).forEach(userId => {
        const pc = this.peerConnections[userId];
        
        const senders = pc.getSenders();
        senders.forEach(s => {
          if (s.track) {
            pc.removeTrack(s);
          }
        });
        
        if (this.localStream) {
          this.localStream.getTracks().forEach(track => {
            pc.addTrack(track, this.localStream);
          });
        }
      });
      
      return this.localStream;
    } catch (error) {
      console.error('❌ Error restarting media:', error);
      throw error;
    }
  }

  setChatMessageHandler(handler) {
    this.chatMessageHandler = handler;
  }

  sendChatMessage(message) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.sendWebSocketMessage({
        type: 'chat_message',
        message: message,
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('WebSocket not connected');
    }
  }

  destroy() {
    console.log('🧹 Cleaning up WebRTC...');
    
    this.sendWebSocketMessage({
      type: 'user_left',
      user_id: this.userId
    });

    Object.values(this.peerConnections).forEach(pc => pc.close());
    this.peerConnections = {};

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    if (this.websocket) {
      this.websocket.close();
    }
  }
}

export default WebRTCManager;