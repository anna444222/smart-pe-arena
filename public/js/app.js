import { AITracker } from './ai-tracker.js';
import { GameEngine } from './game-engine.js';
import { ApiClient } from './api-client.js';
import { audio } from './audio-engine.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

let playerId = localStorage.getItem('smart_pe_player_id');
if (!playerId) {
  playerId = 'STU-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  localStorage.setItem('smart_pe_player_id', playerId);
}
document.getElementById('player-id-display').textContent = 'รหัสประจำตัวผู้เล่นอัตโนมัติ: ' + playerId;

const state = { nickname: '', gradeLevel: 'P4', roomCode: 'GLOBAL', mode: 'HAND', lastResult: null, teacherPwd: '' };
const aiTracker = new AITracker();
const gameEngine = new GameEngine(aiTracker, handleGameFinished);
let setupLoopId = null;

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function updateStatusPills(camOk, aiOk) {
  const pCam = document.getElementById('pill-camera'), pAi = document.getElementById('pill-ai');
  pCam.className = camOk ? 'pill pill-on' : 'pill pill-off';
  pCam.textContent = camOk ? '📷 กล้อง: พร้อม' : '📷 กล้อง: ปิด';
  pAi.className = aiOk ? 'pill pill-on' : 'pill pill-off';
  pAi.textContent = aiOk ? '🧠 AI: พร้อม' : '🧠 AI: รอโหลด';
}

document.getElementById('btn-start-lobby').addEventListener('click', () => {
  const nick = document.getElementById('input-nickname').value.trim();
  if (!nick) { alert('กรุณากรอกชื่อเล่นก่อนเข้าเล่นครับ'); return; }
  audio.init();
  state.nickname = nick;
  state.gradeLevel = document.getElementById('select-grade').value;
  state.roomCode = document.getElementById('input-room').value.trim().toUpperCase() || 'GLOBAL';
  document.getElementById('lobby-player-info').textContent = 'ผู้เล่น: ' + state.nickname + ' (' + playerId + ') | ชั้น ' + state.gradeLevel + ' | ห้อง: ' + state.roomCode;
  showScreen('screen-lobby');
});

document.querySelectorAll('.mode-card').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.mode-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected'); state.mode = card.dataset.mode;
  });
});

document.getElementById('btn-back-welcome').addEventListener('click', () => showScreen('screen-welcome'));
document.getElementById('btn-go-camera').addEventListener('click', () => { showScreen('screen-setup'); runCameraAndAISetup(); });
document.getElementById('range-foot-height').addEventListener('input', (e) => { document.getElementById('foot-height-val').textContent = e.target.value + '% จากด้านบน'; });

