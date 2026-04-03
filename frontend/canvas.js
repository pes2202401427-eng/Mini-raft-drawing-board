// frontend/canvas.js 
// Main file: handles all drawing + sends/receives strokes via WebSocket

// ── Get references to HTML elements ──────────────────────────────
const canvas    = document.getElementById('board');
const ctx       = canvas.getContext('2d');
const colorPick = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');
const statusEl  = document.getElementById('status');
const logEl     = document.getElementById('log');

// ── Set up tools (pen + eraser + undo) ───────────────────────────
// CanvasTools class comes from canvas-tools.js (loaded before this file)
const tools = new CanvasTools(canvas, ctx);

// Pen button click
document.getElementById('btn-pen').addEventListener('click', () => {
  tools.setMode('pen');
  document.getElementById('btn-pen').className    = 'tool-btn active';
  document.getElementById('btn-eraser').className = 'tool-btn inactive';
});

// Eraser button click
document.getElementById('btn-eraser').addEventListener('click', () => {
  tools.setMode('eraser');
  document.getElementById('btn-eraser').className = 'tool-btn active';
  document.getElementById('btn-pen').className    = 'tool-btn inactive';
});

// Ctrl+Z = undo last stroke (local only, doesn't send to server)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    const undone = tools.undo();
    if (undone) addLog('Undo (local only)');
  }
});

// ── Connect to WebSocket (gateway) ───────────────────────────────
// createReconnectingWS comes from reconnect.js (loaded before this file)
const WS_URL = `ws://${location.hostname}:8080`;

const ws = createReconnectingWS(WS_URL, {

  onOpen() {
    statusEl.textContent = 'Connected to RAFT cluster ✅';
    statusEl.className   = 'connected';
    addLog('WebSocket connected to gateway');
  },

  onClose() {
    statusEl.textContent = 'Reconnecting...';
    statusEl.className   = '';
    addLog('Connection lost — retrying automatically...');
  },

  onMessage(event) {
    const data = JSON.parse(event.data);

    if (data.type === 'stroke') {
      // Another user drew something — draw it on our canvas
      drawStroke(data.stroke);

    } else if (data.type === 'full-log') {
        addLog(`Replaying ${data.strokes.length} strokes`);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let i = 0;
        function animate() {
            if (i >= data.strokes.length) return;
            drawStroke(data.strokes[i]);
            i++;
            setTimeout(animate, 20);
        }
        animate();
      }
  },

});

// ── Mouse drawing ─────────────────────────────────────────────────
let drawing = false;
let lastX = 0;
let lastY = 0;

// Get mouse position relative to canvas (not whole page)
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

// When mouse button pressed down — start drawing
canvas.addEventListener('mousedown', (e) => {
  drawing = true;
  tools.saveSnapshot();          // save for undo before stroke begins
  [lastX, lastY] = getPos(e);
});

// When mouse moves — draw a line segment
canvas.addEventListener('mousemove', (e) => {
  if (!drawing) return;

  const [x, y] = getPos(e);

  const stroke = {
    x1: lastX,
    y1: lastY,
    x2: x,
    y2: y,
    color: tools.getStrokeColor(colorPick.value),
    size:  tools.getStrokeSize(parseInt(brushSize.value)),
  };

  drawStroke(stroke);          // draw locally right away (feels instant)
  ws.send(JSON.stringify(stroke)); // send to gateway → leader → all clients

  [lastX, lastY] = [x, y];    // update last position
});

// Stop drawing when mouse released or leaves canvas
canvas.addEventListener('mouseup',    () => { drawing = false; });
canvas.addEventListener('mouseleave', () => { drawing = false; });

// ── Touch drawing (mobile/tablet support) ─────────────────────────
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
    x1: lastX, y1: lastY, x2: x, y2: y,
    color: tools.getStrokeColor(colorPick.value),
    size:  tools.getStrokeSize(parseInt(brushSize.value)),
  };

  drawStroke(stroke);
  ws.send(JSON.stringify(stroke));
  [lastX, lastY] = [x, y];
});

canvas.addEventListener('touchend', () => { drawing = false; });

// ── Actually draw a stroke on the canvas ──────────────────────────
function drawStroke(s) {
  ctx.beginPath();
  ctx.moveTo(s.x1, s.y1);
  ctx.lineTo(s.x2, s.y2);
  ctx.strokeStyle = s.color || '#000000';
  ctx.lineWidth   = s.size  || 3;
  ctx.lineCap     = 'round';   // smooth rounded ends
  ctx.lineJoin    = 'round';   // smooth corners
  ctx.stroke();
}

// ── Clear entire canvas ───────────────────────────────────────────
function clearCanvas() {
  tools.saveSnapshot();  // allow undo of clear too
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  addLog('Canvas cleared');
}

// ── Add a message to the log panel (bottom right) ─────────────────
function addLog(msg) {
  const div = document.createElement('div');
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight; // auto scroll to bottom
}
// ── Replay button ───────────────────────────────────────────
function replayCanvas() {
  addLog("Replay requested");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ws.send(JSON.stringify({ type: "get-full-log" }));
}

// ── Download button ─────────────────────────────────────────
function downloadCanvas() {
  const link = document.createElement('a');
  link.download = 'drawing.png';
  link.href = canvas.toDataURL();
  link.click();

  addLog("Canvas downloaded");
}

function downloadCanvas() {
  const link = document.createElement('a');
  link.download = 'drawing.png';
  link.href = canvas.toDataURL('image/png');
  link.click();

  addLog('Canvas downloaded');
}

// ── Start the dashboard ───────────────────────────────────────────
// initDashboard comes from dashboard.js (loaded before this file)
initDashboard();