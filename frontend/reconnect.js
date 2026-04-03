// frontend/reconnect.js — Roopashree
// Handles WebSocket auto-reconnect with exponential backoff
// This means: if connection drops, it automatically tries again
// waiting 1s, then 1.5s, then 2.25s... up to max 10s between tries

function createReconnectingWS(url, { onMessage, onOpen, onClose } = {}) {
  let ws = null;
  let delay = 1000;   // start retrying after 1 second
  let stopped = false;

  function connect() {
    if (stopped) return;
    ws = new WebSocket(url);

    ws.onopen = () => {
      delay = 1000;   // reset the wait time on successful connect
      if (onOpen) onOpen(ws);
    };

    ws.onmessage = (event) => {
      if (onMessage) onMessage(event);
    };

    ws.onclose = () => {
      if (onClose) onClose();
      if (!stopped) {
        // wait 'delay' ms then try again
        setTimeout(connect, delay);
        // increase delay each time, max 10 seconds
        delay = Math.min(delay * 1.5, 10000);
      }
    };

    ws.onerror = () => {
      ws.close(); // triggers onclose which retries
    };
  }

  connect(); // start first connection attempt

  // return object so canvas.js can use it
  return {
    send(data) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    },
    close() {
      stopped = true;
      if (ws) ws.close();
    },
    get readyState() {
      return ws ? ws.readyState : WebSocket.CLOSED;
    }
  };
}