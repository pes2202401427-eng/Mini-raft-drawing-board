// frontend/canvas-tools.js — Roopashree
// Manages two things:
// 1. Tool mode: pen or eraser
// 2. Undo history: saves snapshots so Ctrl+Z works

const MAX_UNDO = 50; // remember last 50 actions

class CanvasTools {
  constructor(canvas, ctx) {
    this.canvas  = canvas;
    this.ctx     = ctx;
    this.mode    = 'pen';  // start in pen mode
    this.history = [];     // stores canvas snapshots for undo
  }

  // Call this BEFORE each stroke starts (on mousedown)
  // It saves a photo of the canvas so we can restore it on undo
  saveSnapshot() {
    const snapshot = this.ctx.getImageData(
      0, 0,
      this.canvas.width,
      this.canvas.height
    );
    this.history.push(snapshot);

    // Don't keep more than MAX_UNDO snapshots
    if (this.history.length > MAX_UNDO) {
      this.history.shift(); // remove oldest
    }
  }

  // Called when user presses Ctrl+Z
  undo() {
    if (this.history.length === 0) return false; // nothing to undo
    const previousSnapshot = this.history.pop();
    this.ctx.putImageData(previousSnapshot, 0, 0);
    return true;
  }

  // Switch between pen and eraser
  setMode(mode) {
    this.mode = mode;
    if (mode === 'eraser') {
      this.canvas.classList.add('eraser-mode');    // changes cursor
    } else {
      this.canvas.classList.remove('eraser-mode'); // back to crosshair
    }
  }

  // Eraser draws in white; pen draws in chosen color
  getStrokeColor(pickedColor) {
    return this.mode === 'eraser' ? '#ffffff' : pickedColor;
  }

  // Eraser is automatically bigger so it feels like an eraser
  getStrokeSize(pickedSize) {
    return this.mode === 'eraser' ? Math.max(pickedSize * 3, 18) : pickedSize;
  }
}