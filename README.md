Платформа для онлайн-конференций
================================

О проекте
---------
Это веб-приложение для организации и проведения онлайн-конференций с возможностью видеозвонков, обмена сообщениями и демонстрации экрана. Включает бэкенд на FastAPI и фронтенд на React.

Статус: заморожен.

Ключевые возможности
--------------------
- Аутентификация пользователей (регистрация и вход)
- Видеоконференция с использованием WebRTC
- Чат в реальном времени через WebSockets
- Интуитивно понятный интерфейс на React
- Контейнеризация с помощью Docker

Технологический стек
--------------------
Бэкенд:
  - API: FastAPI (Python)
  - База данных: SQLite / PostgreSQL + Alembic
  - Аутентификация: JWT
  - Real-time: WebSockets
  - Видео: WebRTC

Фронтенд:
  - React (Create React App)
  - JavaScript, CSS

Инфраструктура:
  - Docker
  - Uvicorn

Структура проекта
-----------------
```
hackaton2025/
├── backend/
│   ├── alembic/          # миграции БД
│   ├── main.py           # точка входа FastAPI
│   ├── models.py         # SQLAlchemy модели
│   ├── schemas.py        # Pydantic схемы
│   ├── auth.py           # JWT-логика
│   ├── database.py       # подключение к БД
│   ├── webrtc.py         # WebRTC сигналинг
│   ├── websocket.py      # обработка WebSocket
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── App.js
│   │   ├── config.js
│   │   └── ...
│   └── package.json
└── README.md
```

Быстрый старт
-------------
Запуск бэкенда:
  1. Перейдите в папку backend
  2. Создайте виртуальное окружение:
       python -m venv venv
       source venv/bin/activate (или venv\Scripts\activate на Windows)
  3. Установите зависимости: pip install -r requirements.txt
  4. Примените миграции: alembic upgrade head
  5. Запустите сервер: uvicorn main:app --reload
     Бэкенд будет доступен по адресу http://localhost:8000

Запуск фронтенда:
  1. Перейдите в папку frontend
  2. Установите зависимости: npm install
  3. Запустите приложение: npm start
     Фронтенд будет доступен по адресу http://localhost:3000

Запуск через Docker:
  - Перейдите в backend и соберите образ:
      docker build -t hackaton2025-backend .
  - Запустите контейнер:
      docker run -p 8000:8000 hackaton2025-backend

API эндпоинты
-------------
Документация автоматически доступна после запуска бэкенда:
  - Swagger UI: http://localhost:8000/docs
  - ReDoc: http://localhost:8000/redoc

Основные эндпоинты (планируемые):
  POST /api/register         – регистрация пользователя
  POST /api/login            – вход и получение JWT
  GET  /api/rooms            – список комнат
  POST /api/rooms/create     – создание комнаты
  WS   /ws/chat/{room_id}    – WebSocket для чата

Участие в разработке
--------------------
Вы можете помочь проекту:
  - Сделайте fork репозитория
  - Создайте ветку для вашей функции
  - Зафиксируйте изменения
  - Отправьте pull request

Лицензия
--------
Проект распространяется под лицензией MIT.

Контакты
--------
Автор: Emiliya Volkova (wolfufu)
Репозиторий: https://github.com/wolfufu/hackaton2025

Разработано с любовью для хакатона.
