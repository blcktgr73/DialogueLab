'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addTranscript(sessionId: string, formData: FormData) {
    const supabase = await createClient()

    const speaker = formData.get('speaker') as string
    const content = formData.get('content') as string
    const timestamp = 0 // Default for manual entry

    if (!speaker || !content) return;

    const { error } = await supabase
        .from('transcripts')
        .insert([
            { session_id: sessionId, speaker, content, timestamp }
        ])

    if (error) {
        console.error('Error adding transcript:', error)
        throw new Error('축어록 추가 실패')
    }

    revalidatePath(`/sessions/${sessionId}`)
}

export async function bulkAddTranscripts(sessionId: string, transcripts: { speaker: string, content: string, timestamp?: string }[], fileName?: string) {
    const supabase = await createClient()

    // 1. Check if we should auto-rename the session
    if (fileName) {
        const { data: session } = await supabase
            .from('sessions')
            .select('title')
            .eq('id', sessionId)
            .single()

        if (session && session.title === '새로운 대화 세션') {
            // Remove extension if present (e.g., "my_log.txt" -> "my_log")
            const newTitle = fileName.replace(/\.[^/.]+$/, "")
            await supabase
                .from('sessions')
                .update({ title: newTitle })
                .eq('id', sessionId)
        }
    }

    // 2. Insert Transcripts
    // Map to simple integer timestamp if possible, or just standard 0 for now.
    // Future: Parse "00:01:23" to seconds.

    const rows = transcripts.map(t => ({
        session_id: sessionId,
        speaker: t.speaker,
        content: t.content,
        timestamp: 0 // Placeholder logic for now
    }))

    const { error } = await supabase
        .from('transcripts')
        .insert(rows)

    if (error) {
        console.error('Error adding transcripts:', error)
        throw new Error('축어록 일괄 추가 실패')
    }

    revalidatePath(`/sessions/${sessionId}`)
}
