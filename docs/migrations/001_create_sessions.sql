-- Create sessions table
create table sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid default null, -- Nullable for anonymous/guest sessions initially
  title text not null default 'Untitled Session',
  mode text not null default 'free', -- 'free', 'practice', 'eval'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies (Row Level Security)
alter table sessions enable row level security;

-- Policy: Allow anonymous creation (for now)
create policy "Enable insert for anonymous users" on sessions
  for insert with check (true);

-- Policy: Allow read for anyone (Logic will be handled by app/ownership later)
-- Warn: This is temporary for MVP speed. Authenticated RLS is safer.
create policy "Enable select for anyone" on sessions
  for select using (true);
