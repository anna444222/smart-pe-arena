import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  try {
    const { password, action, payload } = JSON.parse(event.body);
    if (!password || password !== process.env.TEACHER_ADMIN_PASSWORD) {
      return { statusCode: 401, body: JSON.stringify({ error: 'รหัสผ่านครูผู้สอนไม่ถูกต้อง' }) };
    }
    if (action === 'VERIFY') {
      const { data: rooms } = await supabase.from('game_rooms').select('*').order('created_at', { ascending: false });
      return { statusCode: 200, body: JSON.stringify({ success: true, rooms }) };
    }
    if (action === 'CREATE_ROOM') {
      const code = payload.roomCode.toUpperCase().trim().replace(/[^A-Z0-9_-]/g, '');
      const name = payload.roomName.trim();
      if (!code || !name) return { statusCode: 400, body: JSON.stringify({ error: 'กรุณาระบุรหัสห้องและชื่อห้อง' }) };
      const { error } = await supabase.from('game_rooms').insert([{ room_code: code, room_name: name, is_active: true }]);
      if (error) return { statusCode: 400, body: JSON.stringify({ error: 'รหัสห้องนี้มีอยู่แล้ว' }) };
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }
    if (action === 'TOGGLE_ROOM') {
      const { error } = await supabase.from('game_rooms').update({ is_active: payload.isActive }).eq('room_code', payload.roomCode);
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }
    if (action === 'GET_SCORES') {
      let query = supabase.from('game_scores').select('*').order('created_at', { ascending: false }).limit(500);
      if (payload?.roomCode && payload.roomCode !== 'ALL') query = query.eq('room_code', payload.roomCode);
      const { data, error } = await query;
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ success: true, scores: data }) };
    }
    if (action === 'RESET_SCORES') {
      const { error } = await supabase.from('game_scores').delete().eq('room_code', payload.roomCode);
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }
    return { statusCode: 400, body: JSON.stringify({ error: 'คำสั่งไม่ถูกต้อง' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'เกิดข้อผิดพลาดในระบบจัดการ' }) };
  }
};