import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:8000';

function App() {
  const [data, setData] = useState({});
  const [items, setItems] = useState([]);

  useEffect(() => {
    // Получение данных с бэкенда
    axios.get(`${API_BASE}/`)
      .then(response => setData(response.data));

    axios.get(`${API_BASE}/api/items`)
      .then(response => setItems(response.data.items));
  }, []);

  return (
    <div className="App">
      <h1>React + FastAPI</h1>
      <p>Сообщение: {data.message}</p>
      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;