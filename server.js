import express from 'express';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import ffmpeg from 'fluent-ffmpeg';
import { createCanvas } from 'canvas';

const app = express();
const PORT = process.env.PORT || 10000;
const YT_STREAM_KEY = process.env.YT_STREAM_KEY;

let ffmpegProcess = null;
let currentOverlay = null;

async function generateOverlay() {
  const canvas = createCanvas(1920, 1080);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 1920, 1080);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 100px Arial';
  ctx.fillText('TAKI LIVE 👑', 100, 200);
  ctx.fillText(new Date().toLocaleTimeString(), 100, 400);
  return canvas.toBuffer('image/png');
}

function startFFmpeg() {
  console.log('نشغل FFmpeg...');
  ffmpegProcess = ffmpeg()
    .input('anullsrc').inputFormat('lavfi')
    .input('pipe:0').inputOptions(['-f', 'image2pipe', '-framerate', '1'])
    .outputOptions(['-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-f', 'flv'])
    .output(`rtmp://a.rtmp.youtube.com/live2/${YT_STREAM_KEY}`)
    .on('start', () => console.log('✅ FFmpeg بدأ البث'))
    .on('error', (e) => console.log('❌ خطأ FFmpeg:', e.message))
    .run();

  setInterval(() => {
    if (currentOverlay && ffmpegProcess.stdin.writable) {
      ffmpegProcess.stdin.write(currentOverlay);
    }
  }, 1000);
}

async function main() {
  console.log('السرفر يطلع...');
  const db = new Low(new JSONFile('db.json'), {});
  await db.read();
  db.data ||= {};
  await db.write();

  currentOverlay = await generateOverlay();
  console.log('الصورة جاهزة:', currentOverlay.length);

  startFFmpeg();
  app.listen(PORT, () => console.log(`🚀 شغال على ${PORT}`));
}

main();
