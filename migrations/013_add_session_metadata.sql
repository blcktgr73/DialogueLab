-- Add metadata column to sessions for storing flexible config (e.g. persona settings)
ALTER TABLE sessions ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
COMMENT ON COLUMN sessions.metadata IS '세션 관련 메타데이터 (예: 시뮬레이션 페르소나 설정, 분석 옵션 등)';
