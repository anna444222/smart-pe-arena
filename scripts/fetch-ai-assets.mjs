import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const aiDir = path.join(rootDir, 'public', 'ai');
const wasmDir = path.join(aiDir, 'wasm');
const mpNodeDir = path.join(rootDir, 'node_modules', '@mediapipe', 'tasks-vision');

fs.mkdirSync(wasmDir, { recursive: true });
fs.copyFileSync(path.join(mpNodeDir, 'vision_bundle.mjs'), path.join(aiDir, 'vision_bundle.mjs'));

for (const file of fs.readdirSync(path.join(mpNodeDir, 'wasm'))) {
  fs.copyFileSync(path.join(mpNodeDir, 'wasm', file), path.join(wasmDir, file));
}

const modelUrl = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const modelDest = path.join(aiDir, 'pose_landmarker_lite.task');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}
await downloadFile(modelUrl, modelDest);
console.log('✅ โหลดไฟล์ AI ทั้งหมดเข้าโฟลเดอร์ public/ai เรียบร้อย!');