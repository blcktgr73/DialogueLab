import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MessageSquare } from "lucide-react";
import { createSession } from "@/app/actions/session";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center space-y-8 py-12">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">안녕하세요, 연습자님.</h2>
        <p className="text-muted-foreground">오늘도 대화의 깊이를 더해볼까요?</p>
      </div>

      <Card className="w-full max-w-sm border-dashed shadow-sm hover:shadow-md transition-shadow cursor-pointer group bg-card/50">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-primary/10 p-3 rounded-full mb-2 group-hover:bg-primary/20 transition-colors">
            <Mic className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>새로운 세션 시작하기</CardTitle>
          <CardDescription>
            자유 대화나 연습 모드로 녹음을 시작합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-6">
          <form action={createSession}>
            <Button type="submit">시작하기</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
        <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-none shadow-none bg-secondary/50">
          <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
            <MessageSquare className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium">지난 기록 보기</span>
          </CardContent>
        </Card>
        <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-none shadow-none bg-secondary/50">
          <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
            <span className="text-xl">📊</span>
            <span className="text-sm font-medium">나의 성장 (준비중)</span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
