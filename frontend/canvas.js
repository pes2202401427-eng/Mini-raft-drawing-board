// frontend/canvas.js
// Main file: handles drawing + sends/receives strokes via WebSocket

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const colorPick = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');

const tools = new CanvasTools(canvas, ctx);

document.getElementById('btn-pen').addEventListener('click', () => {
  tools.setMode('pen');
  document.getElementById('btn-pen').className = 'tool-btn active';
  document.getElementById('btn-eraser').className = 'tool-btn inactive';
});

document.getElementById('btn-eraser').addEventListener('click', () => {
  tools.setMode('eraser');
  document.getElementById('btn-eraser').className = 'tool-btn active';
  document.getElementById('btn-pen').className = 'tool-btn inactive';
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    const undone = tools.undo();
    if (undone) addLog('Undo (local only)');
  }
});

  const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;const ws = createReconnectingWS(WS_URL, {
  onOpen() {
    statusEl.textContent = 'Connected to RAFT cluster';
    statusEl.className = 'connected';
    addLog('WebSocket connected to gateway');
  },

  onClose() {
    statusEl.textContent = 'Reconnecting...';
    statusEl.className = '';
    addLog('Connection lost - retrying automatically...');
  },

  onMessage(event) {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      addLog('Ignored invalid WebSocket payload');
      return;
    }

    if (data.type === 'stroke' && data.stroke) {
      if (data.stroke._clientId && data.stroke._clientId === clientId) {
        return;
      }
      drawStroke(data.stroke);
      return;
    }

    if (data.type === 'full-log' && Array.isArray(data.strokes)) {
      addLog(`Replaying ${data.strokes.length} committed strokes`);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let i = 0;
      function animate() {
        if (i >= data.strokes.length) return;
        drawStroke(data.strokes[i]);
        i += 1;
        setTimeout(animate, 12);
      }
      animate();
    }
  },
});

let drawing = false;
let lastX = 0;
let lastY = 0;
const clientId = `c-${Math.random().toString(36).slice(2, 10)}`;

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

function sendStroke(stroke) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'stroke',
      stroke: { ...stroke, _clientId: clientId }
    }));
  }
}

canvas.addEventListener('mousedown', (e) => {
  drawing = true;
  tools.saveSnapshot();
  [lastX, lastY] = getPos(e);
});

canvas.addEventListener('mousemove', (e) => {
  if (!drawing) return;

  const [x, y] = getPos(e);
  const stroke = {
    x1: lastX,
    y1: lastY,
    x2: x,
    y2: y,
    color: tools.getStrokeColor(colorPick.value),
    size: tools.getStrokeSize(parseInt(brushSize.value, 10)),
  };

  drawStroke(stroke);
  sendStroke(stroke);
  [lastX, lastY] = [x, y];
});

canvas.addEventListener('mouseup', () => {
  drawing = false;
});
canvas.addEventListener('mouseleave', () => {
  drawing = false;
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  drawing = true;
  tools.saveSnapshot();
  [lastX, lastY] = getPos(e.touches[0]);
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!drawing) return;

  const [x, y] = getPos(e.touches[0]);
  const stroke = {
    x1: lastX,
    y1: lastY,
    x2: x,
    y2: y,
    color: tools.getStrokeColor(colorPick.value),
    size: tools.getStrokeSize(parseInt(brushSize.value, 10)),
  };

  drawStroke(stroke);
  sendStroke(stroke);
  [lastX, lastY] = [x, y];
});

canvas.addEventListener('touchend', () => {
  drawing = false;
});

function drawStroke(s) {
  ctx.beginPath();
  ctx.moveTo(s.x1, s.y1);
  ctx.lineTo(s.x2, s.y2);
  ctx.strokeStyle = s.color || '#000000';
  ctx.lineWidth = s.size || 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function clearCanvas() {
  tools.saveSnapshot();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  addLog('Canvas cleared (local only)');
}

function addLog(msg) {
  const div = document.createElement('div');
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

function replayCanvas() {
  addLog('Replay requested');
  ws.send(JSON.stringify({ type: 'get-full-log' }));
}

function downloadCanvas() {
  const link = document.createElement('a');
  link.download = 'drawing.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  addLog('Canvas downloaded');
}

initDashboard();
