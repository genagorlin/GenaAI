import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface MentionNotificationParams {
  clientName: string;
  clientId: string;
  threadId: string;
  messagePreview: string;
}

/**
 * Send an email notification to the coach when a client mentions them
 */
export async function sendMentionNotification(params: MentionNotificationParams): Promise<void> {
  const coachEmail = process.env.COACH_EMAIL || "gena.gorlin@gmail.com";
  const emailFrom = process.env.EMAIL_FROM || "onboarding@resend.dev";
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  const chatLink = `${appUrl}/coach`;

  // Truncate message preview to a reasonable length
  const preview = params.messagePreview.length > 300
    ? params.messagePreview.slice(0, 300) + "..."
    : params.messagePreview;

  try {
    await resend.emails.send({
      from: emailFrom,
      to: coachEmail,
      subject: `${params.clientName} mentioned you in GenaAI`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p style="color: #333; margin-bottom: 16px; line-height: 1.6;">
            <strong>${params.clientName}</strong> tagged you in a conversation:
          </p>

          <div style="background: #f8f9fa; border-left: 3px solid #6366f1; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
            <p style="color: #555; margin: 0; line-height: 1.6; font-style: italic;">
              "${preview}"
            </p>
          </div>

          <a href="${chatLink}" style="display: inline-block; background: #6366f1; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">
            View in Dashboard
          </a>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

          <p style="color: #999; font-size: 12px;">
            This notification was sent because a client used @gena or @coach in their message.
          </p>
        </div>
      `,
    });

    console.log(`[Mention] Email notification sent to ${coachEmail} for mention by ${params.clientName}`);
  } catch (error: any) {
    console.error(`[Mention] Failed to send email notification:`, error.message || error);
  }
}
