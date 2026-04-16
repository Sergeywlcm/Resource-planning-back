import { useEffect, useState } from 'react';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export default function App() {
  const [healthStatus, setHealthStatus] = useState('Checking backend health...');
  const [pingMessage, setPingMessage] = useState('Connecting...');

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const [healthResponse, pingResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/health`),
          fetch(`${apiBaseUrl}/api/ping`)
        ]);

        if (!healthResponse.ok || !pingResponse.ok) {
          throw new Error('Non-200 response from backend');
        }

        const healthData = await healthResponse.json();
        const pingData = await pingResponse.json();

        setHealthStatus(`Health: ${healthData.status}`);
        setPingMessage(`API: ${pingData.message}`);
      } catch (error) {
        setHealthStatus('Health: unavailable');
        setPingMessage(`API: failed to connect (${error.message})`);
      }
    };

    checkBackend();
  }, []);

  return (
    <main className="app">
      <h1>Resource Management System</h1>
      <p>{healthStatus}</p>
      <p>{pingMessage}</p>
    </main>
  );
}
