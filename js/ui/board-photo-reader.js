// Reads the tiles from a photo of the board, entirely on this device: the photo is never uploaded or stored.
// The person drags a hexagon outline over the board and adjusts its size, rotation and tilt until it lines up,
// then the colour of each tile is measured and js/domain/board-photo.js decides which terrain it is.
import { GEOMETRY, HEX_COUNT } from '../domain/board.js';
import { classifyTiles } from '../domain/board-photo.js';
import { h, svg } from './dom.js';
import { icon } from './icons.js';
import { openDrawer, toast } from './feedback.js';

const MAX_SIDE = 1100;
// Below this confidence a tile is outlined for the person to check.
export const UNSURE_BELOW = 0.22;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That picture could not be opened.')); };
    image.src = url;
  });
}

/** Where a point on the board (in board units) lands on the photo, for the current alignment. */
function toPhoto(point, fit) {
  const dx = (point.x - GEOMETRY.width / 2) * fit.scale;
  const dy = (point.y - GEOMETRY.height / 2) * fit.scale;
  const angle = (fit.rotation * Math.PI) / 180;
  const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
  const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
  // Tilt squashes the board vertically, as it looks when photographed at an angle.
  return { x: fit.x + rx, y: fit.y + ry * fit.tilt };
}

/** The middle colour of a ring around each tile's centre, between the number token and the tile's edge. */
function measureTiles(context, fit) {
  const { width, height } = context.canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  return GEOMETRY.hexes.map((hex) => {
    const reds = []; const greens = []; const blues = [];
    for (const radius of [0.5, 0.6, 0.7, 0.78]) {
      for (let step = 0; step < 36; step += 1) {
        const angle = (step / 36) * Math.PI * 2;
        const point = toPhoto({ x: hex.x + radius * Math.cos(angle), y: hex.y + radius * Math.sin(angle) }, fit);
        const px = Math.round(point.x);
        const py = Math.round(point.y);
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const offset = (py * width + px) * 4;
        reds.push(pixels[offset]); greens.push(pixels[offset + 1]); blues.push(pixels[offset + 2]);
      }
    }
    // The median ignores the odd road, settlement or shadow better than the average would.
    const median = (values) => {
      if (!values.length) return 128;
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };
    return { r: median(reds), g: median(greens), b: median(blues) };
  });
}

/** Opens the photo reader. onRead({ tiles, unsure }) receives the tiles and the indexes worth checking. */
export function openPhotoReader({ onRead }) {
  openDrawer('Read the tiles from a photo', (close) => {
    const fit = { x: 0, y: 0, scale: 1, rotation: 0, tilt: 1 };
    const canvas = h('canvas', { class: 'photo-canvas' });
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const overlay = svg('svg', { class: 'photo-overlay', 'aria-hidden': 'true' });
    const stage = h('div', { class: 'photo-stage', hidden: true }, canvas, overlay);
    const controls = h('div', { class: 'photo-controls', hidden: true });
    const readButton = h('button', { class: 'btn primary block', type: 'button', hidden: true }, 'Read the tiles');

    function drawOverlay() {
      const { width, height } = canvas;
      overlay.setAttribute('viewBox', `0 0 ${width} ${height}`);
      overlay.replaceChildren(...GEOMETRY.hexes.map((hex) => svg('polygon', {
        class: 'photo-hex',
        points: hex.corners.map((corner) => { const p = toPhoto(corner, fit); return `${p.x},${p.y}`; }).join(' '),
      })), ...GEOMETRY.hexes.map((hex) => {
        const p = toPhoto(hex, fit);
        return svg('circle', { class: 'photo-dot', cx: p.x, cy: p.y, r: Math.max(3, fit.scale * 0.06) });
      }));
    }

    const slider = (label, key, min, max, step) => {
      const input = h('input', {
        type: 'range', min, max, step, value: fit[key], 'aria-label': label,
        onInput: (event) => { fit[key] = Number(event.target.value); drawOverlay(); },
      });
      return { input, row: h('label', { class: 'photo-slider' }, h('span', null, label), input) };
    };

    async function usePhoto(file) {
      try {
        const image = await loadImage(file);
        const shrink = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.round(image.naturalWidth * shrink);
        canvas.height = Math.round(image.naturalHeight * shrink);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      } catch (error) {
        toast(error.message, 'warn');
        return;
      }
      // Start with the outline in the middle, filling most of the photo.
      Object.assign(fit, {
        x: canvas.width / 2,
        y: canvas.height / 2,
        scale: Math.min(canvas.width / GEOMETRY.width, canvas.height / GEOMETRY.height) * 0.8,
        rotation: 0,
        tilt: 1,
      });
      const size = slider('Size', 'scale', Math.round(fit.scale * 0.3), Math.round(fit.scale * 2), 1);
      const rotation = slider('Rotate', 'rotation', -30, 30, 0.5);
      const tilt = slider('Tilt', 'tilt', 0.4, 1, 0.01);
      size.input.value = fit.scale;
      controls.replaceChildren(
        h('p', { class: 'field-hint' }, 'Drag the outline onto the board, then adjust it until each hexagon sits on a tile. The dots should land on the number tokens.'),
        size.row, rotation.row, tilt.row);
      stage.hidden = false;
      controls.hidden = false;
      readButton.hidden = false;
      drawOverlay();
    }

    // Dragging moves the outline. Pointer positions are converted to the photo's own pixels.
    let dragFrom = null;
    const photoPoint = (event) => {
      const box = canvas.getBoundingClientRect();
      return { x: ((event.clientX - box.left) / box.width) * canvas.width, y: ((event.clientY - box.top) / box.height) * canvas.height };
    };
    stage.addEventListener('pointerdown', (event) => {
      dragFrom = { pointer: photoPoint(event), x: fit.x, y: fit.y };
      stage.setPointerCapture(event.pointerId);
    });
    stage.addEventListener('pointermove', (event) => {
      if (!dragFrom) return;
      const now = photoPoint(event);
      fit.x = dragFrom.x + now.x - dragFrom.pointer.x;
      fit.y = dragFrom.y + now.y - dragFrom.pointer.y;
      drawOverlay();
    });
    const endDrag = () => { dragFrom = null; };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    readButton.addEventListener('click', () => {
      const result = classifyTiles(measureTiles(context, fit));
      const unsure = result.confidence.map((value, index) => (value < UNSURE_BELOW ? index : -1)).filter((index) => index >= 0);
      onRead({ tiles: result.tiles, unsure });
      close();
    });

    const fileInput = h('input', {
      type: 'file', accept: 'image/*', class: 'visually-hidden', 'aria-label': 'Choose a photo of the board',
      onChange: (event) => { if (event.target.files[0]) usePhoto(event.target.files[0]); },
    });
    return h('div', { class: 'photo-reader' },
      h('p', { class: 'prose' }, 'Take a photo from above, with the whole board in view. The photo stays on this device: only the tiles it finds are kept.'),
      h('label', { class: 'btn block' }, fileInput, icon('camera'), 'Take or choose a photo'),
      stage,
      controls,
      readButton,
      h('p', { class: 'field-hint' }, `It works out all ${HEX_COUNT} tiles. Number tokens and settlements are quicker to tap in by hand.`));
  });
}
