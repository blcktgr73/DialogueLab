import { LiveSessionView } from '@/components/live-session-view';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function LiveSessionPage({ params }: PageProps) {
    const { id } = await params;
    console.log('[LiveSessionPage] Rendering for ID:', id);
    const supabase = await createClient();
    const { data: session } = await supabase
        .from('sessions')
        .select('id, metadata')
        .eq('id', id)
        .single();

    if (!session) {
        notFound();
    }

    return (
        <div className="container max-w-2xl mx-auto py-12 flex flex-col items-center min-h-screen">
            <div className="w-full flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-slate-800">실시간 AI 대화</h1>
                <Button variant="ghost" asChild>
                    <Link href={`/sessions/${id}`}>세션 종료 및 분석</Link>
                </Button>
            </div>

            <div className="w-full aspect-[3/4] max-h-[600px] bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 relative">
                <LiveSessionView sessionId={id} persona={session.metadata?.persona} />
            </div>
        </div>
    );
}
