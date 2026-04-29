import { supabase } from "@/integrations/supabase/client";

/**
 * Find an existing 1:1 conversation between two users, or create one.
 * Returns the conversation id.
 */
export async function openOrCreateConversation(userA: string, userB: string): Promise<string> {
  if (userA === userB) throw new Error("Cannot start a conversation with yourself");

  // Find conversations where I'm a participant, then check the other side.
  const { data: mine } = await supabase
    .from("conversation_participants")
    .select("conversation_id, conversations:conversation_id(is_group)")
    .eq("user_id", userA);

  const myConvIds = (mine ?? [])
    .filter((r) => {
      const c = (r as unknown as { conversations: { is_group: boolean } | null }).conversations;
      return c && !c.is_group;
    })
    .map((r) => r.conversation_id as string);

  if (myConvIds.length > 0) {
    const { data: other } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userB)
      .in("conversation_id", myConvIds);
    if (other && other.length > 0) return other[0].conversation_id as string;
  }

  // Create
  const { data: conv, error: cErr } = await supabase
    .from("conversations")
    .insert({ created_by: userA, is_group: false })
    .select("id")
    .single();
  if (cErr || !conv) throw new Error(cErr?.message ?? "Could not create conversation");

  const { error: pErr } = await supabase.from("conversation_participants").insert([
    { conversation_id: conv.id, user_id: userA },
    { conversation_id: conv.id, user_id: userB },
  ]);
  if (pErr) throw new Error(pErr.message);

  return conv.id;
}