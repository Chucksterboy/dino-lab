const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
  let sharp;
  try { sharp = require('sharp'); }
  catch { throw new Error('Icon regeneration requires Sharp. Install it with npm install --no-save sharp, then rerun this script.'); }
  const directory = path.resolve(__dirname, '../src-tauri/icons');
  const svg = await fs.readFile(path.join(directory, 'icon.svg'));
  for (const [size, name] of [[32, '32x32.png'], [128, '128x128.png'], [256, '128x128@2x.png']]) {
    await sharp(svg).resize(size, size).png().toFile(path.join(directory, name));
  }
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const buffers = await Promise.all(sizes.map(size => sharp(svg).resize(size, size).png().toBuffer()));
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  buffers.forEach((buffer, index) => {
    const entry = 6 + index * 16;
    header[entry] = sizes[index] === 256 ? 0 : sizes[index];
    header[entry + 1] = sizes[index] === 256 ? 0 : sizes[index];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(buffer.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += buffer.length;
  });
  await fs.writeFile(path.join(directory, 'icon.ico'), Buffer.concat([header, ...buffers]));
  process.stdout.write('Dino Lab desktop icons generated.\n');
}
main().catch(error => { console.error(error); process.exit(1); });
