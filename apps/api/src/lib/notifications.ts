import nodemailer from "nodemailer";
import { DateTime } from "luxon";
import { generateEstimateNotificationCopy } from "@/lib/ai";

interface BaseContact {
  name: string;
  email?: string | null;
  phone?: string | null;
}

interface BaseProperty {
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface EstimateNotificationPayload {
  leadId: string;
  services: string[];
  contact: BaseContact;
  property: BaseProperty;
  scheduling: {
    preferredDate: string | null;
    alternateDate: string | null;
    timeWindow: string | null;
  };
  appointment: {
    id: string;
    startAt: Date | null;
    durationMinutes: number;
    travelBufferMinutes: number;
    status: "requested" | "confirmed" | "completed" | "no_show" | "canceled";
    rescheduleToken: string;
    rescheduleUrl?: string;
  };
  notes?: string | null;
}

type ConfirmationReason = "requested" | "rescheduled";

const DEFAULT_TIME_ZONE =
  process.env["APPOINTMENT_TIMEZONE"] ??
  process.env["GOOGLE_CALENDAR_TIMEZONE"] ??
  "America/New_York";

const SITE_URL =
  process.env["NEXT_PUBLIC_SITE_URL"] ?? process.env["SITE_URL"] ?? "http://localhost:3000";

let cachedTransporter: nodemailer.Transporter | null;

function getTransport(): nodemailer.Transporter | null {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env["SMTP_HOST"];
  const port = process.env["SMTP_PORT"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];

  if (!host || !port || !user || !pass) {
    return null;
  }

  const parsedPort = Number(port);
  const secure = parsedPort === 465;

  cachedTransporter = nodemailer.createTransport({
    host,
    port: parsedPort,
    secure,
    auth: {
      user,
      pass
    }
  });

  return cachedTransporter;
}

function formatDateTime(date: Date | null): string {
  if (!date) {
    return "TBD";
  }

  return DateTime.fromJSDate(date, { zone: "utc" })
    .setZone(DEFAULT_TIME_ZONE)
    .toLocaleString(DateTime.DATETIME_MED);
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function createIcsAttachment(payload: EstimateNotificationPayload): {
  filename: string;
  content: string;
  contentType: string;
} | null {
  const { appointment, contact, property } = payload;
  if (!appointment.startAt) {
    return null;
  }

  const start = DateTime.fromJSDate(appointment.startAt, { zone: "utc" });
  const end = start.plus({ minutes: appointment.durationMinutes ?? 60 });
  const stamp = DateTime.utc();

  const summary = `Myst Estimate - ${contact.name}`;
  const descriptionLines = [
    `Services: ${payload.services.join(", ") || "General exterior cleaning"}`,
    payload.notes ? `Notes: ${payload.notes}` : null,
    appointment.rescheduleUrl ? `Reschedule: ${appointment.rescheduleUrl}` : null
  ]
    .filter((line): line is string => Boolean(line))
    .join("\\n");

  const location = `${property.addressLine1}, ${property.city}, ${property.state} ${property.postalCode}`;

  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MystOS//Estimate Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(`${appointment.id}@myst-os`)}`,
    `DTSTAMP:${stamp.toFormat("yyyyLLdd'T'HHmmss'Z'")}`,
    `DTSTART:${start.toFormat("yyyyLLdd'T'HHmmss'Z'")}`,
    `DTEND:${end.toFormat("yyyyLLdd'T'HHmmss'Z'")}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(descriptionLines)}`,
    `LOCATION:${escapeIcs(location)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  return {
    filename: "myst-estimate.ics",
    content,
    contentType: "text/calendar; charset=utf-8; method=REQUEST"
  };
}

async function sendSms(to: string, body: string, context: Record<string, unknown>): Promise<void> {
  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];
  const from = process.env["TWILIO_FROM"];

  if (!sid || !token || !from) {
    console.info("[notify] sms.unsent.no_twilio", { to, body, ...context });
    return;
  }

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const form = new URLSearchParams({ From: from, To: to, Body: body }).toString();

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`
      },
      body: form
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn("[notify] sms.failed", { to, status: response.status, text, ...context });
    } else {
      console.info("[notify] sms.sent", { to, ...context });
    }
  } catch (error) {
    console.warn("[notify] sms.error", { to, error: String(error), ...context });
  }
}

async function sendEmail(
  payload: EstimateNotificationPayload,
  subject: string,
  textBody: string
): Promise<void> {
  const transporter = getTransport();
  const from = process.env["SMTP_FROM"];
  const to = payload.contact.email;

  if (!transporter || !from || !to) {
    console.info("[notify] email.unsent", { subject, to: to ?? "unknown" });
    return;
  }

  const ics = createIcsAttachment(payload);
  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      text: textBody,
      attachments: ics ? [ics] : undefined
    });
    console.info("[notify] email.sent", { to, subject });
  } catch (error) {
    console.warn("[notify] email.error", { to, subject, error: String(error) });
  }
}

function buildRescheduleUrl(appointment: EstimateNotificationPayload["appointment"]): string {
  if (appointment.rescheduleUrl) {
    return appointment.rescheduleUrl;
  }

  const url = new URL("/schedule", SITE_URL);
  url.searchParams.set("appointmentId", appointment.id);
  url.searchParams.set("token", appointment.rescheduleToken);
  return url.toString();
}

