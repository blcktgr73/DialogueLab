import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { TranscriptView } from '@/components/transcript-view'
import { TranscriptUploader } from '@/components/transcript-uploader'

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

    return (
        <div className="space-y-6 pb-40"> {/* pb increased for upload area */}
            <div className="border-b pb-4 sticky top-0 bg-card/95 backdrop-blur z-10 pt-2">
                <h1 className="text-xl font-bold tracking-tight">{session.title}</h1>
                <p className="text-muted-foreground text-xs">
                    {new Date(session.created_at).toLocaleString()} • {session.mode}
                </p>
            </div>

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
