import { ShieldX, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center" data-testid="unauthorized-card">
        <CardHeader className="space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <ShieldX className="w-8 h-8 text-amber-600" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-unauthorized-title">
            Access Not Authorized
          </CardTitle>
          <CardDescription className="text-base" data-testid="text-unauthorized-description">
            Your account is not currently approved to access GenaGPT.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-slate-50 rounded-lg p-4 text-left">
            <p className="text-sm text-muted-foreground mb-3">
              To request access, please contact:
            </p>
            <a 
              href="mailto:gena.gorlin@gmail.com"
              className="flex items-center gap-2 text-primary hover:underline font-medium"
              data-testid="link-contact-email"
            >
              <Mail className="w-4 h-4" />
              gena.gorlin@gmail.com
            </a>
          </div>
          
          <div className="flex flex-col gap-3">
            <Button 
              variant="outline" 
              onClick={() => window.location.href = "/"}
              className="w-full"
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
