// Features: username, colored identity, cursor name labels,
//           animated replay, download, eraser, undo, touch support

// ── DOM references ────────────────────────────────────────────────
const canvas       = document.getElementById('board');
const ctx          = canvas.getContext('2d');
const colorPick    = document.getElementById('colorPicker');
const brushSize    = document.getElementById('brushSize');
const statusEl     = document.getElementById('status');
const logEl        = document.getElementById('log');
const nameModal    = document.getElementById('name-modal');
const nameInput    = document.getElementById('name-input');
const nameBtn      = document.getElementById('name-btn');
const cursorsLayer = document.getElementById('cursors-layer');

// ── User identity ─────────────────────────────────────────────────
let myName  = '';
let myColor = '';

function randomColor() {
  const colors = [
    '#e94560','#3b82f6','#10b981','#f59e0b',
    '#8b5cf6','#ec4899','#06b6d4','#84cc16',
    '#f97316','#6366f1'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function getInitials(name) {
  return name.trim().split(' ')
    .map(w => w[0]).join('')
    .toUpperCase().slice(0, 2);
}

function showUserBadge(name, color) {
  const avatar = document.getElementById('user-avatar');
  const nameDisplay = document.getElementById('user-name-display');
  avatar.style.background = color;
  avatar.textContent = getInitials(name);
  nameDisplay.textContent = name;
  colorPick.value = color;
}

function joinCanvas() {
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.style.borderColor = '#e94560';
    nameInput.placeholder = 'Please enter a name!';
    return;
  }
  myName  = name;
  myColor = randomColor();
  showUserBadge(myName, myColor);
  nameModal.style.display = 'none';

  // ── ADD THESE 3 LINES ──
  // Send join message now (WebSocket already connected by this point)
  ws.send(JSON.stringify({
    type:  'user-join',
    name:  myName,
    color: myColor,
  }));
}

nameBtn.addEventListener('click', joinCanvas);
nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') joinCanvas();
});
nameInput.focus();

// ── Tools ─────────────────────────────────────────────────────────
const tools = new CanvasTools(canvas, ctx);

document.getElementById('btn-pen').addEventListener('click', () => {
  tools.setMode('pen');
  document.getElementById('btn-pen').className    = 'tool-btn active';
  document.getElementById('btn-eraser').className = 'tool-btn inactive';
});

document.getElementById('btn-eraser').addEventListener('click', () => {
  tools.setMode('eraser');
  document.getElementById('btn-eraser').className = 'tool-btn active';
  document.getElementById('btn-pen').className    = 'tool-btn inactive';
});

document.getElementById('btn-clear').addEventListener('click', () => {
  tools.saveSnapshot();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  addLog('Canvas cleared');
});

document.getElementById('btn-undo').addEventListener('click', () => {
  if (tools.undo()) addLog('Undo');
});

document.getElementById('btn-download').addEventListener('click', downloadCanvas);
document.getElementById('btn-replay').addEventListener('click', () => {
  replayStrokes(allStrokes);
});

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    if (tools.undo()) addLog('Undo (Ctrl+Z)');
  }
});

// ── Stroke history ────────────────────────────────────────────────
let allStrokes = [];

// ── WebSocket ─────────────────────────────────────────────────────
const WS_URL = `ws://${location.hostname}:8080`;

const ws = createReconnectingWS(WS_URL, {

  onOpen() {
    statusEl.textContent = '✅ Connected to RAFT cluster';
    statusEl.className   = 'connected';
    addLog('Connected to gateway');

    // Announce ourselves
    if (myName) {
      ws.send(JSON.stringify({
        type:  'user-join',
        name:  myName,
        color: myColor,
      }));
    }
  },

  onClose() {
    statusEl.textContent = '🔄 Reconnecting...';
    statusEl.className   = '';
    addLog('Connection lost — retrying...');
    clearAllCursors();
  },

  onMessage(event) {
    let data;
    try { data = JSON.parse(event.data); }
    catch (_) { return; }

    switch (data.type) {

      case 'stroke':
        drawStroke(data.stroke);
        allStrokes.push(data.stroke);
        // Show name near where they drew
        if (data.stroke.name && data.stroke.name !== myName) {
          showStrokeLabel(
            data.stroke.name,
            data.stroke.color,
            data.stroke.x2,
            data.stroke.y2
          );
        }
        break;

      case 'full-log':
        allStrokes = data.strokes || [];
        addLog(`Got ${allStrokes.length} strokes from log`);
        replayStrokes(allStrokes);
        break;

      case 'users-list':
        updateOnlineUsers(data.users || []);
        break;

      case 'cursor-move':
        showCursorLabel(
          data.id,
          data.name,
          data.color,
          data.x,
          data.y
        );
        break;

      case 'user-leave':
        removeCursor(data.id);
        updateOnlineUsers(data.users || []);
        addLog(`${data.name} left`);
        break;
    }
  },
});

