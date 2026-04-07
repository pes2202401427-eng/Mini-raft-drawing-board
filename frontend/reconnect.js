// frontend/reconnect.js — Roopashree
// Auto-reconnecting WebSocket with exponential backoff
// Backoff means: retry after 1s, then 1.5s, then 2.25s... max 10s

function createReconnectingWS(url, { onMessage, onOpen, onClose } = {}) {
  let ws       = null;
  let delay    = 1000;   // ms — starts at 1s
  let stopped  = false;

  function connect() {
    if (stopped) return;

    try {
      ws = new WebSocket(url);
    } catch (e) {
      scheduleRetry();
      return;
    }

    ws.onopen = () => {
      delay = 1000;             // reset backoff on success
      if (onOpen) onOpen(ws);
    };

    ws.onmessage = (event) => {
      if (onMessage) onMessage(event);
    };

    ws.onclose = () => {
      if (onClose) onClose();
      scheduleRetry();
    };

    ws.onerror = () => {
      // onerror is always followed by onclose, so just close
      ws.close();
    };
  }

  function scheduleRetry() {
    if (stopped) return;
    setTimeout(connect, delay);
    delay = Math.min(delay * 1.5, 10000);  // grow delay, cap at 10s
  }

  connect();  // first attempt

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