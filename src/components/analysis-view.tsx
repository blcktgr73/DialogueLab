import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MitiDashboard } from "@/components/miti-dashboard"
import { PracticeCardList, PracticeCardData } from "@/components/practice-card"

export interface AnalysisResultContent {
    summary: string;
    key_points: { title: string; description: string }[];
    sentiment: string;
    reflection_question: string;
    // MITI Structure (Optional)
    speakers?: Record<string, any>;
    practice_cards?: PracticeCardData[];
}

export function AnalysisView({ content }: { content: AnalysisResultContent }) {
    // Detect if this is a MITI Result
    if (content.speakers) {
        return (
            <div className="space-y-8 animate-fade-in-up">
                <MitiDashboard speakers={content.speakers} />

                {content.practice_cards && content.practice_cards.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold tracking-tight">연습 카드 (Practice Cards)</h3>
                            <Badge variant="secondary">Interactive</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            아쉬웠던 순간을 다시 연습해보세요. 카드를 클릭하면 전문가의 조언을 볼 수 있습니다.
                        </p>
                        <PracticeCardList cards={content.practice_cards} />
                    </div>
                )}
            </div>
        )
    }

    // Standard Analysis View
    return (
        <div className="space-y-8 animate-fade-in-up">
            <Card>
                <CardHeader>
                    <CardTitle>분석 결과 요약</CardTitle>
                    <CardDescription>대화 내용에 대한 전반적인 분석 결과입니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold mb-2">요약 (Summary)</h3>
                        <p className="text-muted-foreground">{content.summary}</p>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold mb-2">핵심 포인트 (Key Points)</h3>
                        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                            {content.key_points.map((point, index) => (
                                <li key={index}>
                                    <strong>{point.title}:</strong> {point.description}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold mb-2">감정 (Sentiment)</h3>
                        <Badge variant="outline">{content.sentiment}</Badge>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold mb-2">성찰 질문 (Reflection Question)</h3>
                        <p className="text-muted-foreground">{content.reflection_question}</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