function joinServices(services: string[]): string {
  return services.length ? services.join(", ") : "Exterior cleaning";
}

export async function sendEstimateConfirmation(
  payload: EstimateNotificationPayload,
  reason: ConfirmationReason = "requested"
): Promise<void> {
  const { contact, appointment, property, scheduling } = payload;
  const when = formatDateTime(appointment.startAt);
  const rescheduleUrl = buildRescheduleUrl(appointment);
  const headline = reason === "requested" ? "You're booked!" : "Appointment updated";

  const fallbackSubject = `Myst Estimate - ${when}`;
  const fallbackBody = [
    `${headline} We'll see you ${when}.`,
    `Location: ${property.addressLine1}, ${property.city}, ${property.state} ${property.postalCode}`,
    `Services: ${joinServices(payload.services)}`,
    scheduling.timeWindow ? `Preferred window: ${scheduling.timeWindow}` : null,
    payload.notes ? `Notes: ${payload.notes}` : null,
    "",
    `Need to reschedule? ${rescheduleUrl}`
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  const fallbackSms =
    reason === "requested"
      ? `Myst confirm: estimate on ${when}. Need to adjust? ${rescheduleUrl}`
      : `Myst update: new estimate time ${when}. Need changes? ${rescheduleUrl}`;

  let generated = null;
  try {
    generated = await generateEstimateNotificationCopy({
      when,
      services: payload.services,
      notes: payload.notes,
      rescheduleUrl,
      reason,
      address: {
        line1: property.addressLine1,
        city: property.city,
        state: property.state,
        postalCode: property.postalCode
      },
      contactName: contact.name
    });
  } catch (error) {
    console.warn("[notify] ai.copy.error", { error: String(error) });
  }

  if (contact.phone) {
    const smsBody = generated?.smsBody && generated.smsBody.length <= 320 ? generated.smsBody : fallbackSms;
    await sendSms(contact.phone, smsBody, { leadId: payload.leadId, appointmentId: appointment.id });
  }

  await sendEmail(
    payload,
    generated?.emailSubject && generated.emailSubject.length <= 120 ? generated.emailSubject : fallbackSubject,
    generated?.emailBody && generated.emailBody.length <= 1000 ? generated.emailBody : fallbackBody
  );
}

interface ReminderOptions {
  windowMinutes: number;
}

async function sendEstimateReminderInternal(
  payload: EstimateNotificationPayload,
  options: ReminderOptions
): Promise<void> {
  const { contact, appointment } = payload;
  const when = formatDateTime(appointment.startAt);
  const rescheduleUrl = buildRescheduleUrl(appointment);
  const windowHours = Math.round(options.windowMinutes / 60);

  const fallbackSms = `Myst reminder: estimate in ${windowHours}h (${when}). Need to reschedule? ${rescheduleUrl}`;
  const fallbackEmailBody = [
    `Quick reminder: your Myst Pressure Washing estimate is in ${windowHours} hours (${when}).`,
    `Location: ${payload.property.addressLine1}, ${payload.property.city}, ${payload.property.state} ${payload.property.postalCode}`,
    "",
    `Need to adjust? ${rescheduleUrl}`
  ].join("\n");
  const fallbackSubject = `Reminder: Myst estimate ${when}`;

  let generated = null;
  try {
    generated = await generateEstimateNotificationCopy({
      when,
      services: payload.services,
      notes: payload.notes,
      rescheduleUrl,
      reason: "reminder",
      reminderWindowHours: windowHours,
      address: {
        line1: payload.property.addressLine1,
        city: payload.property.city,
        state: payload.property.state,
        postalCode: payload.property.postalCode
      },
      contactName: payload.contact.name
    });
  } catch (error) {
    console.warn("[notify] reminder.ai.error", { error: String(error) });
  }

  if (contact.phone) {
    const smsBody = generated?.smsBody && generated.smsBody.length <= 320 ? generated.smsBody : fallbackSms;
    await sendSms(contact.phone, smsBody, {
      leadId: payload.leadId,
      appointmentId: appointment.id,
      reminderMinutes: options.windowMinutes
    });
  }

  const transporter = getTransport();
  const from = process.env["SMTP_FROM"];
  const to = payload.contact.email;

  if (transporter && from && to) {
    const subject =
      generated?.emailSubject && generated.emailSubject.length <= 120 ? generated.emailSubject : fallbackSubject;
    const text = generated?.emailBody && generated.emailBody.length <= 1000 ? generated.emailBody : fallbackEmailBody;

    try {
      await transporter.sendMail({ from, to, subject, text });
      console.info("[notify] email.reminder.sent", {
        to,
        appointmentId: appointment.id,
        reminderMinutes: options.windowMinutes
      });
    } catch (error) {
      console.warn("[notify] email.reminder.error", {
        to,
        appointmentId: appointment.id,
        reminderMinutes: options.windowMinutes,
        error: String(error)
      });
    }
  } else {
    console.info("[notify] reminder.email.unsent", {
      appointmentId: appointment.id,
      reminderMinutes: options.windowMinutes
    });
  }
}

export async function sendEstimateReminder24h(payload: EstimateNotificationPayload): Promise<void> {
  await sendEstimateReminderInternal(payload, { windowMinutes: 24 * 60 });
}

export async function sendEstimateReminder2h(payload: EstimateNotificationPayload): Promise<void> {
  await sendEstimateReminderInternal(payload, { windowMinutes: 2 * 60 });
}
