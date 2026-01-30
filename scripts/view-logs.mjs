import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from root or stt-worker
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
// Fallback if running from proper context or if .env.local missing
if (!process.env.SUPABASE_URL) {
    dotenv.config({ path: path.resolve(process.cwd(), 'stt-worker/.env') });
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listRecentSessions() {
    console.log('Fetching recent sessions...');
    // Supabase doesn't support complex group by/aggs easily in JS client without rpc or simple queries.
    // We'll just fetch unique session_ids from the last 100 logs.
    const { data, error } = await supabase
        .from('system_logs')
        .select('session_id, created_at, source')
        .order('created_at', { ascending: false })
        .limit(200);

    if (error) {
        console.error('Failed to fetch logs:', error.message);
        return;
    }

    const sessions = new Map();
    data.forEach(row => {
        if (!sessions.has(row.session_id)) {
            sessions.set(row.session_id, {
                start: row.created_at,
                sources: new Set([row.source]),
                count: 0
            });
        }
        const session = sessions.get(row.session_id);
        session.sources.add(row.source);
        session.count++;
    });

    if (sessions.size === 0) {
        console.log('No recent logs found.');
        return;
    }

    console.log('\nRecent Sessions (Latest first):');
    console.table(Array.from(sessions.entries()).slice(0, 10).map(([id, info]) => ({
        'Session ID': id,
        'Latest Activity': new Date(info.start).toLocaleString(),
        'Sources': Array.from(info.sources).join(', '),
        'Logs': info.count
    })));
    console.log('\nTo view details: node scripts/view-logs.mjs <session-id>');
}

async function viewSessionLogs(sessionId) {
    console.log(`Fetching logs for session: ${sessionId}\n`);
    const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No logs found for this session ID.');
        return;
    }

    data.forEach(log => {
        const time = new Date(log.created_at).toLocaleTimeString();
        const level = log.level.toUpperCase().padEnd(5);
        const source = log.source.padEnd(10);
        let color = '\x1b[0m'; // Reset

        if (log.level === 'error') color = '\x1b[31m'; // Red
        else if (log.level === 'warn') color = '\x1b[33m'; // Yellow
        else if (log.source === 'stt-worker') color = '\x1b[36m'; // Cyan

        console.log(`${color}[${time}] [${source}] [${level}] ${log.message}\x1b[0m`);
        if (log.metadata && Object.keys(log.metadata).length > 0) {
            console.log('\x1b[2m', JSON.stringify(log.metadata, null, 2).replace(/^/gm, '      '), '\x1b[0m');
        }
    });
}

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--list') {
    listRecentSessions();
} else {
    viewSessionLogs(args[0]);
}
