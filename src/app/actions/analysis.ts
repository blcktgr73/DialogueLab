'use server'

import { createClient } from '@/utils/supabase/server'
import { generateAnalysis, TranscriptEntry } from '@/lib/gemini'
import { revalidatePath } from 'next/cache'

export async function analyzeSession(sessionId: string, lensType: string) {
    const supabase = await createClient()

    // 1. Fetch Transcripts
    const { data: transcripts, error: transcriptsError } = await supabase
        .from('transcripts')
        .select('speaker, content, timestamp')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

    if (transcriptsError || !transcripts || transcripts.length === 0) {
        throw new Error('분석할 대화 내용이 없습니다.')
    }

    try {
        // 2. Call AI
        const result = await generateAnalysis(transcripts as TranscriptEntry[], lensType)

        // 3. Save Result
        const { error: saveError } = await supabase
            .from('analysis_results')
            .insert({
                session_id: sessionId,
                lens_type: lensType,
                content: result // JSONB
            })

        if (saveError) {
            console.error('Error saving analysis:', saveError)
            throw new Error('분석 결과 저장 실패')
        }

        revalidatePath(`/sessions/${sessionId}`)

    } catch (err: any) {
        console.error('Analysis failed:', err)
        throw new Error(`분석 중 오류 발생: ${err.message}`)
    }
}
