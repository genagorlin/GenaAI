import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  Eye,
  Users,
  ArrowLeft,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

interface ReminderTemplate {
  id: string;
  title: string;
  subject: string;
  body: string;
  category?: string;
  isActive: number;
  sortOrder: number;
}

interface Client {
  id: string;
  name: string;
  email?: string;
}

interface ClientReminder {
  id: string;
  clientId: string;
  templateId: string;
  client: Client;
}

const TEMPLATE_VARIABLES = [
  { name: "{{clientName}}", description: "Client's full name" },
  { name: "{{clientFirstName}}", description: "Client's first name only" },
  { name: "{{coachName}}", description: "Your name as coach" },
  { name: "{{lastActiveDate}}", description: "Date of last activity" },
  { name: "{{daysSinceLastActive}}", description: "Days since last active" },
];

type ViewMode = "list" | "edit" | "clients";

export function ReminderManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingTemplate, setEditingTemplate] = useState<ReminderTemplate | null>(null);
  const [viewingTemplateClients, setViewingTemplateClients] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    title: "",
    subject: "",
    body: "",
    category: ""
  });
  const [previewData, setPreviewData] = useState<{ subject: string; body: string } | null>(null);

  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery<ReminderTemplate[]>({
    queryKey: ["/api/coach/reminder-templates"],
    enabled: isOpen,
  });

  const { data: templateClients = [] } = useQuery<ClientReminder[]>({
    queryKey: [`/api/coach/reminder-templates/${viewingTemplateClients}/clients`],
    enabled: !!viewingTemplateClients,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (template: typeof newTemplate) => {
      const res = await fetch("/api/coach/reminder-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });
      if (!res.ok) throw new Error("Failed to create template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/reminder-templates"] });
      setIsCreating(false);
      setNewTemplate({ title: "", subject: "", body: "", category: "" });
      toast.success("Template created");
    },
    onError: () => {
      toast.error("Failed to create template");
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ReminderTemplate> & { id: string }) => {
      const res = await fetch(`/api/coach/reminder-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/reminder-templates"] });
      setEditingTemplate(null);
      setViewMode("list");
      toast.success("Template updated");
    },
    onError: () => {
      toast.error("Failed to update template");
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/coach/reminder-templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete template");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/reminder-templates"] });
      toast.success("Template deleted");
    },
    onError: () => {
      toast.error("Failed to delete template");
    },
  });

  const previewTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/coach/reminder-templates/${id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to preview template");
      return res.json();
    },
    onSuccess: (data) => {
      setPreviewData(data);
    },
    onError: () => {
      toast.error("Failed to preview template");
    },
  });

  const handleStartEdit = (template: ReminderTemplate) => {
    setEditingTemplate({ ...template });
    setViewMode("edit");
  };

  const handleSaveEdit = () => {
    if (!editingTemplate) return;
    updateTemplateMutation.mutate(editingTemplate);
  };

  const handleViewClients = (templateId: string) => {
    setViewingTemplateClients(templateId);
    setViewMode("clients");
  };

  const renderVariableReference = () => (
    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Info className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Available Variables
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {TEMPLATE_VARIABLES.map(v => (
          <TooltipProvider key={v.name}>
            <Tooltip>
              <TooltipTrigger asChild>
                <code className="bg-white dark:bg-slate-800 px-2 py-1 rounded text-purple-600 dark:text-purple-400 cursor-help">
                  {v.name}
                </code>
              </TooltipTrigger>
              <TooltipContent>
                <p>{v.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );

  const renderListView = () => (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Reminder Templates</h3>
        <Button
          size="sm"
          onClick={() => setIsCreating(true)}
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {isCreating && (
        <div className="border rounded-lg p-4 mb-4 bg-slate-50 dark:bg-slate-900">
          <h4 className="font-medium mb-3">New Reminder Template</h4>
          {renderVariableReference()}
          <div className="space-y-3">
            <div>
              <Label>Title (internal name)</Label>
              <Input
                value={newTemplate.title}
                onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })}
                placeholder="e.g., Weekly Check-in"
              />
            </div>
            <div>
              <Label>Email Subject</Label>
              <Input
                value={newTemplate.subject}
                onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                placeholder="e.g., Hi {{clientFirstName}}, time for a check-in!"
              />
            </div>
            <div>
              <Label>Email Body</Label>
              <Textarea
                value={newTemplate.body}
                onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
                placeholder="Write your reminder message here. Use variables like {{clientName}} for personalization."
                rows={6}
              />
            </div>
            <div>
              <Label>Category (optional)</Label>
              <Input
                value={newTemplate.category}
                onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                placeholder="e.g., Check-ins, Motivation, etc."
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => createTemplateMutation.mutate(newTemplate)}
                disabled={!newTemplate.title || !newTemplate.subject || !newTemplate.body || createTemplateMutation.isPending}
              >
                {createTemplateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Create Template
              </Button>
              <Button variant="ghost" onClick={() => {
                setIsCreating(false);
                setNewTemplate({ title: "", subject: "", body: "", category: "" });
              }}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Mail className="h-12 w-12 mx-auto mb-2 opacity-30" />
          <p>No reminder templates yet</p>
          <p className="text-sm">Create your first template to start sending reminders to clients.</p>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{template.title}</h4>
                      {template.category && (
                        <Badge variant="secondary" className="text-xs">
                          {template.category}
                        </Badge>
                      )}
                      {!template.isActive && (
                        <Badge variant="outline" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-1">
                      Subject: {template.subject}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => previewTemplateMutation.mutate(template.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewClients(template.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(template)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Template</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will delete the template and all reminders using it. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteTemplateMutation.mutate(template.id)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {previewData && (
        <Dialog open={!!previewData} onOpenChange={() => setPreviewData(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Email Preview</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-slate-500">Subject</Label>
                <p className="font-medium">{previewData.subject}</p>
              </div>
              <div>
                <Label className="text-slate-500">Body</Label>
                <div className="mt-1 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg whitespace-pre-wrap">
                  {previewData.body}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );

  const renderEditView = () => {
    if (!editingTemplate) return null;

    return (
      <>
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingTemplate(null);
              setViewMode("list");
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h3 className="text-lg font-medium">Edit Template</h3>
        </div>

        {renderVariableReference()}

        <div className="space-y-4">
          <div>
            <Label>Title (internal name)</Label>
            <Input
              value={editingTemplate.title}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
            />
          </div>
          <div>
            <Label>Email Subject</Label>
            <Input
              value={editingTemplate.subject}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
            />
          </div>
          <div>
            <Label>Email Body</Label>
            <Textarea
              value={editingTemplate.body}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
              rows={8}
            />
          </div>
          <div>
            <Label>Category (optional)</Label>
            <Input
              value={editingTemplate.category || ""}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSaveEdit}
              disabled={updateTemplateMutation.isPending}
            >
              {updateTemplateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save Changes
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setEditingTemplate(null);
                setViewMode("list");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </>
    );
  };

  const renderClientsView = () => {
    const template = templates.find(t => t.id === viewingTemplateClients);

    return (
      <>
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setViewingTemplateClients(null);
              setViewMode("list");
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h3 className="text-lg font-medium">
            Clients Using: {template?.title}
          </h3>
        </div>

        {templateClients.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>No clients assigned to this template</p>
            <p className="text-sm mt-1">
              Assign this template to clients from their profile page.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {templateClients.map((assignment) => (
                <div
                  key={assignment.id}
                  className="border rounded-lg p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{assignment.client.name}</p>
                    <p className="text-sm text-slate-500">{assignment.client.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Mail className="h-4 w-4" />
          Email Reminders
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Reminder Templates
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto">
          {viewMode === "list" && renderListView()}
          {viewMode === "edit" && renderEditView()}
          {viewMode === "clients" && renderClientsView()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
