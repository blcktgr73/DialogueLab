'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createSession(formData?: FormData) {
    const title = formData?.get('title') as string
    const mode = formData?.get('mode') as string
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('User is not authenticated')
    }

    const { data, error } = await supabase
        .from('sessions')
        .insert([
            {
                title: title || '새로운 대화 세션',
                mode: mode || 'free',
                user_id: user.id
            }
        ])
        .select()
        .single()

    if (error) {
        console.error('Error creating session:', error)
        // In a real app, we should return an error state to the UI
        throw new Error('세션을 생성하는데 실패했습니다.')
    }

    if (data) {
        redirect(`/sessions/${data.id}`)
    }
}

export async function createSessionWithTranscript(fullText: string, rawData: any) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('User is not authenticated')
    }

    // 1. 세션 생성
    const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert([
            {
                title: `음성 대화 (${new Date().toLocaleDateString()})`,
                mode: 'free',
                user_id: user.id
            }
        ])
        .select()
        .single()

    if (sessionError || !session) {
        console.error('Error creating session:', sessionError)
        throw new Error('세션 생성 실패')
    }

    // 2. 축어록 데이터 파싱 (Google STT Response -> Transcripts Rows)
    // rawData.results -> alternatives -> words (speakerTag)

    // 단순화: words가 있는 경우 화자 분리 적용
    // 없는 경우 전체 텍스트를 Speaker 1로 저장
    let transcripts = []

    // words 정보를 모아서 처리
    const allWords = rawData.words || []; // API Route에서 words를 따로 빼서 줌

    if (allWords && allWords.length > 0) {
        // Speaker Tag별로 그룹핑 로직 필요 (간단 구현)
        // sequential 하게 순회하며 speaker가 바뀔 때마다 새로운 row 생성
        let currentSpeaker = allWords[0].speakerTag?.toString() || '1';
        let currentContent: string[] = [];
        let transcriptIndex = 0;

        for (const wordInfo of allWords) {
            const speaker = wordInfo.speakerTag?.toString() || '1';
            const word = wordInfo.word;

            if (speaker !== currentSpeaker && currentContent.length > 0) {
                // Push previous segment
                transcripts.push({
                    session_id: session.id,
                    speaker: `참석자 ${currentSpeaker}`,
                    content: currentContent.join(' '),
                    timestamp: 0,
                    transcript_index: transcriptIndex++
                });
                // Reset
                currentSpeaker = speaker;
                currentContent = [word];
            } else {
                currentContent.push(word);
            }
        }
        // Last segment
        if (currentContent.length > 0) {
            transcripts.push({
                session_id: session.id,
                speaker: `참석자 ${currentSpeaker}`,
                content: currentContent.join(' '),
                timestamp: 0,
                transcript_index: transcriptIndex++
            });
        }

    } else {
        // Fallback: 전체 텍스트
        transcripts.push({
            session_id: session.id,
            speaker: '참석자',
            content: fullText,
            timestamp: 0,
            transcript_index: 0
        });
    }

    const { error: transcriptError } = await supabase
        .from('transcripts')
        .insert(transcripts)

    if (transcriptError) {
        console.error('Transcripts insert error:', transcriptError);
        // 세션은 만들어졌으므로 에러를 던지기보단 넘어갈 수도 있음.
        // 하지만 여기선 에러 처리
    }

    return session.id;
}

export async function deleteSession(sessionId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id)

    if (error) {
        console.error('Error deleting session:', error)
        throw new Error('세션 삭제 실패')
    }

    revalidatePath('/')
}

export async function updateSessionTitle(sessionId: string, newTitle: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('sessions')
        .update({ title: newTitle })
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .select()

    if (error) {
        console.error('Error updating session title:', error)
        throw new Error('세션 제목 수정 실패')
    }

    if (!data || data.length === 0) {
        throw new Error('권한이 없거나 세션을 찾을 수 없습니다.')
    }

    revalidatePath('/')
    revalidatePath(`/sessions/${sessionId}`)
}

export async function createSimulationSession(persona: { name: string; topic: string; resistance: number }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('User is not authenticated')
    }

    const { data, error } = await supabase
        .from('sessions')
        .insert([
            {
                title: `${persona.topic} (연습: ${persona.name})`,
                mode: 'practice',
                partner_type: 'ai',
                user_id: user.id,
                metadata: {
                    persona: persona,
                    started_at: new Date().toISOString()
                }
            }
        ])
        .select()
        .single()

    if (error) {
        console.error('Error creating simulation session:', error)
        throw new Error('시뮬레이션 세션 생성 실패')
    }

    if (data) {
        redirect(`/sessions/${data.id}`)
    }
}
