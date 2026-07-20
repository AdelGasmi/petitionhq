import twilio from "twilio";

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio is not configured.");
  return twilio(sid, token);
}

export async function sendVerificationCall(to: string, code: string): Promise<void> {
  const client = getClient();
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error("TWILIO_PHONE_NUMBER is not set.");

  const digits = code.split("").join(". ");
  const twiml = `
    <Response>
      <Say voice="alice">
        Hello. Your petitionhq.us verification code is: ${digits}.
        I repeat: ${digits}.
        This code expires in 10 minutes.
      </Say>
    </Response>
  `.trim();

  await client.calls.create({ to, from, twiml });
}

export async function sendVerificationSms(to: string, code: string): Promise<void> {
  const client = getClient();
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error("TWILIO_PHONE_NUMBER is not set.");

  await client.messages.create({
    to,
    from,
    body: `Your petitionhq.us verification code is ${code}. It expires in 10 minutes. Do not share this code.`,
  });
}

export function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}
