import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { User, MessageSquare } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'

export async function MainNav() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    return (
        <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 max-w-screen-md items-center justify-between mx-auto px-4">
                <Link href="/" className="flex items-center gap-2 font-bold">
                    <MessageSquare className="h-5 w-5" />
                    <span>Dialogue Lab</span>
                </Link>
                <nav className="flex items-center gap-2">
                    <Link href="/profile">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                            <User className="h-4 w-4" />
                            <span className="sr-only">프로필</span>
                        </Button>
                    </Link>
                </nav>
            </div>
        </header>
    )
}
