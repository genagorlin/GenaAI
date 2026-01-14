import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  Plus,
  Trash2,
  Pause,
  Play,
  Send,
  Loader2,
  Clock,
  Calendar,
  History as HistoryIcon,
  ChevronDown,
  ChevronRight,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface ReminderTemplate {
  id: string;
  title: string;
  subject: string;
  body: string;
  category?: string;
}

interface ClientReminder {
  id: string;
  clientId: string;
  templateId: string;
  scheduleType: string;
  scheduleDays: string[] | null;
  scheduleTime: string;
  customIntervalDays?: number;
  timezone: string;
  isEnabled: number;
  isPaused: number;
  pausedUntil?: string;
  lastSentAt?: string;
  nextScheduledAt?: string;
  template: ReminderTemplate;
}

interface ReminderHistory {
  id: string;
  subject: string;
  status: string;
  sentAt: string;
  errorMessage?: string;
}

interface Client {
  id: string;
  name: string;
  email?: string;
  timezone?: string;
}

const DAYS_OF_WEEK = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
];

const COMMON_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

interface ClientRemindersPanelProps {
  client: Client;
}

export function ClientRemindersPanel({ client }: ClientRemindersPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [newReminder, setNewReminder] = useState({
    templateId: "",
    scheduleType: "weekly",
    scheduleDays: ["monday"] as string[],
    scheduleTime: "09:00",
    customIntervalDays: 7,
    timezone: client.timezone || "America/New_York",
  });

  const queryClient = useQueryClient();

  const { data: reminders = [], isLoading } = useQuery<ClientReminder[]>({
    queryKey: [`/api/coach/clients/${client.id}/reminders`],
    enabled: isOpen,
  });

  const { data: templates = [] } = useQuery<ReminderTemplate[]>({
    queryKey: ["/api/coach/reminder-templates"],
    enabled: isOpen,
  });

  const { data: history = [] } = useQuery<ReminderHistory[]>({
    queryKey: [`/api/coach/clients/${client.id}/reminder-history`],
    enabled: isOpen && showHistory,
  });

  const createReminderMutation = useMutation({
    mutationFn: async (reminder: typeof newReminder) => {
      const res = await fetch(`/api/coach/clients/${client.id}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reminder),
      });
      if (!res.ok) throw new Error("Failed to create reminder");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/coach/clients/${client.id}/reminders`] });
      setShowAddReminder(false);
      setNewReminder({
        templateId: "",
        scheduleType: "weekly",
        scheduleDays: ["monday"],
        scheduleTime: "09:00",
        customIntervalDays: 7,
        timezone: client.timezone || "America/New_York",
      });
      toast.success("Reminder scheduled");
    },
    onError: () => {
      toast.error("Failed to create reminder");
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/coach/reminders/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete reminder");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/coach/clients/${client.id}/reminders`] });
      toast.success("Reminder deleted");
    },
    onError: () => {
      toast.error("Failed to delete reminder");
    },
  });

  const pauseReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/coach/reminders/${id}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to pause reminder");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/coach/clients/${client.id}/reminders`] });
      toast.success("Reminder paused");
    },
    onError: () => {
      toast.error("Failed to pause reminder");
    },
  });

  const resumeReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/coach/reminders/${id}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to resume reminder");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/coach/clients/${client.id}/reminders`] });
      toast.success("Reminder resumed");
    },
    onError: () => {
      toast.error("Failed to resume reminder");
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/coach/reminders/${id}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to send test email");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Test email sent to your inbox");
    },
    onError: () => {
      toast.error("Failed to send test email");
    },
  });

  const formatSchedule = (reminder: ClientReminder) => {
    if (reminder.scheduleType === "daily") {
      return `Daily at ${reminder.scheduleTime}`;
    }
    if (reminder.scheduleType === "weekly") {
      const days = (reminder.scheduleDays || []).map(d =>
        d.charAt(0).toUpperCase() + d.slice(1, 3)
      ).join(", ");
      return `${days} at ${reminder.scheduleTime}`;
    }
    if (reminder.scheduleType === "custom") {
      return `Every ${reminder.customIntervalDays} days at ${reminder.scheduleTime}`;
    }
    return reminder.scheduleType;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const toggleDay = (day: string) => {
    const days = newReminder.scheduleDays;
    if (days.includes(day)) {
      if (days.length > 1) {
        setNewReminder({ ...newReminder, scheduleDays: days.filter(d => d !== day) });
      }
    } else {
      setNewReminder({ ...newReminder, scheduleDays: [...days, day] });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Mail className="h-4 w-4" />
          Reminders
          {reminders.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {reminders.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Reminders for {client.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add New Reminder */}
          <Collapsible open={showAddReminder} onOpenChange={setShowAddReminder}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Reminder
                </span>
                {showAddReminder ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="space-y-4 border rounded-lg p-4">
                <div>
                  <Label>Template</Label>
                  <Select
                    value={newReminder.templateId}
                    onValueChange={(v) => setNewReminder({ ...newReminder, templateId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Schedule</Label>
                  <Select
                    value={newReminder.scheduleType}
                    onValueChange={(v) => setNewReminder({ ...newReminder, scheduleType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="custom">Custom Interval</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newReminder.scheduleType === "weekly" && (
                  <div>
                    <Label>Days</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {DAYS_OF_WEEK.map(day => (
                        <label
                          key={day.value}
                          className="flex items-center gap-1 cursor-pointer"
                        >
                          <Checkbox
                            checked={newReminder.scheduleDays.includes(day.value)}
                            onCheckedChange={() => toggleDay(day.value)}
                          />
                          <span className="text-sm">{day.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {newReminder.scheduleType === "custom" && (
                  <div>
                    <Label>Every N days</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newReminder.customIntervalDays}
                      onChange={(e) => setNewReminder({
                        ...newReminder,
                        customIntervalDays: parseInt(e.target.value) || 7
                      })}
                    />
                  </div>
                )}

                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={newReminder.scheduleTime}
                    onChange={(e) => setNewReminder({ ...newReminder, scheduleTime: e.target.value })}
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    Timezone
                  </Label>
                  <Select
                    value={newReminder.timezone}
                    onValueChange={(v) => setNewReminder({ ...newReminder, timezone: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_TIMEZONES.map(tz => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={() => createReminderMutation.mutate(newReminder)}
                  disabled={!newReminder.templateId || createReminderMutation.isPending}
                  className="w-full"
                >
                  {createReminderMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : null}
                  Schedule Reminder
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Active Reminders */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : reminders.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <Mail className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No reminders scheduled</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className={`border rounded-lg p-3 ${
                    reminder.isPaused ? "bg-slate-50 dark:bg-slate-900 opacity-75" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{reminder.template.title}</h4>
                        {reminder.isPaused ? (
                          <Badge variant="outline" className="text-xs">Paused</Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Clock className="h-3 w-3" />
                        {formatSchedule(reminder)}
                      </div>
                      {reminder.nextScheduledAt && !reminder.isPaused && (
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                          <Calendar className="h-3 w-3" />
                          Next: {formatDate(reminder.nextScheduledAt)}
                        </div>
                      )}
                      {reminder.lastSentAt && (
                        <div className="text-xs text-slate-400 mt-1">
                          Last sent: {formatDate(reminder.lastSentAt)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => sendTestMutation.mutate(reminder.id)}
                        disabled={sendTestMutation.isPending}
                        className="h-8 w-8 p-0"
                        title="Send test email"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      {reminder.isPaused ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resumeReminderMutation.mutate(reminder.id)}
                          className="h-8 w-8 p-0"
                          title="Resume"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => pauseReminderMutation.mutate(reminder.id)}
                          className="h-8 w-8 p-0"
                          title="Pause"
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
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
                            <AlertDialogTitle>Delete Reminder</AlertDialogTitle>
                            <AlertDialogDescription>
                              Remove this scheduled reminder? This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteReminderMutation.mutate(reminder.id)}
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
          )}

          {/* History Toggle */}
          <Collapsible open={showHistory} onOpenChange={setShowHistory}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-slate-500">
                <span className="flex items-center gap-2">
                  <HistoryIcon className="h-4 w-4" />
                  Sent History
                </span>
                {showHistory ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              {history.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-4">
                  No emails sent yet
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {history.slice(0, 10).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between text-sm border-b pb-2"
                    >
                      <div className="flex-1 truncate">
                        <p className="truncate">{entry.subject}</p>
                        <p className="text-xs text-slate-400">
                          {formatDate(entry.sentAt)}
                        </p>
                      </div>
                      <Badge
                        variant={entry.status === "sent" ? "default" : "destructive"}
                        className="text-xs ml-2"
                      >
                        {entry.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DialogContent>
    </Dialog>
  );
}