async function runCameraAndAISetup() {
  const errBox = document.getElementById('error-box'), btnRetry = document.getElementById('btn-retry-setup'), btnStart = document.getElementById('btn-start-game');
  errBox.classList.add('hidden'); btnRetry.classList.add('hidden'); btnStart.disabled = true;
  const stepCam = document.getElementById('chk-step-cam'), stepAi = document.getElementById('chk-step-ai'), stepBody = document.getElementById('chk-step-body');
  const overlayMsg = document.getElementById('setup-overlay-msg'), videoEl = document.getElementById('setup-video'), canvasEl = document.getElementById('setup-canvas');
  const ctx = canvasEl.getContext('2d');

  try {
    stepCam.textContent = '⏳ 1. กำลังขออนุญาตเปิดกล้อง...';
    await aiTracker.startCamera(videoEl);
    stepCam.textContent = '✅ 1. กล้องเปิดใช้งานสำเร็จ';
    updateStatusPills(true, aiTracker.isLoaded);

    stepAi.textContent = '⏳ 2. กำลังโหลดโมเดล AI จากในเครื่อง...';
    await aiTracker.initAI();
    stepAi.textContent = '✅ 2. โหลด AI Pose Landmarker สำเร็จ';
    updateStatusPills(true, true);

    stepBody.textContent = '⏳ 3. กรุณายืนหน้ากล้องให้เห็นร่างกาย...';
    overlayMsg.textContent = 'ถอยหลัง 1.5 - 2 เมตร ให้เห็นแขนและลำตัวชัดเจน';

    let bodyDetectedCount = 0;
    const previewLoop = () => {
      if (!document.getElementById('screen-setup').classList.contains('active')) return;
      const w = (canvasEl.width = videoEl.videoWidth || 640), h = (canvasEl.height = videoEl.videoHeight || 480);
      ctx.save(); ctx.scale(-1, 1); ctx.drawImage(videoEl, -w, 0, w, h); ctx.restore();
      const footY = (Number(document.getElementById('range-foot-height').value) / 100) * h;
      ctx.strokeStyle = '#00E676'; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(0, footY); ctx.lineTo(w, footY); ctx.stroke(); ctx.setLineDash([]);

      const pose = aiTracker.detect(videoEl);
      if (pose) {
        bodyDetectedCount++;
        [pose.leftWrist, pose.rightWrist, pose.leftAnkle, pose.rightAnkle].forEach((pt) => {
          if (pt.v > 0.5) { ctx.beginPath(); ctx.arc(pt.x * w, pt.y * h, 10, 0, Math.PI * 2); ctx.fillStyle = '#00E5FF'; ctx.fill(); }
        });
        if (bodyDetectedCount >= 10) {
          stepBody.textContent = '✅ 3. ตรวจพบร่างกายพร้อมเล่น!';
          overlayMsg.textContent = 'พร้อมแล้ว! กดปุ่ม "เริ่มเล่นเกมทันที" ได้เลย';
          btnStart.disabled = false;
        }
      }
      setupLoopId = requestAnimationFrame(previewLoop);
    };
    previewLoop();
  } catch (err) {
    errBox.classList.remove('hidden'); btnRetry.classList.remove('hidden');
    document.getElementById('error-title').textContent = err.title || 'เกิดข้อผิดพลาด';
    document.getElementById('error-desc').textContent = err.desc || 'ไม่สามารถเริ่มต้นระบบได้';
    document.getElementById('error-tech').textContent = err.tech || '';
  }
}

document.getElementById('btn-retry-setup').addEventListener('click', runCameraAndAISetup);
document.getElementById('btn-back-lobby').addEventListener('click', () => { if (setupLoopId) cancelAnimationFrame(setupLoopId); showScreen('screen-lobby'); });

document.getElementById('btn-start-game').addEventListener('click', async () => {
  if (setupLoopId) cancelAnimationFrame(setupLoopId);
  showScreen('screen-game');
  const gameVideo = document.getElementById('game-video');
  await aiTracker.attachStream(gameVideo);
  gameEngine.start({
    mode: state.mode, difficulty: document.getElementById('select-difficulty').value,
    duration: Number(document.getElementById('select-duration').value),
    autoAdaptive: document.getElementById('chk-auto-adaptive').checked,
    footHeightPct: Number(document.getElementById('range-foot-height').value)
  }, gameVideo, document.getElementById('game-canvas'), {
    score: document.getElementById('hud-score'), timer: document.getElementById('hud-timer'),
    diff: document.getElementById('hud-diff'), acc: document.getElementById('hud-acc'),
    banner: document.getElementById('game-instruction-banner')
  });
});

document.getElementById('btn-quit-game').addEventListener('click', () => { gameEngine.stop(false); showScreen('screen-lobby'); });

async function handleGameFinished(result) {
  state.lastResult = result;
  showScreen('screen-result');
  document.getElementById('result-player-summary').textContent = state.nickname + ' (' + playerId + ') | โหมด: ' + result.mode + ' | ระดับ: ' + result.difficulty;
  document.getElementById('res-score').textContent = result.score;
  document.getElementById('res-hits').textContent = result.hits + ' / ' + result.misses;
  document.getElementById('res-acc').textContent = result.accuracy + '%';
  document.getElementById('res-react').textContent = result.avgReactionMs + ' ms';

  const syncBanner = document.getElementById('sync-status-banner');
  syncBanner.textContent = '⏳ กำลังบันทึกคะแนนขึ้นตารางอันดับออนไลน์...';
  try {
    const sessionToken = playerId + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    await ApiClient.submitScore({
      sessionToken, playerId, nickname: state.nickname || 'ผู้เล่นทั่วไป',
      gradeLevel: state.gradeLevel, roomCode: state.roomCode, gameMode: result.mode,
      difficulty: result.difficulty, durationSec: result.durationSec, score: result.score,
      hits: result.hits, misses: result.misses, accuracy: result.accuracy,
      avgReactionMs: result.avgReactionMs, hitTimestamps: result.hitTimestamps
    });
    syncBanner.textContent = '✅ บันทึกคะแนนขึ้นตารางอันดับออนไลน์เรียบร้อยแล้ว!';
  } catch (err) {
    syncBanner.textContent = '⚠️ บันทึกออนไลน์ไม่สำเร็จ (' + err.message + ') แต่ส่งออก CSV ได้';
  }
}

