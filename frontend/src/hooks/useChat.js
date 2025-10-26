// useChat.js - ОБНОВЛЕННАЯ ВЕРСИЯ С ОТЛАДКОЙ
import { useState, useCallback, useEffect, useRef } from 'react';

export const useChat = (webrtcManager, currentUser) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!webrtcManager) return;

    // ПРОВЕРЯЕМ СУЩЕСТВОВАНИЕ МЕТОДА ПЕРЕД ВЫЗОВОМ
    if (typeof webrtcManager.setChatMessageHandler === 'function') {
      webrtcManager.setChatMessageHandler((message) => {
        setMessages(prev => [...prev, message]);
      });
    } else {
      console.warn('WebRTCManager does not support chat');
    }

  }, [webrtcManager]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleChatMessage = useCallback((data) => {
    const { from_user_id, message, timestamp, user_name } = data;
    
    console.log('💬 handleChatMessage called with data:', data);
    
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      userId: from_user_id,
      userName: user_name || `Участник ${from_user_id}`,
      message: message,
      timestamp: timestamp || new Date().toISOString(),
      isOwn: from_user_id === currentUser?.id?.toString()
    }]);
  }, [currentUser]);

  const sendMessage = useCallback(() => {
    console.log('🔄 sendMessage called, newMessage:', newMessage);
    
    if (!newMessage.trim()) {
      console.warn('❌ Cannot send empty message');
      return;
    }

    if (!webrtcManager) {
      console.error('❌ WebRTC manager not available');
      return;
    }

    console.log(`💬 Sending message via WebRTCManager: "${newMessage}"`);
    
    webrtcManager.sendChatMessage(newMessage.trim(), currentUser.name);
    setNewMessage('');
  }, [newMessage, webrtcManager, currentUser]);

  const handleKeyPress = useCallback((e) => {
    console.log('⌨️ Key pressed in useChat:', e.key);
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const clearChat = useCallback(() => {
    console.log('🧹 Clearing chat');
    setMessages([]);
  }, []);

  useEffect(() => {
    if (webrtcManager) {
      console.log('✅ Registering chat handler in WebRTCManager');
      webrtcManager.setChatMessageHandler(handleChatMessage);
    } else {
      console.log('⚠️ WebRTCManager not available for chat handler');
    }
  }, [webrtcManager, handleChatMessage]);

  return {
    messages,
    newMessage,
    setNewMessage,
    sendMessage,
    handleKeyPress,
    clearChat,
    messagesEndRef
  };
};