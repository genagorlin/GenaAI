import { useLocation } from "wouter";
import { ShieldX, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ClientAccessDenied() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split('?')[1] || '');
  const reason = params.get('reason');

  const getMessage = () => {
    switch (reason) {
      case 'not-found':
        return {
          title: "Client Not Found",
          description: "This client account doesn't exist. Please contact your coach to get the correct link."
        };
      case 'email-mismatch':
        return {
          title: "Email Doesn't Match",
          description: "The email you logged in with doesn't match the email associated with this client account. Please log in with the correct email address."
        };
      default:
        return {
          title: "Access Denied",
          description: "You don't have permission to access this page. Please contact your coach if you believe this is an error."
        };
    }
  };

  const { title, description } = getMessage();

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldX className="w-8 h-8 text-red-600" />
        </div>
        
        <h1 className="text-2xl font-semibold text-slate-900 mb-3" data-testid="text-access-denied-title">
          {title}
        </h1>
        
        <p className="text-slate-600 mb-6" data-testid="text-access-denied-description">
          {description}
        </p>

        {reason === 'email-mismatch' && (
          <Button
            onClick={() => window.location.href = '/api/logout'}
            className="w-full mb-3"
            data-testid="button-try-different-account"
          >
            Try a Different Account
          </Button>
        )}

        <Button
          variant="outline"
          onClick={() => window.location.href = '/'}
          className="w-full"
          data-testid="button-go-home"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go to Home
        </Button>
      </div>
    </div>
  );
}
