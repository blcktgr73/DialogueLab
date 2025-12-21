import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'

export default async function SessionPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const supabase = await createClient()

    const { data: session, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .single()

    if (error || !session) {
        notFound()
    }

    return (
        <div className="space-y-6">
            <div className="border-b pb-4">
                <h1 className="text-2xl font-bold tracking-tight">{session.title}</h1>
                <p className="text-muted-foreground text-sm">
                    {new Date(session.created_at).toLocaleString()} • {session.mode} mode
                </p>
            </div>

            <div className="p-8 border border-dashed rounded-lg bg-muted/20 text-center text-muted-foreground">
                대화 내용을 이곳에 표시할 예정입니다.
            </div>
        </div>
    )
}
