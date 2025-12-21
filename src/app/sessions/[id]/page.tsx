import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { TranscriptView } from '@/components/transcript-view'
import { TranscriptUploader } from '@/components/transcript-uploader'
import { AnalysisView, AnalysisResultContent } from '@/components/analysis-view'
import { SessionHeader } from '@/components/session-header'

export default async function SessionPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const supabase = await createClient()

    // Fetch session
    const { data: session } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .single()

    if (!session) {
        notFound()
    }

    // Fetch transcripts
    const { data: transcripts } = await supabase
        .from('transcripts')
        .select('*')
        .eq('session_id', id)
        .order('created_at', { ascending: true })
        .order('transcript_index', { ascending: true })

    // Fetch latest analysis
    const { data: analysis } = await supabase
        .from('analysis_results')
        .select('*')
        .eq('session_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    return (
        <div className="space-y-8 pb-40">
            {/* Header with Title, Collab, Analyze */}
            <SessionHeader
                sessionId={id}
                initialTitle={session.title}
                createdAt={session.created_at}
                mode={session.mode}
            />

            {/* Analysis Section */}
            {analysis && (
                <section className="mb-8">
                    <AnalysisView content={analysis.content as AnalysisResultContent} />
                    <div className="my-8 border-t border-dashed" />
                </section>
            )}

            {/* Transcript Section */}
            <h3 className="font-semibold text-sm text-muted-foreground mb-2">대화 내용 ({transcripts?.length || 0})</h3>
            <TranscriptView transcripts={transcripts || []} sessionId={id} />

            {/* File Uploader */}
            <div className="fixed bottom-0 left-0 right-0 z-20">
                <div className="w-full max-w-screen-md mx-auto bg-background shadow-lg border-t">
                    <TranscriptUploader sessionId={id} />
                </div>
            </div>
        </div>
    )
}
