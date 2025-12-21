import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { signOut, updateProfile } from '@/app/actions/auth'
import { User, LogOut } from 'lucide-react'

export default async function ProfilePage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold tracking-tight">프로필 설정</h1>

            <Card>
                <CardHeader>
                    <CardTitle>내 정보</CardTitle>
                    <CardDescription>
                        계정 정보와 표시되는 이름을 관리합니다.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>이메일</Label>
                        <Input value={user.email} disabled className="bg-muted" />
                    </div>

                    <form action={updateProfile} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullName">이름 (닉네임)</Label>
                            <div className="flex gap-2">
                                <Input
                                    name="fullName"
                                    id="fullName"
                                    defaultValue={profile?.full_name || ''}
                                    placeholder="이름을 입력하세요"
                                />
                                <Button type="submit" size="sm">저장</Button>
                            </div>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card className="border-red-100 dark:border-red-900/30">
                <CardHeader>
                    <CardTitle className="text-red-600 dark:text-red-400 text-base">계정 관리</CardTitle>
                </CardHeader>
                <CardContent>
                    <form action={signOut}>
                        <Button variant="destructive" className="gap-2">
                            <LogOut className="w-4 h-4" />
                            로그아웃
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
