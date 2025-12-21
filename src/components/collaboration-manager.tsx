'use client'

import { useState, useTransition } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { UserPlus, X, Shield, Search, Loader2 } from "lucide-react"
import { searchUsers, inviteUser, removeParticipant, getParticipants, UserSearchResult, Participant } from "@/app/actions/collaboration"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

interface CollaborationManagerProps {
    sessionId: string;
    initialParticipants?: Participant[];
    className?: string;
}

export function CollaborationManager({ sessionId, initialParticipants = [], className }: CollaborationManagerProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
    const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
    const [isSearching, startSearch] = useTransition();
    const [isInviting, startInvite] = useTransition();

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.length < 2) {
            toast.error("검색어는 2글자 이상 입력해주세요.");
            return;
        }

        startSearch(async () => {
            const results = await searchUsers(query);
            setSearchResults(results);
            if (results.length === 0) {
                toast.info("검색 결과가 없습니다.");
            }
        });
    };

    const handleInvite = (userId: string) => {
        startInvite(async () => {
            try {
                await inviteUser(sessionId, userId, 'viewer'); // Default role 'viewer'
                toast.success("사용자를 초대했습니다.");
                // Refresh list
                const updated = await getParticipants(sessionId);
                setParticipants(updated);
                setSearchResults(prev => prev.filter(u => u.id !== userId)); // Remove from search results
            } catch (error) {
                toast.error("초대에 실패했습니다.");
            }
        });
    };

    const handleRemove = (userId: string) => {
        if (!confirm("정말 이 사용자를 내보내시겠습니까?")) return;

        startInvite(async () => {
            try {
                await removeParticipant(sessionId, userId);
                toast.success("사용자를 내보냈습니다.");
                const updated = await getParticipants(sessionId);
                setParticipants(updated);
            } catch (error) {
                toast.error("내보내기에 실패했습니다.");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={(v) => {
            setOpen(v);
            if (v) {
                // Refresh on open to be safe
                getParticipants(sessionId).then(setParticipants);
            }
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className={className}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    공유 ({participants.length})
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>대화 공유 및 참여자 관리</DialogTitle>
                    <DialogDescription>
                        함께 분석할 사용자를 초대하세요.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                    {/* Search Section */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium leading-none">사용자 초대</h4>
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <Input
                                placeholder="이름 또는 이메일 검색..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                            <Button type="submit" disabled={isSearching} size="icon">
                                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            </Button>
                        </form>

                        {/* Search Results */}
                        {searchResults.length > 0 && (
                            <div className="border rounded-md p-2 space-y-2 max-h-[150px] overflow-y-auto">
                                {searchResults.map(user => {
                                    const isAlreadyParticipant = participants.some(p => p.user_id === user.id);
                                    return (
                                        <div key={user.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-sm">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="w-8 h-8">
                                                    <AvatarImage src={user.avatar_url || ''} />
                                                    <AvatarFallback>{user.full_name?.[0] || '?'}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">{user.full_name}</span>
                                                    <span className="text-xs text-muted-foreground">{maskEmail(user.email)}</span>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                disabled={isAlreadyParticipant || isInviting}
                                                onClick={() => handleInvite(user.id)}
                                            >
                                                {isAlreadyParticipant ? "참여중" : "초대"}
                                            </Button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <div className="border-t" />

                    {/* Participants List */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium leading-none">현재 참여자</h4>
                        <div className="space-y-2">
                            {participants.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">아직 공유된 사용자가 없습니다.</p>
                            ) : (
                                participants.map(p => (
                                    <div key={p.user_id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="w-8 h-8">
                                                <AvatarImage src={p.avatar_url || ''} />
                                                <AvatarFallback>{p.full_name?.[0] || '?'}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium flex items-center gap-1">
                                                    {p.full_name}
                                                    {p.role === 'owner' && <Badge variant="secondary" className="text-[10px] h-4 px-1">Host</Badge>}
                                                </span>
                                                <span className="text-xs text-muted-foreground">{maskEmail(p.email)}</span>
                                            </div>
                                        </div>
                                        {p.role !== 'owner' && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-muted-foreground hover:text-red-500"
                                                onClick={() => handleRemove(p.user_id)}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function maskEmail(email: string | null) {
    if (!email) return "Unknown";
    const [name, domain] = email.split("@");
    if (!domain) return email;
    const maskedName = name.length > 2 ? `${name.substring(0, 2)}***` : `${name}***`;
    return `${maskedName}@${domain}`;
}
