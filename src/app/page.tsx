
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MessageSquare } from "lucide-react";
import { createSession } from "@/app/actions/session";
import { SessionCard } from "@/components/session-card";
import { NewSessionCardContent } from "@/components/new-session-card-content";

import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let sessions: any[] = [];
  if (user) {
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    sessions = data || [];
  }

  return (
    <div className="flex flex-col items-center space-y-8 py-12">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">안녕하세요{user ? ', 연습자님' : ''}.</h2>
        <p className="text-muted-foreground">오늘도 대화의 깊이를 더해볼까요?</p>
      </div>

      {/* Start New Session Card */}
      <Card className="w-full max-w-sm shadow-md hover:shadow-lg transition-all duration-300 border-none bg-gradient-to-b from-white to-slate-50">
        <CardHeader className="opacity-0 h-0 p-0 overflow-hidden"><CardTitle>New Session</CardTitle></CardHeader> {/* Accessibility hidden header */}
        <CardContent className="flex justify-center py-10 px-6">
          <NewSessionCardContent />
        </CardContent>
      </Card>

      {/* Session List */}
      {user && sessions.length > 0 && (
        <div className="w-full max-w-screen-sm space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-semibold text-lg">최근 대화 기록</h3>
            <span className="text-xs text-muted-foreground">{sessions.length}개의 세션</span>
          </div>

          <div className="grid gap-3">
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
