CREATE TABLE IF NOT EXISTS game_rooms (
    room_code TEXT PRIMARY KEY,
    room_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO game_rooms (room_code, room_name, is_active) VALUES ('GLOBAL', 'ลานประลองรวม (Global Arena)', TRUE) ON CONFLICT (room_code) DO NOTHING;
CREATE TABLE IF NOT EXISTS game_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_token TEXT UNIQUE NOT NULL,
    player_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    room_code TEXT REFERENCES game_rooms(room_code) ON DELETE CASCADE,
    game_mode TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 3000),
    hits INTEGER NOT NULL DEFAULT 0,
    misses INTEGER NOT NULL DEFAULT 0,
    accuracy NUMERIC(5,2) NOT NULL DEFAULT 0,
    avg_reaction_ms INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leaderboard ON game_scores (room_code, game_mode, grade_level, score DESC);
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;