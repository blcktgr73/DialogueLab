import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { TranscriptView } from '@/components/transcript-view'
import { TranscriptUploader } from '@/components/transcript-uploader'
import { AnalysisView, AnalysisResultContent } from '@/components/analysis-view'
import { analyzeSession } from '@/app/actions/analysis'
import { AnalyzeButton } from '@/components/analyze-button'


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
            <div className="border-b pb-4 sticky top-0 bg-card/95 backdrop-blur z-10 pt-2 flex justify-between items-start">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">{session.title}</h1>
                    <p className="text-muted-foreground text-xs">
                        {new Date(session.created_at).toISOString().split('T')[0]} • {session.mode}
                    </p>
                </div>

                {/* Analyze Action */}
                <form action={async () => {
                    'use server'
                    await analyzeSession(id, 'empathy') // Default lens for now
                }}>
                    <AnalyzeButton />
                </form>
            </div>

            {/* Analysis Section */}
            {analysis && (
                <section className="mb-8">
                    <AnalysisView content={analysis.content as AnalysisResultContent} />
                    <div className="my-8 border-t border-dashed" />
                </section>
            )}

            {/* Transcript Section */}
            <h3 className="font-semibold text-sm text-muted-foreground mb-2">대화 내용 ({transcripts?.length || 0})</h3>
            <TranscriptView transcripts={transcripts || []} />

            {/* File Uploader */}
            <div className="fixed bottom-0 left-0 right-0 z-20">
                <div className="w-full max-w-screen-md mx-auto bg-background shadow-lg border-t">
                    <TranscriptUploader sessionId={id} />
                </div>
            </div>
        </div>
    )
}
