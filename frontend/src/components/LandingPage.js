// components/LandingPage.js
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import './LandingPage.css';
import logoIcon from './logo-icon.svg';
import tvPic from './picture.png';

function LandingPage() {
  const { currentUser, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Ошибка при выходе:', error);
    }
  };

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className='lp-logo-icon'>
            <h3>ТЕЛЕВИД</h3>
            <img src={logoIcon} alt="Logo Icon" />
        </div>
        <div className='lp-buttons'>
          {currentUser ? (
            <div className="user-header-buttons">
              <Link to="/home" className="cta-button">
                Перейти в приложение
              </Link>
              <button onClick={handleLogout} className="logout-button">
                Выйти
              </button>
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/auth" className="login-button">
                Войти
              </Link>
            </div>
          )}
        </div>
      </header>
      
      <main className="landing-content">

        <section className="auth-section">
          {currentUser ? (
            <div className="user-welcome">
              <h2>С возвращением, {currentUser.name}!</h2>
            </div>
          ) : (
            <div className="guest-welcome">
              <h2>Присоединяйтесь к нам</h2>
                <p>
                    ТЕЛЕВИД — видеосвязь без Большого Брата.<br />
                    Ваши разговоры принадлежат только вам — мы не следим и не храним историю.<br />
                    <br />
                    Создавайте приватные комнаты, общайтесь без цензуры.<br />
                    Минимальная регистрация, максимальная анонимность.<br />
                </p>
            </div>
          )}
        </section>

        <section className="picture">
            <img src={tvPic} alt="picture" />
        </section>

      </main>
    </div>
  );
}

export default LandingPage;