// ── Online users in dashboard ─────────────────────────────────────
function updateOnlineUsers(users) {
  const container = document.getElementById('online-users-list');
  if (!container) return;
  container.innerHTML = '';

  users.forEach(user => {
    const row = document.createElement('div');
    row.className   = 'online-user-row';
    row.style.cssText = `
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 3px 0;
    `;

    const dot = document.createElement('span');
    dot.style.cssText = `
      width: 9px; height: 9px;
      border-radius: 50%;
      background: ${user.color};
      flex-shrink: 0;
      box-shadow: 0 0 5px ${user.color};
    `;

    const name = document.createElement('span');
    name.textContent  = user.name;
    name.style.cssText = `
      font-size: 11px;
      color: #e2e8f0;
      font-family: monospace;
    `;

    // Highlight if it's you
    if (user.name === myName) {
      name.style.color  = user.color;
      name.textContent += ' (you)';
    }

    row.appendChild(dot);
    row.appendChild(name);
    container.appendChild(row);
  });

  // Update count
  const countEl = document.getElementById('dash-online-count');
  if (countEl) countEl.textContent = users.length;
}

// ── Cursor label — shows near moving cursor ───────────────────────
const cursorEls    = {};   // id → DOM element
const cursorTimers = {};   // id → hide timer

function showCursorLabel(id, name, color, x, y) {
  const rect    = canvas.getBoundingClientRect();
  const screenX = rect.left + x;
  const screenY = rect.top  + y;

  // Create element if first time seeing this user
  if (!cursorEls[id]) {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed;
      display: flex;
      align-items: center;
      gap: 5px;
      pointer-events: none;
      z-index: 600;
      transition: left 0.04s linear, top 0.04s linear, opacity 0.3s;
    `;
    el.innerHTML = `
      <div style="
        width: 12px; height: 12px;
        border-radius: 50%;
        background: ${color};
        border: 2px solid white;
        flex-shrink: 0;
      "></div>
      <div style="
        background: ${color};
        color: white;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 8px;
        white-space: nowrap;
        font-family: 'Segoe UI', sans-serif;
      ">${name}</div>
    `;
    document.body.appendChild(el);
    cursorEls[id] = el;
  }

  const el = cursorEls[id];

  // Only show if cursor is inside canvas bounds
  const inBounds = x >= 0 && x <= canvas.width &&
                   y >= 0 && y <= canvas.height;

  el.style.left    = (screenX + 10) + 'px';
  el.style.top     = (screenY - 10) + 'px';
  el.style.opacity = inBounds ? '1' : '0';
  el.style.display = 'flex';

  // Hide after 2 seconds of no movement
  clearTimeout(cursorTimers[id]);
  cursorTimers[id] = setTimeout(() => {
    if (cursorEls[id]) cursorEls[id].style.opacity = '0';
  }, 2000);
}

function removeCursor(id) {
  if (cursorEls[id]) {
    cursorEls[id].remove();
    delete cursorEls[id];
  }
  clearTimeout(cursorTimers[id]);
  delete cursorTimers[id];
}

function clearAllCursors() {
  Object.keys(cursorEls).forEach(id => removeCursor(id));
}

// ── Stroke label — shows name near where someone drew ────────────
// This works even WITHOUT gateway cursor support
const strokeLabels  = {};
const strokeTimers  = {};

function showStrokeLabel(name, color, x, y) {
  const rect    = canvas.getBoundingClientRect();
  const screenX = rect.left + x;
  const screenY = rect.top  + y;

  if (!strokeLabels[name]) {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed;
      background: ${color};
      color: white;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 8px;
      pointer-events: none;
      z-index: 590;
      white-space: nowrap;
      font-family: 'Segoe UI', sans-serif;
      transition: left 0.05s, top 0.05s, opacity 0.4s;
    `;
    document.body.appendChild(el);
    strokeLabels[name] = el;
  }

  const el = strokeLabels[name];
  el.textContent  = name;
  el.style.left   = (screenX + 10) + 'px';
  el.style.top    = (screenY - 22) + 'px';
  el.style.opacity = '1';

  clearTimeout(strokeTimers[name]);
  strokeTimers[name] = setTimeout(() => {
    if (strokeLabels[name]) strokeLabels[name].style.opacity = '0';
  }, 1500);
}

