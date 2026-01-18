-- Add partner_type column to sessions table
-- Values: 'human' (default), 'ai'

ALTER TABLE sessions 
ADD COLUMN partner_type text DEFAULT 'human' NOT NULL 
CHECK (partner_type IN ('human', 'ai'));

COMMENT ON COLUMN sessions.partner_type IS '대화 상대 유형: human(사람) 또는 ai(AI 시뮬레이션)';
