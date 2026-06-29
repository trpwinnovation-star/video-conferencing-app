import nodemailer from "nodemailer";
import path from 'path';
require("dotenv").config({ path: path.join(__dirname, ".env") });

// --- RESEND CONFIG (COMMENTED OUT) ---
// import { Resend } from "resend";
// const resend = new Resend(process.env.RESEND_API_KEY);

const SENDER_EMAIL = process.env.SMTP_USER || "trpwinnovation@gmail.com";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: SENDER_EMAIL,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
    servername: "smtp.gmail.com",
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
});

export const sendRecordingReadyEmail = async (
  toEmail: string,
  roomName: string,
  recordingLink: string
) => {
  const mailOptions = {
    from: `"BetelMeet" <${SENDER_EMAIL}>`,
    to: toEmail,
    subject: `Your recording for ${roomName} is ready`,
    html: `
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
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Recording ready email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending recording ready email:', error);
    return false;
  }
};

export const sendPasswordResetEmail = async (toEmail: string, resetLink: string) => {
  const mailOptions = {
    from: `"BetelMeet" <${SENDER_EMAIL}>`,
    to: toEmail,
    subject: "Password Reset Request",
    html: `
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
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
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

    const mailOptions = {
      from: `"BetelMeet" <${SENDER_EMAIL}>`,
      to: toEmail,
      subject: `Meeting Invite: ${title}`,
      html: `
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
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Meeting invite email sent to:", toEmail, info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending meeting invite email:", error);
    return false;
  }
};