document.getElementById('btn-play-again').addEventListener('click', () => { showScreen('screen-setup'); runCameraAndAISetup(); });
document.getElementById('btn-result-home').addEventListener('click', () => { aiTracker.stopCamera(); updateStatusPills(false, aiTracker.isLoaded); showScreen('screen-welcome'); });

document.getElementById('btn-export-single-csv').addEventListener('click', () => {
  if (!state.lastResult) return;
  const r = state.lastResult;
  ApiClient.downloadExcelCSV('SMART_PE_' + state.nickname + '.csv', [
    ['วันที่', 'รหัสผู้เล่น', 'ชื่อเล่น', 'ชื่อ-นามสกุล', 'ชั้น/เลขที่', 'ห้อง', 'โหมด', 'คะแนน', 'แม่นยำ(%)', 'ตอบสนอง(ms)', 'K', 'P', 'A'],
    [new Date().toLocaleDateString('th-TH'), playerId, state.nickname, document.getElementById('edu-fullname').value, document.getElementById('edu-class-no').value, state.roomCode, r.mode, r.score, r.accuracy, r.avgReactionMs, document.getElementById('edu-k').value, document.getElementById('edu-p').value, document.getElementById('edu-a').value]
  ]);
});

async function loadLeaderboard() {
  const tbody = document.getElementById('lb-tbody'), myRankBox = document.getElementById('my-rank-banner');
  tbody.innerHTML = '<tr><td colspan="6">กำลังโหลดอันดับคะแนน...</td></tr>';
  try {
    const data = await ApiClient.getLeaderboard({
      roomCode: document.getElementById('lb-room').value || state.roomCode,
      gameMode: document.getElementById('lb-mode').value, gradeLevel: document.getElementById('lb-grade').value,
      timeframe: document.getElementById('lb-time').value, playerId
    });
    if (data.myRank) {
      myRankBox.classList.remove('hidden');
      myRankBox.textContent = '⭐ อันดับของคุณ: ที่ ' + data.myRank.rank + ' จาก ' + data.totalPlayers + ' คน (คะแนน: ' + data.myRank.score + ')';
    } else myRankBox.classList.add('hidden');
    if (data.top10.length === 0) { tbody.innerHTML = '<tr><td colspan="6">ยังไม่มีข้อมูลคะแนน</td></tr>'; return; }
    tbody.innerHTML = data.top10.map((row) => '<tr style="' + (row.player_id === playerId ? 'background:rgba(0,229,255,0.15);font-weight:bold;' : '') + '"><td>' + row.rank + '</td><td>' + row.nickname + '</td><td>' + row.grade_level + '</td><td class="text-cyan">' + row.score + '</td><td>' + row.accuracy + '%</td><td>' + row.avg_reaction_ms + ' ms</td></tr>').join('');
  } catch (err) { tbody.innerHTML = '<tr><td colspan="6">' + err.message + '</td></tr>'; }
}

[document.getElementById('btn-nav-leaderboard'), document.getElementById('btn-welcome-lb'), document.getElementById('btn-result-lb')]
  .forEach((btn) => btn.addEventListener('click', () => { document.getElementById('lb-room').value = state.roomCode; document.getElementById('lb-mode').value = state.mode; showScreen('screen-leaderboard'); loadLeaderboard(); }));
document.getElementById('btn-refresh-lb').addEventListener('click', loadLeaderboard);
document.getElementById('btn-close-lb').addEventListener('click', () => showScreen('screen-welcome'));

document.getElementById('btn-nav-teacher').addEventListener('click', () => showScreen('screen-teacher'));
document.getElementById('btn-close-teacher').addEventListener('click', () => showScreen('screen-welcome'));

