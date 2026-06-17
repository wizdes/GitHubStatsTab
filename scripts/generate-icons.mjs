// Generate the extension icons (16/48/128) as a small contribution-heatmap
// motif — dark background with a grid of green cells. Dependency-free PNG
// encoder (RGBA, no compression filters). Run: npm run icons

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const LEVEL_COLORS = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
const BG = '#0d1117';
// Fixed (deterministic) level pattern so icons are reproducible.
const PATTERN = [1, 3, 2, 4, 2, 1, 0, 3, 2, 4, 1, 2, 3, 1, 4, 2, 0, 3, 1, 2, 4, 2, 3, 1];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const CRC = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function png(size) {
  const gridN = size <= 16 ? 4 : size <= 48 ? 6 : 8;
  const margin = Math.round(size * 0.08);
  const gap = Math.max(1, Math.round(size * 0.035));
  const cell = (size - 2 * margin - (gridN - 1) * gap) / gridN;
  const bg = hexToRgb(BG);

  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    px[i * 4] = bg[0];
    px[i * 4 + 1] = bg[1];
    px[i * 4 + 2] = bg[2];
    px[i * 4 + 3] = 255;
  }

  let p = 0;
  for (let cx = 0; cx < gridN; cx++) {
    for (let cy = 0; cy < gridN; cy++) {
      const [r, g, b] = hexToRgb(LEVEL_COLORS[PATTERN[p++ % PATTERN.length]]);
      const x0 = Math.round(margin + cx * (cell + gap));
      const y0 = Math.round(margin + cy * (cell + gap));
      const x1 = Math.round(x0 + cell);
      const y1 = Math.round(y0 + cell);
      for (let y = y0; y < y1 && y < size; y++) {
        for (let x = x0; x < x1 && x < size; x++) {
          const o = (y * size + x) * 4;
          px[o] = r;
          px[o + 1] = g;
          px[o + 2] = b;
          px[o + 3] = 255;
        }
      }
    }
  }

  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    px.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(out, { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(join(out, `icon-${size}.png`), png(size));
  console.log(`wrote icons/icon-${size}.png`);
}
