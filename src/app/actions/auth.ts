'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function signOut() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}

export async function updateProfile(formData: FormData) {
    const fullName = formData.get('fullName') as string
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('profiles')
        .upsert({
            id: user.id,
            full_name: fullName,
            // updated_at column does not exist in schema yet
        })
        .select()

    if (error) {
        console.error('Profile update failed:', error)
        throw new Error('프로필 업데이트 실패')
    }

    revalidatePath('/profile')
    revalidatePath('/') // Update header if name is there
}