document.getElementById('btn-teacher-login').addEventListener('click', async () => {
  const pwd = document.getElementById('teacher-pwd').value;
  try {
    const res = await ApiClient.teacherAction(pwd, 'VERIFY');
    state.teacherPwd = pwd;
    document.getElementById('teacher-login-box').classList.add('hidden');
    document.getElementById('teacher-panel').classList.remove('hidden');
    renderTeacherRooms(res.rooms); loadTeacherScores('ALL');
  } catch (err) { alert(err.message); }
});

function renderTeacherRooms(rooms) {
  const listDiv = document.getElementById('teacher-rooms-list'), filterSel = document.getElementById('teacher-filter-room');
  filterSel.innerHTML = '<option value="ALL">ทุกห้องแข่งขัน</option>';
  listDiv.innerHTML = rooms.map((r) => {
    filterSel.innerHTML += '<option value="' + r.room_code + '">' + r.room_code + ' - ' + r.room_name + '</option>';
    return '<div style="display:flex;justify-content:space-between;padding:6px 0;"><span><strong>' + r.room_code + '</strong>: ' + r.room_name + '</span><button class="btn-sm ' + (r.is_active ? 'btn-cyan' : 'btn-danger') + '" onclick="window.toggleRoom(\'' + r.room_code + '\',' + !r.is_active + ')">' + (r.is_active ? 'เปิดอยู่' : 'ปิดแล้ว') + '</button></div>';
  }).join('');
}

window.toggleRoom = async (roomCode, isActive) => {
  await ApiClient.teacherAction(state.teacherPwd, 'TOGGLE_ROOM', { roomCode, isActive });
  const res = await ApiClient.teacherAction(state.teacherPwd, 'VERIFY');
  renderTeacherRooms(res.rooms);
};

document.getElementById('btn-create-room').addEventListener('click', async () => {
  try {
    await ApiClient.teacherAction(state.teacherPwd, 'CREATE_ROOM', { roomCode: document.getElementById('new-room-code').value, roomName: document.getElementById('new-room-name').value });
    const res = await ApiClient.teacherAction(state.teacherPwd, 'VERIFY');
    renderTeacherRooms(res.rooms); alert('สร้างห้องสำเร็จ');
  } catch (err) { alert(err.message); }
});

let cachedTeacherScores = [];
async function loadTeacherScores(roomCode) {
  const res = await ApiClient.teacherAction(state.teacherPwd, 'GET_SCORES', { roomCode });
  cachedTeacherScores = res.scores || [];
  document.getElementById('teacher-scores-tbody').innerHTML = cachedTeacherScores.map((s) => '<tr><td>' + new Date(s.created_at).toLocaleTimeString('th-TH') + '</td><td>' + s.room_code + '</td><td>' + s.nickname + '</td><td>' + s.grade_level + '</td><td>' + s.game_mode + '</td><td class="text-cyan">' + s.score + '</td><td>' + s.accuracy + '%</td></tr>').join('');
}

document.getElementById('teacher-filter-room').addEventListener('change', (e) => loadTeacherScores(e.target.value));
document.getElementById('btn-teacher-export-csv').addEventListener('click', () => {
  ApiClient.downloadExcelCSV('SMART_PE_ALL.csv', [['วันที่เวลา', 'ห้อง', 'รหัส', 'ชื่อเล่น', 'ชั้น', 'โหมด', 'คะแนน', 'แม่นยำ(%)'], ...cachedTeacherScores.map((s) => [new Date(s.created_at).toLocaleString('th-TH'), s.room_code, s.player_id, s.nickname, s.grade_level, s.game_mode, s.score, s.accuracy])]);
});
document.getElementById('btn-teacher-reset').addEventListener('click', async () => {
  const roomCode = document.getElementById('teacher-filter-room').value;
  if (roomCode === 'ALL') { alert('เลือกเฉพาะห้องที่ต้องการรีเซ็ตก่อนครับ'); return; }
  if (confirm('ยืนยันลบคะแนนห้อง ' + roomCode + '?')) { await ApiClient.teacherAction(state.teacherPwd, 'RESET_SCORES', { roomCode }); loadTeacherScores(roomCode); }
});

document.getElementById('btn-nav-guide').addEventListener('click', () => showScreen('screen-guide'));
document.getElementById('btn-close-guide').addEventListener('click', () => showScreen('screen-welcome'));