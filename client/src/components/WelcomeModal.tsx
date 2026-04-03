import { useState } from "react";
import { Sparkles, MessageCircle, Dumbbell, FileText, ArrowRight, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
  onStartChat?: () => void;
  onStartExercise?: () => void;
}

const steps = [
  {
    title: "Welcome to GenaAI",
    icon: Sparkles,
    content: (
      <div className="space-y-4">
        <p className="text-slate-600 leading-relaxed">
          GenaAI is your personal AI thinking partner, trained on Gena Gorlin's <strong>builder's mindset</strong> framework.
        </p>
        <p className="text-slate-600 leading-relaxed">
          It's here to help you reflect on your goals, work through challenges, and build deeper self-knowledge — anytime you need it.
        </p>
      </div>
    ),
  },
  {
    title: "Two ways to get started",
    icon: Rocket,
    content: (
      <div className="space-y-5">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h4 className="font-medium text-slate-900 mb-1">Chat</h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              Start a free-form conversation about anything on your mind — a challenge you're facing, a decision to think through, or a goal to clarify.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <Dumbbell className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h4 className="font-medium text-slate-900 mb-1">Exercises</h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              Try a structured exercise for guided self-reflection. Great if you're not sure where to begin — they loosely build on each other, so start with the first one.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h4 className="font-medium text-slate-900 mb-1">Your Document</h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              As you chat, a personal document builds automatically with insights and patterns — no extra effort needed.
            </p>
          </div>
        </div>
      </div>
    ),
  },
];

export function WelcomeModal({ open, onClose, onStartChat, onStartExercise }: WelcomeModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = steps[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="text-xl">{step.title}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="py-2">
          {step.content}
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 py-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all ${
                index === currentStep
                  ? "w-6 bg-primary"
                  : index < currentStep
                  ? "w-1.5 bg-primary/50"
                  : "w-1.5 bg-slate-200"
              }`}
            />
          ))}
        </div>

        {isLastStep ? (
          <div className="space-y-3 pt-2">
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  onClose();
                  onStartExercise?.();
                }}
                className="flex-1"
              >
                <Dumbbell className="h-4 w-4 mr-2" />
                Start an Exercise
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  onStartChat?.();
                }}
                className="flex-1"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Start a Chat
              </Button>
            </div>
            <p className="text-xs text-center text-slate-500">
              Gena may occasionally read chats to improve the AI. Questions anytime? Use <strong>Contact Gena</strong> in the header.
            </p>
          </div>
        ) : (
          <div className="flex gap-2 pt-2">
            {currentStep > 0 && (
              <Button variant="outline" onClick={handleBack} className="flex-1">
                Back
              </Button>
            )}
            <Button onClick={handleNext} className={currentStep === 0 ? "w-full" : "flex-1"}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
