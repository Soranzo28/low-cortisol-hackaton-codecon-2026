CREATE TABLE IF NOT EXISTS players (
  clerk_user_id TEXT PRIMARY KEY,
  nick          TEXT UNIQUE NOT NULL,
  total_score   INTEGER DEFAULT 0,
  matches_played INTEGER DEFAULT 0,
  wins          INTEGER DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW()
);

ALTER TABLE players ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

CREATE TABLE IF NOT EXISTS matches (
  id        SERIAL PRIMARY KEY,
  player_a  TEXT REFERENCES players(clerk_user_id),
  player_b  TEXT REFERENCES players(clerk_user_id),
  score_a   INTEGER,
  score_b   INTEGER,
  winner    TEXT REFERENCES players(clerk_user_id),
  played_at TIMESTAMP DEFAULT NOW()
);
