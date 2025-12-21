'use client'

import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Chrome } from 'lucide-react'

export default function LoginPage() {
    const handleGoogleLogin = async () => {
        const supabase = createClient()
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        })

        if (error) {
            console.error('Login error:', error)
            alert('로그인에 실패했습니다.')
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
            <Card className="w-full max-w-sm shadow-lg border-none">
                <CardHeader className="text-center space-y-1">
                    <CardTitle className="text-2xl font-bold tracking-tight">Dialogue Lab</CardTitle>
                    <CardDescription>
                        나만의 대화 연습 공간에 오신 것을 환영합니다.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <Button variant="outline" className="w-full gap-2 py-6 text-base" onClick={handleGoogleLogin}>
                        <Chrome className="w-5 h-5" />
                        Google로 계속하기
                    </Button>
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">
                                Secure & Private
                            </span>
                        </div>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                        로그인하면 대화 내용은 안전하게 암호화되어 저장됩니다.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
