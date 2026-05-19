import nodemailer from 'nodemailer';

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'your-email@gmail.com',
    pass: process.env.SMTP_PASS || 'your-app-password',
  },
});

export const sendRecordingReadyEmail = async (toEmail: string, roomName: string, recordingLink: string) => {
  const mailOptions = {
    from: `"Video Conference App" <${process.env.SMTP_USER || 'your-email@gmail.com'}>`,
    to: toEmail,
    subject: `Your recording for ${roomName} is ready`,
    html: `
      <h2>Your meeting recording is ready!</h2>
      <p>The recording for room <strong>${roomName}</strong> has been successfully processed.</p>
      <p>You can view and download it using the secure link below. This link will expire in 24 hours.</p>
      <a href="${recordingLink}" style="display:inline-block;padding:10px 20px;background-color:#007bff;color:#ffffff;text-decoration:none;border-radius:5px;">
        View Recording
      </a>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p><a href="${recordingLink}">${recordingLink}</a></p>
      <br />
      <p>Thanks,<br/>Video Conference Team</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};
