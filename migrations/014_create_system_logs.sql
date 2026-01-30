create table system_logs (
    id uuid default gen_random_uuid() primary key,
    created_at timestamptz default now() not null,
    session_id text not null,
    source text not null,
    level text not null,
    message text not null,
    metadata jsonb
);

-- Improve query performance for session lookups and time-based sorting
create index system_logs_session_id_idx on system_logs (session_id);
create index system_logs_created_at_idx on system_logs (created_at desc);

alter table system_logs enable row level security;

-- Client side needs to insert logs (auth and anon)
create policy "Enable insert for all users" on system_logs
    for insert with check (true);

-- Debugging UI might need to read logs (restricted to authenticated for now)
create policy "Enable read for authenticated users" on system_logs
    for select using (auth.role() = 'authenticated');
