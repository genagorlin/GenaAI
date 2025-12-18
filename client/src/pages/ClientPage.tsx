import { JournalInterface } from "@/components/journal/JournalInterface";

export default function ClientPage() {
  return (
    <div className="h-screen w-full bg-background flex justify-center bg-zinc-100">
       <div className="w-full h-full sm:max-w-[450px] lg:max-w-[700px] xl:max-w-[900px] bg-white shadow-2xl sm:border-x sm:border-zinc-200 overflow-hidden relative">
          <JournalInterface />
       </div>
    </div>
  );
}
