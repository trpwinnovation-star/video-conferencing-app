import { Resend } from "resend";
import path from 'path';
require("dotenv").config({ path: path.join(__dirname, ".env") });
const resend = new Resend(process.env.RESEND_API_KEY);

export const sendRecordingReadyEmail = async (
  toEmail: string,
  roomName: string,
  recordingLink: string
) => {
  try {
    const response = await resend.emails.send({
      from: "Video Conference <onboarding@resend.dev>",
      to: toEmail,
      subject: `Your recording for ${roomName} is ready`,
      html: `
        <h2>Your meeting recording is ready!</h2>

        <p>
          The recording for room <strong>${roomName}</strong>
          has been processed successfully.
        </p>

        <a
          href="${recordingLink}"
          style="
            display:inline-block;
            padding:10px 20px;
            background:#007bff;
            color:white;
            text-decoration:none;
            border-radius:5px;
          "
        >
          View Recording
        </a>

        <p>${recordingLink}</p>
      `,
    });

    console.log("Email sent:", response);

    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
};

export const sendPasswordResetEmail = async (toEmail: string, resetLink: string) => {
  try {
    const response = await resend.emails.send({
      from: "Video Conference <onboarding@resend.dev>",
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
      `,
    });
    console.log("Password reset email sent:", response);
    return true;
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return false;
  }
};


// import nodemailer from "nodemailer";

// const transporter = nodemailer.createTransport({
//   host: "74.125.69.108",
//   port: 587,
//   secure: false,

//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS,
//   },

//   tls: {
//     rejectUnauthorized: false,
//     servername: "smtp.gmail.com",
//   },

//   connectionTimeout: 30000,
//   greetingTimeout: 30000,
//   socketTimeout: 30000,
// });
// export const sendRecordingReadyEmail = async (toEmail: string, roomName: string, recordingLink: string) => {
//   const mailOptions = {
//     from: `"Video Conference App" <${process.env.SMTP_USER || 'your-email@gmail.com'}>`,
//     to: toEmail,
//     subject: `Your recording for ${roomName} is ready`,
//     html: `
//       <h2>Your meeting recording is ready!</h2>
//       <p>The recording for room <strong>${roomName}</strong> has been successfully processed.</p>
//       <p>You can view and download it using the secure link below. This link will expire in 24 hours.</p>
//       <a href="${recordingLink}" style="display:inline-block;padding:10px 20px;background-color:#007bff;color:#ffffff;text-decoration:none;border-radius:5px;">
//         View Recording
//       </a>
//       <p>If the button doesn't work, copy and paste this link into your browser:</p>
//       <p><a href="${recordingLink}">${recordingLink}</a></p>
//       <br />
//       <p>Thanks,<br/>Video Conference Team</p>
//     `,
//   };

//   try {
//     const info = await transporter.sendMail(mailOptions);
//     console.log('Message sent: %s', info.messageId);
//     return true;
//   } catch (error) {
//     console.error('Error sending email:', error);
//     return false;
//   }
// };
