import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '../config';

export const useChat = (webrtcManager, currentUser, roomId) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (roomId && currentUser) {
      loadMessageHistory();
    }
  }, [roomId, currentUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessageHistory = async () => {
    if (!roomId) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/rooms/${roomId}/messages`);
      
      if (response.ok) {
        const history = await response.json();
        const formattedMessages = history.map(msg => ({
          id: msg.id,
          message: msg.content || msg.message,
          userName: msg.user_name,
          timestamp: new Date(msg.created_at || msg.timestamp),
          isOwn: msg.user_id === currentUser.id
        }));
        
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!webrtcManager) return;

    const handleWebSocketMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'chat_message') {
          const chatMessage = {
            id: data.id || Date.now(),
            message: data.content || data.message,
            userName: data.user_name,
            timestamp: new Date(data.created_at || data.timestamp),
            isOwn: data.user_id === currentUser.id.toString()
          };
          
          setMessages(prev => [...prev, chatMessage]);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    const originalOnMessage = webrtcManager.websocket.onmessage;
    
    webrtcManager.websocket.onmessage = (event) => {
      handleWebSocketMessage(event);

      if (originalOnMessage) {
        originalOnMessage.call(webrtcManager.websocket, event);
      }
    };

    return () => {
      if (webrtcManager.websocket) {
        webrtcManager.websocket.onmessage = originalOnMessage;
      }
    };
  }, [webrtcManager, currentUser]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !webrtcManager || !roomId) return;

    const messageToSend = newMessage.trim();
    
    try {
      webrtcManager.sendWebSocketMessage({
        type: 'chat_message',
        message: messageToSend
      });
      
      setNewMessage('');
      
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Ошибка отправки сообщения');
    }
  }, [newMessage, webrtcManager, roomId]);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    newMessage,
    setNewMessage,
    sendMessage,
    clearChat,
    isLoading,
    messagesEndRef
  };
};