import { ENV } from "./env";

/**
 * Outbound email, behind a transport so the app has no hard dependency on a
 * provider. With no API key configured, mail is logged to the console — which
 * is what you want in development, and is an honest failure mode rather than a
 * silent drop.
 */

export type Mail = {
  to: string;
  subject: string;
  text: string;
};

async function sendViaResend(mail: Mail): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: ENV.mailFrom,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Resend rejected the message (${response.status}): ${await response.text()}`
    );
  }
}

function logToConsole(mail: Mail): void {
  console.log(
    [
      "",
      "  ┌─ email (no provider configured, not actually sent) ─",
      `  │ to:      ${mail.to}`,
      `  │ subject: ${mail.subject}`,
      "  │",
      ...mail.text.split("\n").map(line => `  │ ${line}`),
      "  └──",
      "",
    ].join("\n")
  );
}

export async function sendMail(mail: Mail): Promise<void> {
  if (!ENV.resendApiKey) {
    logToConsole(mail);
    return;
  }
  await sendViaResend(mail);
}

export function passwordResetEmail(
  resetUrl: string
): Pick<Mail, "subject" | "text"> {
  return {
    subject: "Reset your Writing Assistant password",
    text: [
      "Someone asked to reset the password on this account.",
      "",
      "Open this link to choose a new one:",
      resetUrl,
      "",
      "The link works once and expires in an hour.",
      "If this wasn't you, ignore this email — nothing has changed.",
    ].join("\n"),
  };
}
