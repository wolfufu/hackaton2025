import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const testConnection = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:8000/api/test/');
      setMessage(response.data.message);
      setData(response.data);
    } catch (error) {
      setMessage('Error: ' + error.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>React + Django App</h1>
      <button onClick={testConnection} disabled={loading}>
        {loading ? 'Testing...' : 'Test Django Connection'}
      </button>
      
      {message && (
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5' }}>
          <h3>Status: {message}</h3>
          {data && (
            <pre>{JSON.stringify(data, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
}

export default App;