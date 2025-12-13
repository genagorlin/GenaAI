import { JournalInterface } from "@/components/journal/JournalInterface";

export default function ClientPage() {
  return (
    <div className="h-screen w-full bg-background overflow-hidden flex flex-col">
       <JournalInterface />
    </div>
  );
}
