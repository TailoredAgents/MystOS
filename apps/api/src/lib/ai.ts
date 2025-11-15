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

export interface ScheduleSuggestion {
  window: string;
  reasoning: string;
  startAtIso?: string | null;
}

export interface ScheduleSuggestionContext {
  targetAddress: BaseAddress;
  durationMinutes: number;
  upcoming: Array<{
    startAtIso: string;
    durationMinutes: number | null;
    address: BaseAddress;
    distanceMiles?: number | null;
  }>;
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
    return fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: targetModel,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_output_tokens: 600,
        reasoning: { effort: "low" },
        text: {
          verbosity: "medium",
          format: {
            type: "json_schema",
            name: "notification_copy",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                email_subject: { type: "string" },
                email_body: { type: "string" },
                sms_body: { type: "string" }
              },
              required: []
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
    if (isDev && (status === 400 || status === 404) && model !== "gpt-5") {
      response = await request("gpt-5");
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
      output?: Array<{
        type?: string;
        content?: Array<{ type?: string; text?: string }>;
      }>;
    };

    const raw =
      data.output
        ?.flatMap((item) => item.content ?? [])
        .find((contentItem) => typeof contentItem.text === "string")
        ?.text ?? null;
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

export async function generateScheduleSuggestions(
  context: ScheduleSuggestionContext
): Promise<ScheduleSuggestion[] | null> {
  const config = getOpenAIConfig();
  if (!config) {
    return null;
  }

  const systemPrompt = `You are Myst Assist, a routing-savvy scheduling helper. Recommend the top 3 time windows for booking a new pressure washing job.
Guidelines:
- Prefer windows near existing jobs on the same day to minimize drive time.
- Consider appointment durations when mentioning available gaps.
- Reference the day of week, date, and a concise time window (e.g., "Tue, Nov 18 · 1:00-3:00 PM").
- Provide one short sentence of reasoning ("already near Maple St, only 4 mi away").
- Each suggestion must include a concrete ISO8601 start timestamp (start_iso) in America/New_York time; estimate a reasonable start time when suggesting a window.
- If there are not enough nearby jobs, suggest generally available windows and explain the limitation.
- Respond ONLY as JSON with a 'suggestions' array (max 3 items). Each suggestion has 'window', 'reasoning', and 'start_iso' strings.`;

  const upcomingText =
    context.upcoming.length > 0
      ? context.upcoming
          .map((appt) => {
            const start = new Date(appt.startAtIso).toLocaleString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit"
            });
            const duration = appt.durationMinutes ? `${appt.durationMinutes} min` : "duration unknown";
            const distance =
              typeof appt.distanceMiles === "number"
                ? `${appt.distanceMiles.toFixed(1)} mi away`
                : "distance unknown";
            const addressLine = `${appt.address.line1}, ${appt.address.city}, ${appt.address.state} ${appt.address.postalCode}`;
            return `- ${start} (${duration}) at ${addressLine} | ${distance}`;
          })
          .join("\n")
      : "No upcoming appointments.";

  const userPromptLines = [
    `New job address: ${context.targetAddress.line1}, ${context.targetAddress.city}, ${context.targetAddress.state} ${context.targetAddress.postalCode}`,
    `Service duration needed: ${context.durationMinutes} minutes`,
    `Upcoming jobs:`,
    upcomingText
  ];

  const body = JSON.stringify({
    target: context.targetAddress,
    durationMinutes: context.durationMinutes,
    upcoming: context.upcoming
  });

  const userPrompt = `${userPromptLines.join("\n")}\n\nContext JSON:\n${body}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.4,
      max_output_tokens: 600,
      reasoning: { effort: "low" },
      text: {
        verbosity: "medium",
        format: {
          type: "json_schema",
          name: "schedule_suggestions",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              suggestions: {
                type: "array",
                minItems: 1,
                maxItems: 3,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["window", "reasoning", "start_iso"],
                  properties: {
                    window: { type: "string" },
                    reasoning: { type: "string" },
                    start_iso: { type: "string" }
                  }
                }
              }
            },
            required: ["suggestions"]
          }
        }
      }
    })
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    console.warn("[ai] schedule_suggestions_failed", { status: response.status, bodyText });
    return null;
  }

  const SuggestionsSchema = z.object({
    suggestions: z
      .array(
        z.object({
          window: z.string().min(3).max(240),
          reasoning: z.string().min(3).max(480),
          start_iso: z.string().min(10).max(40)
        })
      )
      .max(3)
  });

  try {
    const data = (await response.json()) as {
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };
    const raw =
      data.output
        ?.flatMap((item) => item.content ?? [])
        .find((c) => typeof c.text === "string")
        ?.text ?? null;
    if (!raw) {
      return null;
    }
    const parsed = SuggestionsSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.warn("[ai] schedule_suggestions.parse_failed", { issues: parsed.error.issues });
      return null;
    }
    return parsed.data.suggestions.map((suggestion) => {
      const isoDate = new Date(suggestion.start_iso);
      const startAtIso = Number.isNaN(isoDate.getTime()) ? null : isoDate.toISOString();
      return {
        window: suggestion.window,
        reasoning: suggestion.reasoning,
        startAtIso
      } satisfies ScheduleSuggestion;
    });
  } catch (error) {
    console.warn("[ai] schedule_suggestions.error", { error: String(error) });
    return null;
  }
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
- Highlight the service mix and total value, and remind customers that no deposit is required.
- If the quote is accepted, outline next steps briefly. If declined, invite feedback.
- Keep email body under 600 characters and SMS under 240 characters.
- Respond ONLY as JSON with keys: email_subject, email_body, sms_body.`;

  const {
    customerName,
    services,
    total,
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
    `Share link: ${shareUrl}`,
    expiresText,
    `Payment terms: No deposit required; payment is due after service.`,
    notes ? `Internal notes: ${notes}` : null,
    `Reason: ${reason}`
  ]
    .filter(Boolean)
    .join("\n");

  return callOpenAI({ apiKey: config.apiKey, model: config.model, systemPrompt, userPrompt });
}
