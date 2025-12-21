'use server'

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type UserSearchResult = {
    id: string;
    full_name: string | null;
    email: string | null; // Masked in UI or here? Let's mask here for safety if possible, or trust UI. 
    avatar_url: string | null;
}

export type Participant = {
    user_id: string;
    role: 'viewer' | 'editor' | 'owner';
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
}

/**
 * Search users by email or name.
 * Returns limited results for privacy.
 */
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
    if (!query || query.length < 2) return [];

    const supabase = await createClient();

    // Simple search: match email exactish or name ILIKE
    // Limit 5 to prevent scraping
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .or(`email.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(5);

    if (error) {
        console.error("Search users error:", error);
        return [];
    }

    return data || [];
}

/**
 * Invite a user to a session.
 */
export async function inviteUser(sessionId: string, userId: string, role: 'viewer' | 'editor' = 'viewer') {
    const supabase = await createClient();

    // Check if already invited is handled by PK constraint (session_id, user_id), 
    // but better to check or use upsert? Upsert is fine to update role.

    const { error } = await supabase
        .from('session_participants')
        .upsert({
            session_id: sessionId,
            user_id: userId,
            role: role
        });

    if (error) {
        console.error("Invite user error:", error);
        throw new Error("Failed to invite user");
    }

    revalidatePath(`/sessions/${sessionId}`);
}

/**
 * Remove a user from a session (or leave session).
 */
export async function removeParticipant(sessionId: string, userId: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('session_participants')
        .delete()
        .match({ session_id: sessionId, user_id: userId });

    if (error) {
        console.error("Remove participant error:", error);
        throw new Error("Failed to remove participant");
    }

    revalidatePath(`/sessions/${sessionId}`);
}

/**
 * Get participants for a session.
 */
export async function getParticipants(sessionId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('session_participants')
        .select(`
            user_id,
            role,
            profiles:user_id (
                full_name,
                email,
                avatar_url
            )
        `)
        .eq('session_id', sessionId);

    if (error) {
        console.error("Get participants error:", error);
        return [];
    }

    // Flatter structure if needed, but returning as is is fine.
    // Supabase returns array of objects with nested profiles
    // We map it to a cleaner structure
    return data.map((p: any) => ({
        user_id: p.user_id,
        role: p.role,
        full_name: p.profiles?.full_name,
        email: p.profiles?.email,
        avatar_url: p.profiles?.avatar_url
    }));
}
