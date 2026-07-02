import { useCallback, useState } from 'react';
import { useOrbit } from '../../state/OrbitContext';

/** Push a toast message to the PC screen. */
export function useNotification() {
  const { activeDevice, request } = useOrbit();
  const [message, setMessage] = useState('');

  const send = useCallback(async () => {
    if (!activeDevice || !message.trim()) return;
    try {
      const res = await request('/api/v1/system/notification', {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      if (res.ok) {
        alert('Message sent to PC!');
        setMessage('');
      }
    } catch (err) {
      console.error('Failed to send notification:', err);
    }
  }, [activeDevice, request, message]);

  return { message, setMessage, send };
}
