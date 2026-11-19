import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const roomCode = (params.roomCode || 'GLOBAL').toUpperCase().trim();
    const gameMode = params.gameMode || 'HAND';
    const gradeLevel = params.gradeLevel || 'ALL';
    const timeframe = params.timeframe || 'ALL';
    const playerId = params.playerId || '';

    let query = supabase.from('game_scores')
      .select('player_id, nickname, grade_level, score, accuracy, avg_reaction_ms, created_at')
      .eq('room_code', roomCode).eq('game_mode', gameMode)
      .order('score', { ascending: false }).order('avg_reaction_ms', { ascending: true }).limit(200);

    if (gradeLevel !== 'ALL') query = query.eq('grade_level', gradeLevel);
    if (timeframe === 'TODAY') {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      query = query.gte('created_at', todayStart.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    const bestByPlayer = new Map();
    for (const row of data) {
      if (!bestByPlayer.has(row.player_id)) bestByPlayer.set(row.player_id, row);
    }
    const rankedList = Array.from(bestByPlayer.values()).map((item, idx) => ({ rank: idx + 1, ...item }));
    const top10 = rankedList.slice(0, 10);
    const myRank = playerId ? rankedList.find(r => r.player_id === playerId) || null : null;

    return { statusCode: 200, body: JSON.stringify({ top10, myRank, totalPlayers: rankedList.length }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ไม่สามารถโหลดอันดับคะแนนได้' }) };
  }
};