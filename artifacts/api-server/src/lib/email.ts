import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
const user = process.env.SMTP_USER ?? "";
const pass = process.env.SMTP_PASS ?? "";
const from = process.env.SMTP_FROM ?? user;

export const emailConfigured = Boolean(user && pass);

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

export async function sendForgotPasswordEmail(opts: {
  to: string;
  username: string;
  tempPassword: string;
}): Promise<void> {
  const appName = "Maintenance Tracker";
  await transporter.sendMail({
    from: `"${appName}" <${from}>`,
    to: opts.to,
    subject: `${appName} — Account Recovery`,
    text: [
      `Hi,`,
      ``,
      `Someone requested account recovery for the ${appName} app.`,
      ``,
      `Username:          ${opts.username}`,
      `Temporary Password: ${opts.tempPassword}`,
      ``,
      `Sign in with the temporary password above, then update your password from your profile settings.`,
      ``,
      `If you did not request this, you can ignore this email — no changes were made until you sign in.`,
    ].join("\n"),
  });
}
