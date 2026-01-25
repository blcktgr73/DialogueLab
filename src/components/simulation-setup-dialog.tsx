'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Bot, Loader2 } from 'lucide-react'
import { createSimulationSession } from '@/app/actions/session'
import { toast } from 'sonner'

export function SimulationSetupDialog() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [persona, setPersona] = useState({
        name: '김철수',
        topic: '금연 상담',
        resistance: 5
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        const toastId = toast.loading("시뮬레이션을 준비하고 있습니다.")

        try {
            const sessionId = await createSimulationSession(persona)
            toast.dismiss(toastId)
            toast.success("시뮬레이션 환경을 구성했습니다.")
            setOpen(false)
            router.push(`/sessions/${sessionId}/live`)
        } catch (error) {
            console.error(error)
            toast.dismiss(toastId)
            toast.error("시뮬레이션 생성에 실패했습니다.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 w-full border-violet-200 hover:bg-violet-50 hover:text-violet-700 text-violet-600">
                    <Bot className="w-4 h-4" />
                    AI 파트너와 연습하기
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>AI 연습 파트너 설정</DialogTitle>
                        <DialogDescription>
                            연습하고 싶은 상담 주제와 파트너의 특성을 설정하세요.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">파트너 이름</Label>
                            <Input
                                id="name"
                                value={persona.name}
                                onChange={(e) => setPersona({ ...persona, name: e.target.value })}
                                placeholder="예: 김철수"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="topic">상담 주제</Label>
                            <Input
                                id="topic"
                                value={persona.topic}
                                onChange={(e) => setPersona({ ...persona, topic: e.target.value })}
                                placeholder="예: 금연, 운동 부족, 스트레스 관리"
                                required
                            />
                        </div>
                        <div className="grid gap-4">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="resistance">변화 저항 수준 (1-10)</Label>
                                <span className="text-sm font-medium text-muted-foreground">{persona.resistance}</span>
                            </div>
                            <Slider
                                id="resistance"
                                min={1}
                                max={10}
                                step={1}
                                value={[persona.resistance]}
                                onValueChange={(vals: number[]) => setPersona({ ...persona, resistance: vals[0] })}
                                className="py-2"
                            />
                            <p className="text-xs text-muted-foreground text-center">
                                {persona.resistance <= 3 ? "변화 준비가 된 상태 (협조적)" :
                                    persona.resistance <= 7 ? "양가감정이 있는 상태 (일반적)" :
                                        "강한 저항 (도전적)"}
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isLoading} className="bg-violet-600 hover:bg-violet-700">
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            시뮬레이션 시작
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
