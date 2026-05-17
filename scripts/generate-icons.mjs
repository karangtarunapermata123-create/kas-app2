import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><rect width="192" height="192" rx="32" fill="#1e293b"/><text x="96" y="130" font-family="system-ui" font-size="90" text-anchor="middle" fill="white">K</text></svg>';

fs.writeFileSync(path.join(iconsDir, 'icon-192.svg'), svg);
console.log('Icons generated!');