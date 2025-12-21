'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

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
