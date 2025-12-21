-- Add transcript_index column for deterministic sorting
-- This solves the issue where bulk-inserted rows have identical timestamps and scramble on update.

alter table transcripts 
add column transcript_index integer default 0;

-- Optional: Create index for faster sorting if needed
create index transcripts_session_sorting_idx on transcripts(session_id, created_at, transcript_index);
