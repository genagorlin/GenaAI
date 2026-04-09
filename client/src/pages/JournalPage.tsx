import { useParams } from "wouter";
import { JournalEditor } from "@/components/JournalEditor";

export default function JournalPage() {
  const { clientId, entryId } = useParams<{ clientId: string; entryId: string }>();

  if (!clientId || !entryId) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-100">
        <p className="text-muted-foreground">Invalid link</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-background flex justify-center bg-zinc-100">
      <div className="w-full h-full sm:max-w-[450px] lg:max-w-[700px] xl:max-w-[900px] bg-white shadow-2xl sm:border-x sm:border-zinc-200 overflow-hidden flex flex-col">
        <JournalEditor entryId={entryId} clientId={clientId} />
      </div>
    </div>
  );
}
