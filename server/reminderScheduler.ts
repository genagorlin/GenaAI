import { storage } from "./storage";
import { sendReminderEmail } from "./reminderEmail";

const SCHEDULER_INTERVAL_MS = 60 * 1000; // Run every minute

/**
 * Calculate the next scheduled time based on the reminder's schedule
 */
function calculateNextScheduledAt(
  scheduleType: string,
  scheduleTime: string, // "09:00"
  scheduleDays: string[] | null, // ["monday", "wednesday"]
  customIntervalDays: number | null,
  timezone: string
): Date {
  const now = new Date();
  const [hours, minutes] = scheduleTime.split(":").map(Number);

  // Create a date in the client's timezone
  // For simplicity, we'll calculate based on UTC and timezone offset
  // A more robust solution would use a library like date-fns-tz

  if (scheduleType === "daily") {
    // Next day at the same time
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(hours, minutes, 0, 0);
    return next;
  }

  if (scheduleType === "weekly" && scheduleDays && scheduleDays.length > 0) {
    // Find the next matching day
    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const scheduledDayNumbers = scheduleDays
      .map(d => dayMap[d.toLowerCase()])
      .filter(d => d !== undefined)
      .sort((a, b) => a - b);

    const currentDay = now.getDay();
    let nextDay: number | null = null;

    // Find the next scheduled day
    for (const day of scheduledDayNumbers) {
      if (day > currentDay) {
        nextDay = day;
        break;
      }
    }

    // If no day found this week, take the first day next week
    if (nextDay === null) {
      nextDay = scheduledDayNumbers[0];
    }

    const daysUntilNext = (nextDay - currentDay + 7) % 7 || 7;
    const next = new Date(now);
    next.setDate(next.getDate() + daysUntilNext);
    next.setHours(hours, minutes, 0, 0);
    return next;
  }

  if (scheduleType === "custom" && customIntervalDays) {
    // Every N days
    const next = new Date(now);
    next.setDate(next.getDate() + customIntervalDays);
    next.setHours(hours, minutes, 0, 0);
    return next;
  }

  // Default: next day
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

/**
 * Calculate days since last active
 */
function getDaysSinceLastActive(lastActive: Date | null): string {
  if (!lastActive) return "unknown";
  const now = new Date();
  const diffMs = now.getTime() - lastActive.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays.toString();
}

/**
 * Process a single due reminder
 */
async function processDueReminder(reminder: any): Promise<void> {
  const { template, client } = reminder;

  console.log(`[Scheduler] Processing reminder ${reminder.id} for client ${client.name}`);

  try {
    // Check if client has email
    if (!client.email) {
      console.log(`[Scheduler] Skipping - client ${client.id} has no email`);
      await storage.createReminderHistory({
        clientReminderId: reminder.id,
        clientId: client.id,
        templateId: template.id,
        subject: reminder.subjectOverride || template.subject,
        body: reminder.bodyOverride || template.body,
        recipientEmail: "none",
        status: "skipped",
        errorMessage: "Client has no email address",
      });
      return;
    }

    // Send the email
    const result = await sendReminderEmail({
      to: client.email,
      subject: reminder.subjectOverride || template.subject,
      body: reminder.bodyOverride || template.body,
      clientName: client.name,
      clientFirstName: client.name.split(" ")[0],
      coachName: "Gena", // Could be made configurable
      lastActiveDate: client.lastActive ? new Date(client.lastActive).toLocaleDateString() : undefined,
      daysSinceLastActive: getDaysSinceLastActive(client.lastActive),
    });

    // Log to history
    await storage.createReminderHistory({
      clientReminderId: reminder.id,
      clientId: client.id,
      templateId: template.id,
      subject: reminder.subjectOverride || template.subject,
      body: reminder.bodyOverride || template.body,
      recipientEmail: client.email,
      status: result.success ? "sent" : "failed",
      errorMessage: result.error || null,
    });

    if (result.success) {
      // Calculate next scheduled time
      const nextScheduledAt = calculateNextScheduledAt(
        reminder.scheduleType,
        reminder.scheduleTime,
        reminder.scheduleDays as string[] | null,
        reminder.customIntervalDays,
        reminder.timezone
      );

      // Update reminder
      await storage.updateClientReminder(reminder.id, {
        lastSentAt: new Date(),
        nextScheduledAt,
      });

      console.log(`[Scheduler] Sent reminder to ${client.email}, next at ${nextScheduledAt.toISOString()}`);
    } else {
      console.error(`[Scheduler] Failed to send reminder to ${client.email}: ${result.error}`);
    }
  } catch (error: any) {
    console.error(`[Scheduler] Error processing reminder ${reminder.id}:`, error);
    await storage.createReminderHistory({
      clientReminderId: reminder.id,
      clientId: client.id,
      templateId: template.id,
      subject: reminder.subjectOverride || template.subject,
      body: reminder.bodyOverride || template.body,
      recipientEmail: client.email || "unknown",
      status: "failed",
      errorMessage: error.message || "Unknown error",
    });
  }
}

/**
 * Main scheduler function - checks for due reminders and processes them
 */
async function runScheduler(): Promise<void> {
  try {
    const dueReminders = await storage.getDueReminders();

    if (dueReminders.length === 0) {
      return;
    }

    console.log(`[Scheduler] Found ${dueReminders.length} due reminder(s)`);

    for (const reminder of dueReminders) {
      await processDueReminder(reminder);
    }
  } catch (error) {
    console.error("[Scheduler] Error running scheduler:", error);
  }
}

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Start the reminder scheduler
 */
export function startReminderScheduler(): void {
  if (schedulerInterval) {
    console.log("[Scheduler] Already running");
    return;
  }

  console.log("[Scheduler] Starting reminder scheduler (interval: 60s)");

  // Run immediately on startup
  runScheduler();

  // Then run every minute
  schedulerInterval = setInterval(runScheduler, SCHEDULER_INTERVAL_MS);
}

/**
 * Stop the reminder scheduler
 */
export function stopReminderScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Scheduler] Stopped reminder scheduler");
  }
}

/**
 * Initialize a newly created reminder with its first scheduled time
 */
export function initializeReminderSchedule(reminder: {
  scheduleType: string;
  scheduleTime: string;
  scheduleDays: string[] | null;
  customIntervalDays: number | null;
  timezone: string;
}): Date {
  return calculateNextScheduledAt(
    reminder.scheduleType,
    reminder.scheduleTime,
    reminder.scheduleDays,
    reminder.customIntervalDays,
    reminder.timezone
  );
}
