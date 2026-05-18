import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const svg = readFileSync(resolve(root, 'public/icon.svg'));

async function render(size, out, opts = {}) {
  const buf = await sharp(svg, { density: 600 })
    .resize(size, size, { fit: 'contain', background: opts.bg ?? '#1c1917' })
    .png()
    .toBuffer();
  writeFileSync(resolve(root, 'public', out), buf);
  console.log(`wrote ${out} (${size}x${size})`);
}

// Maskable icon needs 80% safe area — wrap by adding padding
async function renderMaskable(size, out) {
  const inner = Math.round(size * 0.7);
  const innerBuf = await sharp(svg, { density: 600 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const composed = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: '#1c1917',
    },
  })
    .composite([{ input: innerBuf, gravity: 'center' }])
    .png()
    .toBuffer();
  writeFileSync(resolve(root, 'public', out), composed);
  console.log(`wrote ${out} (${size}x${size}, maskable)`);
}

await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await renderMaskable(512, 'icon-512-maskable.png');
await render(180, 'apple-touch-icon.png');
await render(32, 'favicon-32.png');
