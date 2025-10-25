import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import HomePage from './components/HomePage';
import RoomPage from './components/RoomPage';
import LandingPage from './components/LandingPage';
import './App.css';

function AuthWrapper() {
  const [isLogin, setIsLogin] = useState(true);
  const { currentUser } = useAuth();

  if (currentUser) {
    return <Navigate to="/home" replace />;
  }

  return isLogin ? (
    <Login onSwitchToRegister={() => setIsLogin(false)} />
  ) : (
    <Register onSwitchToLogin={() => setIsLogin(true)} />
  );
}

function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/auth" replace />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Публичная стартовая страница */}
            <Route path="/" element={<LandingPage />} />
            
            {/* Страница аутентификации */}
            <Route path="/auth" element={<AuthWrapper />} />
            
            {/* Защищенные маршруты */}
            <Route 
              path="/home" 
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/room/:roomId" 
              element={
                <ProtectedRoute>
                  <RoomPage />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;