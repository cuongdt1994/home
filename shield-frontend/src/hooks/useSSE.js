import { useEffect, useRef, useCallback, useState } from 'react';

export default function useSSE(onEvent, { enabled = true } = {}) {
  const [connected, setConnected] = useState(false);
  const retryRef = useRef(0);
  const abortRef = useRef(null);

  const connect = useCallback(() => {
    if (!enabled) return;

    const controller = new AbortController();
    abortRef.current = controller;

    const token = localStorage.getItem('access_token');
    if (!token) return;

    const url = `/api/events/realtime?token=${encodeURIComponent(token)}`;

    // Use EventSource for SSE
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        setConnected(true);
        retryRef.current = 0;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                if (event.type && event.type !== 'connected') {
                  onEvent(event);
                }
              } catch (e) { /* skip malformed */ }
            }
          }
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setConnected(false);
        // Exponential backoff reconnect
        const delay = Math.min(1000 * Math.pow(2, retryRef.current), 30000);
        retryRef.current++;
        setTimeout(connect, delay);
      });
  }, [enabled, onEvent]);

  useEffect(() => {
    connect();
    return () => {
      abortRef.current?.abort();
    };
  }, [connect]);

  return { connected };
}
