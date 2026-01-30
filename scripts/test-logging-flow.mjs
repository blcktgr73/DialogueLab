import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Using ANON key to test RLS "Enable insert for all users" policy

if (!supabaseUrl || !supabaseKey) {
    console.error('Skipping test: Missing env vars');
    process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const sessionId = `test_session_${Date.now()}`;
    console.log(`Inserting test log for session: ${sessionId}`);

    const { error } = await supabase.from('system_logs').insert({
        session_id: sessionId,
        source: 'verification_script',
        level: 'info',
        message: 'This is a test log entry from the verification script',
        metadata: { foo: 'bar' }
    });

    if (error) {
        console.error('Insert failed:', error);
        process.exit(1);
    }

    console.log('Insert successful! Now run:');
    console.log(`node scripts/view-logs.mjs ${sessionId}`);
    console.log(`OR node scripts/view-logs.mjs (to see it in list)`);
}

test();
