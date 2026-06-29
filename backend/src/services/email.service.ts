import path from 'path';
require("dotenv").config({ path: path.join(__dirname, ".env") });

const SENDER_EMAIL = process.env.SMTP_USER || "trpwinnovation@gmail.com";

const sendEmailViaBrevo = async (toEmail: string, subject: string, htmlContent: string) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("BREVO_API_KEY is not defined in environment variables");
    return false;
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { name: "BetelMeet", email: SENDER_EMAIL },
        to: [{ email: toEmail }],
        subject: subject,
        htmlContent: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Brevo API Error:", response.status, errorData);
      return false;
    }

    const data = await response.json();
    console.log("Email sent successfully via Brevo HTTP API to:", toEmail, "MessageId:", data.messageId);
    return true;
  } catch (error) {
    console.error("Error sending email via Brevo HTTP API:", error);
    return false;
  }
};

export const sendRecordingReadyEmail = async (
  toEmail: string,
  roomName: string,
  recordingLink: string
) => {
  const subject = `Your recording for ${roomName} is ready`;
  const htmlContent = `
    <h2>Your meeting recording is ready!</h2>
    <p>The recording for room <strong>${roomName}</strong> has been processed successfully.</p>
    <p>You can view and download it using the secure link below. This link will expire in 24 hours.</p>
    <a href="${recordingLink}" style="display:inline-block;padding:10px 20px;background-color:#c16d18;color:#ffffff;text-decoration:none;border-radius:5px;font-weight:bold;">
      View Recording
    </a>
    <p>If the button doesn't work, copy and paste this link into your browser:</p>
    <p><a href="${recordingLink}" style="color:#c16d18;">${recordingLink}</a></p>
    <br />
    <p>Thanks,<br/>BetelMeet Team</p>
  `;

  return await sendEmailViaBrevo(toEmail, subject, htmlContent);
};

export const sendPasswordResetEmail = async (toEmail: string, resetLink: string) => {
  const subject = "Password Reset Request";
  const htmlContent = `
    <h2>Password Reset</h2>
    <p>You requested a password reset. Click the button below to reset your password. This link expires in 15 minutes.</p>
    <a
      href="${resetLink}"
      style="display:inline-block;padding:10px 20px;background:#c16d18;color:white;text-decoration:none;border-radius:5px;font-weight:bold;"
    >
      Reset Password
    </a>
    <p>If you didn't request this, you can safely ignore this email.</p>
    <br />
    <p>Thanks,<br/>BetelMeet Team</p>
  `;

  return await sendEmailViaBrevo(toEmail, subject, htmlContent);
};

export const sendMeetingInviteEmail = async (
  toEmail: string,
  hostName: string,
  title: string,
  description: string,
  password: string,
  scheduledTime: Date,
  meetingLink: string
) => {
  try {
    const dateObj = new Date(scheduledTime);
    const istTime = dateObj.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit'
    }) + ' IST';

    const utcTime = dateObj.toLocaleString('en-US', {
      timeZone: 'UTC',
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit'
    }) + ' UTC';

    const subject = `Meeting Invite: ${title}`;
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #c16d18;">You've been invited to a meeting!</h2>
        <p><strong>${hostName}</strong> has invited you to join a scheduled video meeting.</p>
        
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-size: 18px;"><strong>${title}</strong></p>
          ${description ? `<p style="margin: 0 0 15px 0; color: #666;">${description}</p>` : ''}
          
          <p style="margin: 5px 0;"><strong>Time (IST):</strong> ${istTime}</p>
          <p style="margin: 5px 0; color: #666;"><strong>Time (UTC):</strong> ${utcTime}</p>
          <p style="margin: 15px 0 5px 0;"><strong>Password:</strong> ${password}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a
            href="${meetingLink}"
            style="display: inline-block; padding: 12px 24px; background-color: #c16d18; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;"
          >
            Join Meeting
          </a>
        </div>

        <p style="font-size: 14px; color: #777;">
          If the button doesn't work, you can copy and paste this link into your browser:<br/>
          <a href="${meetingLink}" style="color: #c16d18;">${meetingLink}</a>
        </p>
      </div>
    `;

    return await sendEmailViaBrevo(toEmail, subject, htmlContent);
  } catch (error) {
    console.error("Error formatting meeting invite email:", error);
    return false;
  }
};