// ── Mouse drawing ─────────────────────────────────────────────────
let drawing = false;
let lastX   = 0;
let lastY   = 0;

// Throttle cursor sends — send every 30ms max not every pixel
let lastCursorSend = 0;

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

canvas.addEventListener('mousedown', e => {
  drawing = true;
  tools.saveSnapshot();
  [lastX, lastY] = getPos(e);
});

canvas.addEventListener('mousemove', e => {
  const [x, y] = getPos(e);
  const now = Date.now();

  // Send cursor position — throttled to every 30ms
  if (myName && now - lastCursorSend > 30) {
    ws.send(JSON.stringify({
      type:  'cursor',
      name:  myName,
      color: myColor,
      x, y,
    }));
    lastCursorSend = now;
  }

  if (!drawing) return;

  const stroke = {
    x1:    lastX,
    y1:    lastY,
    x2:    x,
    y2:    y,
    color: tools.getColor(colorPick.value),
    size:  tools.getSize(parseInt(brushSize.value)),
    name:  myName,
  };

  drawStroke(stroke);
  allStrokes.push(stroke);
  ws.send(JSON.stringify(stroke));
  [lastX, lastY] = [x, y];
});

canvas.addEventListener('mouseup',    () => { drawing = false; });
canvas.addEventListener('mouseleave', () => { drawing = false; });

// ── Touch drawing ─────────────────────────────────────────────────
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  drawing = true;
  tools.saveSnapshot();
  [lastX, lastY] = getPos(e.touches[0]);
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!drawing) return;
  const [x, y] = getPos(e.touches[0]);
  const stroke = {
    x1: lastX, y1: lastY, x2: x, y2: y,
    color: tools.getColor(colorPick.value),
    size:  tools.getSize(parseInt(brushSize.value)),
    name:  myName,
  };
  drawStroke(stroke);
  allStrokes.push(stroke);
  ws.send(JSON.stringify(stroke));
  [lastX, lastY] = [x, y];
}, { passive: false });

canvas.addEventListener('touchend', () => { drawing = false; });

// ── Draw stroke on canvas ─────────────────────────────────────────
function drawStroke(s) {
  ctx.beginPath();
  ctx.moveTo(s.x1, s.y1);
  ctx.lineTo(s.x2, s.y2);
  ctx.strokeStyle = s.color || '#000000';
  ctx.lineWidth   = s.size  || 3;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.stroke();
}

// ── Animated replay ───────────────────────────────────────────────
let replayRunning = false;

async function replayStrokes(strokes) {
  if (replayRunning || !strokes || strokes.length === 0) return;
  replayRunning = true;

  const btn = document.getElementById('btn-replay');
  btn.textContent = '⏸ Replaying...';
  btn.className   = 'tool-btn active';

  tools.saveSnapshot();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  addLog(`Replaying ${strokes.length} strokes...`);

  for (let i = 0; i < strokes.length; i++) {
    drawStroke(strokes[i]);
    await new Promise(r => setTimeout(r, 8));
  }

  addLog('Replay complete ✓');
  btn.textContent = '▶️ Replay';
  btn.className   = 'tool-btn inactive';
  replayRunning   = false;
}

// ── Download as PNG ───────────────────────────────────────────────
function downloadCanvas() {
  const tmp    = document.createElement('canvas');
  tmp.width    = canvas.width;
  tmp.height   = canvas.height;
  const tmpCtx = tmp.getContext('2d');
  tmpCtx.fillStyle = '#ffffff';
  tmpCtx.fillRect(0, 0, tmp.width, tmp.height);
  tmpCtx.drawImage(canvas, 0, 0);

  const link    = document.createElement('a');
  link.download = `miniraft-${Date.now()}.png`;
  link.href     = tmp.toDataURL('image/png');
  link.click();
  addLog('Downloaded as PNG');
}

// ── Log panel ─────────────────────────────────────────────────────
function addLog(msg) {
  const div = document.createElement('div');
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
  while (logEl.children.length > 30) logEl.removeChild(logEl.firstChild);
}

// ── Start dashboard ───────────────────────────────────────────────
initDashboard();