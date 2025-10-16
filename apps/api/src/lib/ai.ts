import { z } from "zod";

interface BaseAddress {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
}

interface AppointmentSummary {
  when: string;
  services: string[];
  notes?: string | null;
  rescheduleUrl: string;
  reason: "requested" | "rescheduled" | "reminder";
  reminderWindowHours?: number;
  address: BaseAddress;
  contactName: string;
}

interface QuoteSummary {
  customerName: string;
  services: string[];
  total: number;
  depositDue: number;
  balanceDue: number;
  shareUrl: string;
  expiresAtIso?: string | null;
  notes?: string | null;
  reason: "sent" | "accepted" | "declined";
}

export interface NotificationCopy {
  emailSubject?: string;
  emailBody?: string;
  smsBody?: string;
}

const CopySchema = z.object({
  email_subject: z.string().min(3).max(120).optional(),
  email_body: z.string().min(3).max(1200).optional(),
  sms_body: z.string().min(3).max(320).optional()
});

function getOpenAIConfig() {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    return null;
  }

  const configuredModel = process.env["OPENAI_MODEL"];
  const model = configuredModel && configuredModel.trim().length > 0 ? configuredModel.trim() : "gpt-5-mini";

  return { apiKey, model };
}

async function callOpenAI({
  apiKey,
  model,
  systemPrompt,
  userPrompt
}: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<NotificationCopy | null> {
  async function request(targetModel: string) {
    return fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "notification_copy",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                email_subject: { type: "string" },
                email_body: { type: "string" },
                sms_body: { type: "string" }
              }
            }
          }
        }
      })
    });
  }

  let response = await request(model);

  if (!response.ok) {
    const status = response.status;
    const bodyText = await response.text().catch(() => "");
    const isDev = process.env["NODE_ENV"] !== "production";
    if (isDev && (status === 400 || status === 404)) {
      response = await request("gpt-4.1");
      if (!response.ok) {
        console.warn("[ai] openai.fallback_failed", { model, status, bodyText });
        return null;
      }
    } else {
      console.warn("[ai] openai.request_failed", { model, status, bodyText });
      return null;
    }
  }

  try {
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      return null;
    }

    const parsed = CopySchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.warn("[ai] copy.parse_failed", { issues: parsed.error.issues });
      return null;
    }

    const result = parsed.data;
    return {
      emailSubject: result.email_subject?.trim(),
      emailBody: result.email_body?.trim(),
      smsBody: result.sms_body?.trim()
    };
  } catch (error) {
    console.warn("[ai] copy.response_error", { error: String(error) });
    return null;
  }
}

export async function generateEstimateNotificationCopy(
  summary: AppointmentSummary
): Promise<NotificationCopy | null> {
  const config = getOpenAIConfig();
  if (!config) {
    return null;
  }

  const systemPrompt = `You are Myst Assist, writing short, on-brand customer notifications for Myst Pressure Washing.
Constraints:
- Tone: friendly, confident, concise, service-focused. No emojis.
- Always mention Myst Pressure Washing once.
- Include the confirmed time window using natural language.
- Emphasize plant-safe, insured service in one sentence when appropriate.
- SMS must be <= 320 characters.
- Email body should be <= 900 characters and include a clear CTA URL when provided.
- Always include the reschedule link literally when given.
- Respond ONLY as JSON with keys: email_subject, email_body, sms_body.`;

  const {
    when,
    services,
    notes,
    rescheduleUrl,
    reason,
    reminderWindowHours,
    address,
    contactName
  } = summary;

  const servicesText = services.length ? services.join(", ") : "Exterior cleaning";
  const lines = [
    `Recipient: ${contactName}`,
    `Appointment time: ${when}`,
    `Services: ${servicesText}`,
    `Address: ${address.line1}, ${address.city}, ${address.state} ${address.postalCode}`,
    `Reason: ${reason}`,
    reminderWindowHours ? `Reminder window hours: ${reminderWindowHours}` : null,
    notes ? `Customer notes: ${notes}` : null,
    `Reschedule link: ${rescheduleUrl}`
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  const userPrompt = `Create an email subject, email body, and SMS body for this customer notification.\n${lines}`;

  return callOpenAI({ apiKey: config.apiKey, model: config.model, systemPrompt, userPrompt });
}

export async function generateQuoteNotificationCopy(summary: QuoteSummary): Promise<NotificationCopy | null> {
  const config = getOpenAIConfig();
  if (!config) {
    return null;
  }

  const systemPrompt = `You are Myst Assist, crafting short, on-brand communications for Myst Pressure Washing quotes.
Constraints:
- Tone: confident, courteous, transparent. No emojis.
- Mention "Myst Pressure Washing" once.
- Include the share link exactly as provided.
- Highlight the service mix and total value; reference deposit/balance in a single sentence.
- If the quote is accepted, outline next steps briefly. If declined, invite feedback.
- Keep email body under 600 characters and SMS under 240 characters.
- Respond ONLY as JSON with keys: email_subject, email_body, sms_body.`;

  const {
    customerName,
    services,
    total,
    depositDue,
    balanceDue,
    shareUrl,
    expiresAtIso,
    notes,
    reason
  } = summary;

  const serviceText = services.length ? services.join(", ") : "Exterior cleaning services";
  const expiresText = expiresAtIso ? `Quote expires ${expiresAtIso}` : "Quote does not expire yet";

  const userPrompt = [
    `Customer: ${customerName}`,
    `Services: ${serviceText}`,
    `Total: $${total.toFixed(2)}`,
    `Deposit due: $${depositDue.toFixed(2)}`,
    `Balance due: $${balanceDue.toFixed(2)}`,
    `Share link: ${shareUrl}`,
    expiresText,
    notes ? `Internal notes: ${notes}` : null,
    `Reason: ${reason}`
  ]
    .filter(Boolean)
    .join("\n");

  return callOpenAI({ apiKey: config.apiKey, model: config.model, systemPrompt, userPrompt });
}
