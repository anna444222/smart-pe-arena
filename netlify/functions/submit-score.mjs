import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  try {
    const data = JSON.parse(event.body);
    const { sessionToken, playerId, nickname, gradeLevel, roomCode, gameMode, difficulty, durationSec, score, hits, misses, accuracy, avgReactionMs, hitTimestamps } = data;
    if (!sessionToken || !playerId || !nickname || !gameMode) return { statusCode: 400, body: JSON.stringify({ error: 'ข้อมูลไม่ครบถ้วน' }) };

    const targetRoom = (roomCode || 'GLOBAL').toUpperCase().trim();
    const { data: roomData, error: roomErr } = await supabase.from('game_rooms').select('is_active').eq('room_code', targetRoom).single();
    if (roomErr || !roomData) return { statusCode: 404, body: JSON.stringify({ error: 'ไม่พบรหัสห้องแข่งขันนี้' }) };
    if (!roomData.is_active) return { statusCode: 403, body: JSON.stringify({ error: 'ครูได้ปิดรับคะแนนสำหรับห้องนี้แล้ว' }) };

    const validDuration = [30, 60, 90].includes(Number(durationSec)) ? Number(durationSec) : 60;
    const maxTheoreticalHits = Math.floor(validDuration / 0.35);
    if (score < 0 || score > maxTheoreticalHits * 20 || hits > maxTheoreticalHits) {
      return { statusCode: 422, body: JSON.stringify({ error: 'ตรวจพบค่าคะแนนผิดปกติ' }) };
    }
    if (Array.isArray(hitTimestamps) && hitTimestamps.length > 1) {
      for (let i = 1; i < hitTimestamps.length; i++) {
        if (hitTimestamps[i] - hitTimestamps[i - 1] < 150) return { statusCode: 422, body: JSON.stringify({ error: 'ความเร็วตอบสนองผิดปกติ' }) };
      }
    }

    const { error: insertErr } = await supabase.from('game_scores').insert([{
      session_token: sessionToken, player_id: playerId, nickname: nickname.substring(0, 20),
      grade_level: ['P4', 'P5', 'P6'].includes(gradeLevel) ? gradeLevel : 'P4',
      room_code: targetRoom, game_mode: gameMode, difficulty: difficulty || 'Beginner',
      score: Math.round(score), hits: Math.round(hits), misses: Math.round(misses),
      accuracy: Number(accuracy) || 0, avg_reaction_ms: Math.round(avgReactionMs) || 0
    }]);
    if (insertErr) {
      if (insertErr.code === '23505') return { statusCode: 409, body: JSON.stringify({ error: 'คะแนนรอบนี้ถูกบันทึกไปแล้ว' }) };
      throw insertErr;
    }
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' }) };
  }
};