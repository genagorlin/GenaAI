import { useState } from "react";
import { Sparkles, FileText, Smartphone, Shield, ArrowRight, Check } from "lucide-react";
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
}

const steps = [
  {
    title: "Welcome to GenaAI",
    icon: Sparkles,
    content: (
      <div className="space-y-4">
        <p className="text-slate-600 leading-relaxed">
          This app is trained on my (Gena's) "builder's mindset" framework and provides support and thought partnership through that lens.
        </p>
        <p className="text-slate-600 leading-relaxed">
          Start a new conversation anytime, or try a structured <strong>Exercise</strong> to jumpstart your self-reflection. The Exercises loosely build on each other—if you're unsure where to begin, I suggest working through them in order.
        </p>
      </div>
    ),
  },
  {
    title: "How it works",
    icon: FileText,
    content: (
      <div className="space-y-5">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h4 className="font-medium text-slate-900 mb-1">Your Document builds automatically</h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              As you chat, the AI will populate your Document with insights and patterns. You can add to it yourself, but you don't have to.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Smartphone className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-medium text-slate-900 mb-1">Install as an app</h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              On iPhone: open in Safari → tap Share → "Add to Home Screen"
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "One more thing",
    icon: Shield,
    content: (
      <div className="space-y-5">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <Shield className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h4 className="font-medium text-slate-900 mb-1">Privacy note</h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              I (Gena) may occasionally read chats to improve the AI's responses. Let me know if there are threads you'd prefer to keep private.
            </p>
          </div>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-sm text-slate-600">
            Questions or feedback anytime? Use the <strong>"Contact Gena"</strong> button in the app header.
          </p>
        </div>
      </div>
    ),
  },
];

export function WelcomeModal({ open, onClose }: WelcomeModalProps) {
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

        <div className="flex gap-2 pt-2">
          {currentStep > 0 && (
            <Button variant="outline" onClick={handleBack} className="flex-1">
              Back
            </Button>
          )}
          <Button onClick={handleNext} className={currentStep === 0 ? "w-full" : "flex-1"}>
            {isLastStep ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Get Started
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
