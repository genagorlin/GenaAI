import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendReminderEmailParams {
  to: string;
  subject: string;
  body: string;
  clientName: string;
  coachName?: string;
  clientFirstName?: string;
  lastActiveDate?: string;
  daysSinceLastActive?: string;
}

/**
 * Replace template variables with actual values
 */
function replaceVariables(template: string, params: SendReminderEmailParams): string {
  const variables: Record<string, string> = {
    clientName: params.clientName,
    clientFirstName: params.clientFirstName || params.clientName.split(" ")[0],
    coachName: params.coachName || "Your Coach",
    lastActiveDate: params.lastActiveDate || "recently",
    daysSinceLastActive: params.daysSinceLastActive || "a few",
  };

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, value);
  }
  return result;
}

/**
 * Send a reminder email to a client
 */
export async function sendReminderEmail(params: SendReminderEmailParams): Promise<{ success: boolean; error?: string }> {
  const emailFrom = process.env.EMAIL_FROM || "onboarding@resend.dev";

  // Replace variables in subject and body
  const subject = replaceVariables(params.subject, params);
  const body = replaceVariables(params.body, params);

  console.log("[Reminder] Sending email to:", params.to);
  console.log("[Reminder] Subject:", subject);

  try {
    const result = await resend.emails.send({
      from: emailFrom,
      to: params.to,
      subject: subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${body.split('\n').map(line =>
            line.trim() ? `<p style="color: #333; margin-bottom: 16px; line-height: 1.6;">${line}</p>` : ''
          ).join('')}

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

          <p style="color: #999; font-size: 12px;">
            This is an automated reminder from GenaAI. If you'd like to adjust your reminder preferences, please contact your coach.
          </p>
        </div>
      `,
    });

    console.log("[Reminder] Email sent successfully:", result);
    return { success: true };
  } catch (error: any) {
    console.error("[Reminder] Failed to send email:", error);
    return { success: false, error: error.message || "Failed to send email" };
  }
}
