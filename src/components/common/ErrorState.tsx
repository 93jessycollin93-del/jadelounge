import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "Something went wrong loading this content.", onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mb-3">
        <AlertCircle className="h-5 w-5 text-destructive" />
      </div>
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
          Try again
        </Button>
      )}
    </div>
  );
}