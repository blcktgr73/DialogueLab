import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    try {
        const body = await req.json();
        const token = body.token;

        if (!token) {
            console.error('[STT Callback] No token provided', body);
            return NextResponse.json({ message: 'Token missing' }, { status: 400 });
        }

        console.log('[STT Callback] Received result for token:', token);

        // Log to system_logs so we can retrieve it via polling
        // We use a specific convention for session_id to easily find it: "clova-result-{token}"
        const { error } = await supabase.from('system_logs').insert({
            session_id: `clova-result-${token}`,
            source: 'api/stt/callback',
            level: 'info',
            message: 'Clova Async Result',
            metadata: body // The full result from Clova
        });

        if (error) {
            console.error('[STT Callback] Failed to save log:', error);
            return NextResponse.json({ message: 'Save failed' }, { status: 500 });
        }

        return NextResponse.json({ message: 'OK' });
    } catch (e) {
        console.error('[STT Callback] Error:', e);
        return NextResponse.json({ message: 'Internal Error' }, { status: 500 });
    }
}
