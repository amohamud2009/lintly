import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const rawFrom = process.env.RESEND_FROM_EMAIL ?? "noreply@lintly.dev";
  const from = rawFrom.includes("<") ? rawFrom : `Lintly <${rawFrom}>`;

  if (!process.env.RESEND_API_KEY) {
    console.log(`[email-skip] No RESEND_API_KEY — would send to ${to}: ${subject}`);
    return;
  }

  const { data, error } = await getResend().emails.send({ from, to, subject, html });
  if (error) {
    console.error(`[email-error] Failed to send to ${to}:`, error);
    throw new Error(error.message);
  }
  console.log(`[email-sent] to=${to} id=${data?.id}`);
}
