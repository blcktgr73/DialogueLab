import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export type AnalysisResultContent = {
    summary: string
    key_points: { title: string, description: string }[]
    sentiment: string
    reflection_question: string
}

export function AnalysisView({ content }: { content: AnalysisResultContent }) {
    if (!content) return null

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-2">
                    <Badge variant="outline" className="w-fit mb-2 bg-background">AI 성찰 분석</Badge>
                    <CardTitle className="text-lg">요약</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm leading-relaxed">{content.summary}</p>
                </CardContent>
            </Card>

            <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground px-1">주요 관찰 포인트</h3>
                {content.key_points.map((point, i) => (
                    <Card key={i} className="overflow-hidden">
                        <div className="h-1 w-full bg-gradient-to-r from-primary/40 to-primary/10" />
                        <CardHeader className="py-3">
                            <CardTitle className="text-base">{point.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="py-0 pb-4 text-sm text-muted-foreground">
                            {point.description}
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="bg-secondary/30 border-none">
                <CardContent className="p-6 text-center space-y-2">
                    <span className="text-2xl">🤔</span>
                    <h3 className="font-semibold">성찰 질문</h3>
                    <p className="text-sm text-muted-foreground italic">
                        "{content.reflection_question}"
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
