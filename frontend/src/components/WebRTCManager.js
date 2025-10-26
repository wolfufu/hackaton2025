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
      console.log('Step 1: Getting user media');
      
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('Media obtained:', {
        video: this.localStream.getVideoTracks().length > 0,
        audio: this.localStream.getAudioTracks().length > 0
      });

      await this.connectWebSocket();
      
      return this.localStream;
      
    } catch (error) {
      console.error('Failed to initialize WebRTC:', error);
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
      
      console.log('Media devices accessed:', {
        video: this.localStream.getVideoTracks().length > 0,
        audio: this.localStream.getAudioTracks().length > 0
      });

    } catch (error) {
      console.warn('Cannot access camera/microphone:', error);
      this.localStream = new MediaStream();
      console.log('Created empty stream for connection testing');
    }
  }

  connectWebSocket() {
    return new Promise((resolve, reject) => {
      const wsUrl = `${WS_BASE}/ws/webrtc/${this.roomId}/${this.userId}`;
      console.log('Connecting to WebSocket:', wsUrl);
      
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('WebSocket connected');
        
        setTimeout(() => {
          this.sendWebSocketMessage({
            type: 'user_joined',
            user_id: this.userId
          });
        }, 1000);
        
        resolve();
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.websocket.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
      };

      this.websocket.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          await this.handleSignalingMessage(data);
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };
    });
  }

  async handleWebSocketMessage(data) {
    const { type, from_user_id } = data;
    
    if (from_user_id === this.userId) {
      return;
    }

    console.log(`Received ${type} from ${from_user_id}`);

    switch (type) {
      case 'existing_users':
        console.log(`Existing users in room: ${data.users}`);
        await this.handleExistingUsers(data.users);
        break;
        
      case 'user_joined':
        console.log(`New user joined: ${data.user_id}`);
        await this.handleUserJoined(data.user_id);
        break;
        
      case 'user_left':
        console.log(`User left: ${data.user_id}`);
        this.handleUserLeft(data.user_id);
        break;
        
      case 'offer':
        console.log(`Received offer from ${from_user_id}`);
        await this.handleOffer(data.offer, from_user_id);
        break;
        
      case 'answer':
        console.log(`Received answer from ${from_user_id}`);
        await this.handleAnswer(data.answer, from_user_id);
        break;
        
      case 'ice-candidate':
        console.log(`Received ICE candidate from ${from_user_id}`);
        await this.handleIceCandidate(data.candidate, from_user_id);
        break;
        
      case 'chat_message':
        console.log(`Received chat message from ${from_user_id}: ${data.message}`);
        if (this.onChatMessage) {
          this.onChatMessage(data);
        }
        break;
        
      case 'chat_history':
        console.log(`Received chat history: ${data.messages?.length || 0} messages`);
        if (this.onChatHistory) {
          this.onChatHistory(data.messages || []);
        }
        break;
        
      default:
        console.log('Unknown message type:', type);
    }
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
      return; 
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

  async handleExistingUsers(userIds) {
    for (const userId of userIds) {
      if (userId !== this.userId && !this.connectedUsers.has(userId)) {
        this.connectedUsers.add(userId);
        console.log(`Creating connection to existing user ${userId}`);
        await this.createOffer(userId);
      }
    }
  }

  async handleUserJoined(userId) {
    if (userId !== this.userId && !this.connectedUsers.has(userId)) {
      this.connectedUsers.add(userId);
      console.log(`Creating connection to new user ${userId}`);
      setTimeout(() => {
        this.createOffer(userId);
      }, 1000);
    }
  }

  createPeerConnection(userId) {
    console.log(`Creating peer connection for ${userId}`);
    
    const peerConnection = new RTCPeerConnection(this.configuration);
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        console.log(`Adding ${track.kind} track to ${userId}`);
        peerConnection.addTrack(track, this.localStream);
      });
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`Sending ICE candidate to ${userId}`);
        this.sendWebSocketMessage({
          type: 'ice-candidate',
          candidate: event.candidate,
          to_user_id: userId
        });
      }
    };

    peerConnection.ontrack = (event) => {
      console.log(`🎬 Received remote stream from ${userId}`);
      const remoteStream = event.streams[0];
      if (remoteStream && remoteStream.getTracks().length > 0) {
        console.log(`Successfully connected to ${userId}`);
        this.onRemoteStream(userId, remoteStream);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`🔗 Connection state with ${userId}: ${peerConnection.connectionState}`);
    };

    this.peerConnections[userId] = peerConnection;
    return peerConnection;
  }

  async handleExistingUsers(userIds) {
    for (const userId of userIds) {
      if (userId !== this.userId && !this.connectedUsers.has(userId)) {
        this.connectedUsers.add(userId);
        console.log(`Creating connection to existing user ${userId}`);
        await this.createOffer(userId);
      }
    }
  }

  async createOffer(userId) {
    if (userId === this.userId) return;

    console.log(`Creating offer for ${userId}`);
    
    let peerConnection = this.peerConnections[userId];
    if (!peerConnection) {
      peerConnection = this.createPeerConnection(userId);
    }

    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      this.sendWebSocketMessage({
        type: 'offer',
        offer: offer,
        to_user_id: userId
      });
      
      console.log(`Offer sent to ${userId}`);
    } catch (error) {
      console.error(`Error creating offer for ${userId}:`, error);
    }
  }

  async handleOffer(offer, fromUserId) {
    console.log(`Handling offer from ${fromUserId}`);

    let peerConnection = this.peerConnections[fromUserId];
    if (!peerConnection) {
      peerConnection = this.createPeerConnection(fromUserId);
    }

    try {
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      this.sendWebSocketMessage({
        type: 'answer',
        answer: answer,
        to_user_id: fromUserId
      });
      
      console.log(`Answer sent to ${fromUserId}`);
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  async handleAnswer(answer, fromUserId) {
    const peerConnection = this.peerConnections[fromUserId];
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`Answer processed from ${fromUserId}`);
      } catch (error) {
        console.error(`Error handling answer from ${fromUserId}:`, error);
      }
    }
  }

  async handleIceCandidate(candidate, fromUserId) {
    const peerConnection = this.peerConnections[fromUserId];
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(candidate);
        console.log(`ICE candidate added from ${fromUserId}`);
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  }

  handleUserLeft(userId) {
    console.log(`Cleaning up connection to ${userId}`);
    if (this.peerConnections[userId]) {
      this.peerConnections[userId].close();
      delete this.peerConnections[userId];
    }
    this.connectedUsers.delete(userId);
    this.onUserLeft(userId);
  }

  sendWebSocketMessage(message) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
      console.log('WebSocket message sent:', message.type);
    } else {
      console.warn('WebSocket not connected, message not sent:', message.type);
    }
  }

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
      console.error('Error restarting media:', error);
      throw error;
    }
  }

  destroy() {
    console.log('Destroying WebRTCManager');
    
    Object.values(this.peerConnections).forEach(pc => pc.close());
    this.peerConnections = {};
    this.connectedUsers.clear();
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    if (this.websocket) {
      this.websocket.close();
    }
  }
}

export default WebRTCManager;