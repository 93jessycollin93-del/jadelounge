import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { NotConnected } from "@/components/common/NotConnected";

export default function Messages() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="font-display text-2xl font-semibold">Messages</h1>
      <NotConnected
        feature="Direct messaging"
        note="Real-time chat is scaffolded but not wired to a transport yet. We'll enable it in the next iteration so you see real conversations, not fake demo data."
      />
      <EmptyState icon={MessageCircle} title="No conversations" description="Start a thread with someone you follow once messaging is enabled." />
    </div>
  );
}