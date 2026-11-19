export const ApiClient = {
  async submitScore(payload) {
    const res = await fetch('/.netlify/functions/submit-score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'ส่งคะแนนไม่สำเร็จ');
    return data;
  },
  async getLeaderboard({ roomCode, gameMode, gradeLevel, timeframe, playerId }) {
    const params = new URLSearchParams({ roomCode, gameMode, gradeLevel, timeframe, playerId });
    const res = await fetch('/.netlify/functions/get-leaderboard?' + params.toString());
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'โหลดตารางคะแนนไม่สำเร็จ');
    return data;
  },
  async teacherAction(password, action, payload = {}) {
    const res = await fetch('/.netlify/functions/teacher-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, action, payload }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'คำสั่งไม่สำเร็จ');
    return data;
  },
  downloadExcelCSV(filename, rows) {
    const csvContent = '\uFEFF' + rows.map((e) => e.map((cell) => '"' + String(cell ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.setAttribute('download', filename);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }
};