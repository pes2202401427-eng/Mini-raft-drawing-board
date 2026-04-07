// frontend/canvas-tools.js — Roopashree
// Handles: pen/eraser mode switching + undo with snapshot history

const MAX_UNDO = 50;

class CanvasTools {
  constructor(canvas, ctx) {
    this.canvas  = canvas;
    this.ctx     = ctx;
    this.mode    = 'pen';   // 'pen' | 'eraser'
    this.history = [];      // ImageData snapshots for undo
  }

  // Call BEFORE each stroke starts (on mousedown/touchstart)
  // Takes a photo of the current canvas state
  saveSnapshot() {
    const snap = this.ctx.getImageData(
      0, 0,
      this.canvas.width,
      this.canvas.height
    );
    this.history.push(snap);
    if (this.history.length > MAX_UNDO) {
      this.history.shift();  // remove oldest to save memory
    }
  }

  // Called on Ctrl+Z — restores last saved snapshot
  undo() {
    if (this.history.length === 0) return false;
    const prev = this.history.pop();
    this.ctx.putImageData(prev, 0, 0);
    return true;
  }

  // Switch tool mode and update canvas cursor
  setMode(mode) {
    this.mode = mode;
    if (mode === 'eraser') {
      this.canvas.classList.add('eraser-mode');
    } else {
      this.canvas.classList.remove('eraser-mode');
    }
  }

  // Returns the actual color to use based on current mode
  getColor(pickedColor) {
    return this.mode === 'eraser' ? '#ffffff' : pickedColor;
  }

  // Returns the actual size to use — eraser is bigger
  getSize(pickedSize) {
    return this.mode === 'eraser' ? Math.max(pickedSize * 3, 18) : pickedSize;
  }
}