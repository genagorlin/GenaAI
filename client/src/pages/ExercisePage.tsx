import { useParams } from "wouter";
import { ExercisePlayer } from "@/components/ExercisePlayer";

export default function ExercisePage() {
  const params = useParams<{ clientId: string; sessionId: string }>();

  if (!params.clientId || !params.sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Invalid exercise session</p>
      </div>
    );
  }

  return (
    <ExercisePlayer
      sessionId={params.sessionId}
      clientId={params.clientId}
    />
  );
}
