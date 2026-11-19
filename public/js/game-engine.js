import { audio } from './audio-engine.js';
import { AITracker } from './ai-tracker.js';

export class GameEngine {
  constructor(aiTracker, onFinishCallback) {
    this.ai = aiTracker; this.onFinish = onFinishCallback;
    this.rafId = null; this.timerInterval = null; this.running = false;
  }
  start(config, videoEl, canvasEl, hudRefs) {
    this.config = config; this.video = videoEl; this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d'); this.hud = hudRefs;
    this.score = 0; this.hits = 0; this.misses = 0; this.timeLeft = Number(config.duration);
    this.difficulty = config.difficulty; this.reactionTimes = []; this.hitTimestamps = [];
    this.streak = 0; this.target = null; this.hoverStartTime = null;
    this.targetSpawnTime = performance.now(); this.fitnessTask = null;
    this.fitnessHoldStart = null; this.cooldownUntil = 0; this.running = true;

    this.spawnNextObjective();
    this.updateHUD();
    this.timerInterval = setInterval(() => {
      if (!this.running) return;
      this.timeLeft--;
      if (this.timeLeft <= 5 && this.timeLeft > 0) audio.playCountdown();
      this.updateHUD();
      if (this.timeLeft <= 0) this.stop(true);
    }, 1000);
    this.loop();
  }
  stop(completed = false) {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (completed) {
      const totalAttempts = this.hits + this.misses;
      const accuracy = totalAttempts > 0 ? ((this.hits / totalAttempts) * 100).toFixed(1) : 100;
      const avgReactionMs = this.reactionTimes.length > 0 ? Math.round(this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length) : 0;
      this.onFinish({
        mode: this.config.mode, difficulty: this.difficulty, durationSec: this.config.duration,
        score: this.score, hits: this.hits, misses: this.misses, accuracy: Number(accuracy),
        avgReactionMs, hitTimestamps: this.hitTimestamps
      });
    }
  }
  getDifficultyParams() {
    if (this.difficulty === 'Beginner') return { radius: 0.085, timeoutMs: 5500 };
    if (this.difficulty === 'Intermediate') return { radius: 0.065, timeoutMs: 4000 };
    return { radius: 0.05, timeoutMs: 2800 };
  }
  spawnNextObjective() {
    const now = performance.now();
    this.targetSpawnTime = now; this.hoverStartTime = null;
    const params = this.getDifficultyParams();
    if (this.config.mode === 'HAND') {
      const isLeft = Math.random() < 0.5;
      this.target = {
        type: isLeft ? 'LEFT_HAND' : 'RIGHT_HAND', label: isLeft ? 'มือซ้าย' : 'มือขวา',
        color: isLeft ? '#00E5FF' : '#FF4081',
        x: isLeft ? 0.15 + Math.random() * 0.25 : 0.60 + Math.random() * 0.25,
        y: 0.20 + Math.random() * 0.45, r: params.radius, expiresAt: now + params.timeoutMs
      };
      this.hud.banner.textContent = 'แตะเป้าสี' + (isLeft ? 'ฟ้าด้วยมือซ้าย' : 'ชมพูด้วยมือขวา') + '!';
    } else if (this.config.mode === 'FOOT') {
      const baseY = (this.config.footHeightPct || 82) / 100;
      this.target = {
        type: 'ANY_FOOT', label: 'เท้าแตะ', color: '#00E676',
        x: 0.20 + Math.random() * 0.60, y: Math.min(0.92, Math.max(0.65, baseY + (Math.random() * 0.06 - 0.03))),
        r: params.radius * 1.15, expiresAt: now + params.timeoutMs
      };
      this.hud.banner.textContent = 'เคลื่อนข้อเท้าแตะเป้าหมายด้านล่าง!';
    } else if (this.config.mode === 'REACTION') {
      this.target = {
        type: 'ANY_HAND', label: 'แตะด่วน!', color: '#FFD740',
        x: 0.15 + Math.random() * 0.70, y: 0.18 + Math.random() * 0.50,
        r: params.radius, expiresAt: now + params.timeoutMs
      };
      this.hud.banner.textContent = '⚡ แตะเป้าหมายให้เร็วที่สุด!';
    } else if (this.config.mode === 'FITNESS') {
      const tasks = [
        { id: 'RAISE_ARMS', text: '🙌 ยกแขนทั้งสองข้างขึ้นเหนือศีรษะ!' },
        { id: 'T_POSE', text: '🦅 กางแขนออกด้านข้างให้ตรง!' },
        { id: 'SQUAT', text: '🏋️ ย่อเข่าลงเล็กน้อย (Squat)!' },
        { id: 'BALANCE', text: '🦩 ยกเท้าหนึ่งข้างยืนทรงตัว!' }
      ];
      this.fitnessTask = tasks[Math.floor(Math.random() * tasks.length)];
      this.fitnessHoldStart = null;
      this.hud.banner.textContent = this.fitnessTask.text;
      audio.speakThai(this.fitnessTask.text);
    }
  }
  handleSuccess(reactionMs) {
    const now = performance.now();
    this.cooldownUntil = now + 350; this.hits++; this.streak++; this.score += 10;
    this.hitTimestamps.push(Math.round(now));
    if (reactionMs) this.reactionTimes.push(Math.round(reactionMs));
    audio.playSuccess();
    if (this.config.autoAdaptive) {
      if (this.streak >= 5 && this.difficulty === 'Beginner') { this.difficulty = 'Intermediate'; this.streak = 0; }
      else if (this.streak >= 6 && this.difficulty === 'Intermediate') { this.difficulty = 'Advanced'; this.streak = 0; }
    }
    this.updateHUD(); this.spawnNextObjective();
  }
  handleMiss() {
    this.misses++; this.streak = 0; audio.playMiss();
    if (this.config.autoAdaptive) {
      if (this.misses % 3 === 0 && this.difficulty === 'Advanced') this.difficulty = 'Intermediate';
      else if (this.misses % 3 === 0 && this.difficulty === 'Intermediate') this.difficulty = 'Beginner';
    }
    this.updateHUD(); this.spawnNextObjective();
  }
  updateHUD() {
    const total = this.hits + this.misses;
    const acc = total > 0 ? Math.round((this.hits / total) * 100) : 100;
    this.hud.score.textContent = this.score; this.hud.timer.textContent = this.timeLeft;
    this.hud.diff.textContent = this.difficulty; this.hud.acc.textContent = acc + '%';
  }
  loop() {
    if (!this.running) return;
    const w = (this.canvas.width = this.video.videoWidth || 640);
    const h = (this.canvas.height = this.video.videoHeight || 480);
    this.ctx.save(); this.ctx.scale(-1, 1); this.ctx.drawImage(this.video, -w, 0, w, h); this.ctx.restore();
    const pose = this.ai.detect(this.video);
    const now = performance.now();
    if (!pose) {
      this.ctx.fillStyle = 'rgba(255, 82, 82, 0.85)'; this.ctx.fillRect(0, h - 45, w, 45);
      this.ctx.fillStyle = '#FFF'; this.ctx.font = 'bold 18px sans-serif'; this.ctx.textAlign = 'center';
      this.ctx.fillText('⚠️ ไม่พบร่างกายในกล้อง กรุณาถอยหลังให้อยู่ในกรอบ', w / 2, h - 16);
    } else {
      this.drawSkeletonPoints(pose, w, h);
      if (now >= this.cooldownUntil) {
        if (this.config.mode === 'FITNESS') this.evaluateFitness(pose, now, w, h);
        else if (this.target) this.evaluateTarget(pose, now, w, h);
      }
    }
    this.rafId = requestAnimationFrame(() => this.loop());
  }
  drawSkeletonPoints(pose, w, h) {
    [{ pt: pose.leftWrist, color: '#00E5FF' }, { pt: pose.rightWrist, color: '#FF4081' }, { pt: pose.leftAnkle, color: '#00E676' }, { pt: pose.rightAnkle, color: '#00E676' }]
      .forEach((item) => {
        if (item.pt.v > 0.5) {
          this.ctx.beginPath(); this.ctx.arc(item.pt.x * w, item.pt.y * h, 12, 0, Math.PI * 2);
          this.ctx.fillStyle = item.color; this.ctx.fill();
          this.ctx.lineWidth = 3; this.ctx.strokeStyle = '#FFF'; this.ctx.stroke();
        }
      });
  }
  evaluateTarget(pose, now, w, h) {
    if (now > this.target.expiresAt) { this.handleMiss(); return; }
    const tx = this.target.x * w, ty = this.target.y * h, tr = this.target.r * w;
    this.ctx.beginPath(); this.ctx.arc(tx, ty, tr, 0, Math.PI * 2);
    this.ctx.fillStyle = this.target.color + '44'; this.ctx.fill();
    this.ctx.lineWidth = 5; this.ctx.strokeStyle = this.target.color; this.ctx.stroke();
    this.ctx.fillStyle = '#FFF'; this.ctx.font = 'bold 16px sans-serif'; this.ctx.textAlign = 'center';
    this.ctx.fillText(this.target.label, tx, ty + 6);

    let activePoints = [];
    if (this.target.type === 'LEFT_HAND') activePoints = [pose.leftWrist];
    else if (this.target.type === 'RIGHT_HAND') activePoints = [pose.rightWrist];
    else if (this.target.type === 'ANY_HAND') activePoints = [pose.leftWrist, pose.rightWrist];
    else if (this.target.type === 'ANY_FOOT') activePoints = [pose.leftAnkle, pose.rightAnkle];

    let isTouching = activePoints.some((pt) => pt.v > 0.5 && Math.hypot(pt.x * w - tx, pt.y * h - ty) <= tr + 15);
    if (isTouching) {
      if (this.config.mode === 'REACTION') { this.handleSuccess(now - this.targetSpawnTime); return; }
      if (!this.hoverStartTime) this.hoverStartTime = now;
      const heldMs = now - this.hoverStartTime;
      this.ctx.beginPath();
      this.ctx.arc(tx, ty, tr + 8, -Math.PI / 2, -Math.PI / 2 + Math.min(1, heldMs / 250) * Math.PI * 2);
      this.ctx.lineWidth = 6; this.ctx.strokeStyle = '#00E676'; this.ctx.stroke();
      if (heldMs >= 250) this.handleSuccess(now - this.targetSpawnTime);
    } else {
      this.hoverStartTime = null;
    }
  }
  evaluateFitness(pose, now, w, h) {
    let matched = false;
    const { leftWrist, rightWrist, leftShoulder, rightShoulder, leftHip, leftKnee, leftAnkle, rightAnkle } = pose;
    if (this.fitnessTask.id === 'RAISE_ARMS') matched = leftWrist.v > 0.5 && rightWrist.v > 0.5 && leftWrist.y < leftShoulder.y - 0.12 && rightWrist.y < rightShoulder.y - 0.12;
    else if (this.fitnessTask.id === 'T_POSE') {
      const la = AITracker.calculateAngle(leftHip, leftShoulder, leftWrist);
      const ra = AITracker.calculateAngle(pose.rightHip, rightShoulder, rightWrist);
      matched = la > 70 && la < 115 && ra > 70 && ra < 115;
    } else if (this.fitnessTask.id === 'SQUAT') matched = leftKnee.v > 0.5 && AITracker.calculateAngle(leftHip, leftKnee, leftAnkle) < 145;
    else if (this.fitnessTask.id === 'BALANCE') matched = leftAnkle.v > 0.5 && rightAnkle.v > 0.5 && Math.abs(leftAnkle.y - rightAnkle.y) > 0.08;

    if (matched) {
      if (!this.fitnessHoldStart) this.fitnessHoldStart = now;
      const held = now - this.fitnessHoldStart;
      this.ctx.fillStyle = 'rgba(0, 230, 118, 0.3)';
      this.ctx.fillRect(0, 0, (w * Math.min(100, Math.round((held / 1000) * 100))) / 100, 20);
      if (held >= 1000) this.handleSuccess(1000);
    } else {
      this.fitnessHoldStart = null;
    }
  }
}