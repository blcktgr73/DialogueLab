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

    const { error } = await supabase
        .from('sessions')
        .update({ title: newTitle })
        .eq('id', sessionId)
        .eq('user_id', user.id)

    if (error) {
        console.error('Error updating session title:', error)
        throw new Error('세션 제목 수정 실패')
    }

    revalidatePath('/')
    revalidatePath(`/sessions/${sessionId}`)
}
