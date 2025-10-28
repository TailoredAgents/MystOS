'use server';

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { callAdminApi } from "./lib/api";

export async function updateApptStatus(formData: FormData) {
  const id = formData.get("appointmentId");
  const status = formData.get("status");
  if (typeof id !== "string" || typeof status !== "string") return;

  await callAdminApi(`/api/appointments/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ status })
  });

  const jar = await cookies();
  jar.set({ name: "myst-flash", value: "Appointment updated", path: "/" });
  revalidatePath("/team");
}

export async function addApptNote(formData: FormData) {
  const id = formData.get("appointmentId");
  const body = formData.get("body");
  if (typeof id !== "string" || typeof body !== "string" || body.trim().length === 0) return;

  await callAdminApi(`/api/appointments/${id}/notes`, {
    method: "POST",
    body: JSON.stringify({ body })
  });

  const jar = await cookies();
  jar.set({ name: "myst-flash", value: "Note added", path: "/" });
  revalidatePath("/team");
}

export async function sendQuoteAction(formData: FormData) {
  const id = formData.get("quoteId");
  if (typeof id !== "string") return;

  await callAdminApi(`/api/quotes/${id}/send`, { method: "POST", body: JSON.stringify({}) });
  const jar = await cookies();
  jar.set({ name: "myst-flash", value: "Quote sent", path: "/" });
  revalidatePath("/team");
}

export async function quoteDecisionAction(formData: FormData) {
  const id = formData.get("quoteId");
  const decision = formData.get("decision");
  if (typeof id !== "string" || (decision !== "accepted" && decision !== "declined")) return;

  await callAdminApi(`/api/quotes/${id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision })
  });

  const jar = await cookies();
  jar.set({ name: "myst-flash", value: "Quote updated", path: "/" });
  revalidatePath("/team");
}

export async function attachPaymentAction(formData: FormData) {
  const id = formData.get("paymentId");
  const appt = formData.get("appointmentId");
  if (typeof id !== "string" || typeof appt !== "string" || appt.trim().length === 0) return;

  await callAdminApi(`/api/payments/${id}/attach`, {
    method: "POST",
    body: JSON.stringify({ appointmentId: appt })
  });

  const jar = await cookies();
  jar.set({ name: "myst-flash", value: "Payment attached", path: "/" });
  revalidatePath("/team");
}

export async function detachPaymentAction(formData: FormData) {
  const id = formData.get("paymentId");
  if (typeof id !== "string") return;

  await callAdminApi(`/api/payments/${id}/detach`, { method: "POST" });
  const jar = await cookies();
  jar.set({ name: "myst-flash", value: "Payment detached", path: "/" });
  revalidatePath("/team");
}

export async function rescheduleAppointmentAction(formData: FormData) {
  const id = formData.get("appointmentId");
  const preferredDate = formData.get("preferredDate");
  const timeWindow = formData.get("timeWindow");

  const jar = await cookies();

  if (
    typeof id !== "string" ||
    id.trim().length === 0 ||
    typeof preferredDate !== "string" ||
    preferredDate.trim().length === 0
  ) {
    jar.set({ name: "myst-flash-error", value: "Missing date", path: "/" });
    revalidatePath("/team");
    return;
  }

  const payload: Record<string, unknown> = { preferredDate };
  if (typeof timeWindow === "string" && timeWindow.length > 0) {
    payload["timeWindow"] = timeWindow;
  }

  const response = await callAdminApi(`/api/web/appointments/${id}/reschedule`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let message = "Unable to reschedule";
    try {
      const data = (await response.json()) as { error?: string; message?: string };
      message = data.message ?? data.error ?? message;
    } catch {
      // ignore
    }
    jar.set({ name: "myst-flash-error", value: message, path: "/" });
  } else {
    jar.set({ name: "myst-flash", value: "Appointment rescheduled", path: "/" });
  }

  revalidatePath("/team");
}

export async function createQuoteAction(formData: FormData) {
  const jar = await cookies();

  const contactId = formData.get("contactId");
  const propertyId = formData.get("propertyId");
  const appointmentId = formData.get("appointmentId");
  const zoneId = formData.get("zoneId");
  const servicesRaw = formData.get("services");
  const surfaceArea = formData.get("surfaceArea");
  const depositRate = formData.get("depositRate");
  const expiresInDays = formData.get("expiresInDays");
  const applyBundles = formData.get("applyBundles");
  const notes = formData.get("notes");

  if (typeof contactId !== "string" || typeof propertyId !== "string" || typeof zoneId !== "string") {
    jar.set({ name: "myst-flash-error", value: "Missing quote details", path: "/" });
    revalidatePath("/team");
    return;
  }

  let services: string[] = [];
  if (typeof servicesRaw === "string" && servicesRaw.length > 0) {
    try {
      const parsed = JSON.parse(servicesRaw) as string[];
      if (Array.isArray(parsed)) {
        services = parsed;
      }
    } catch {
      // ignore
    }
  }

  if (!services.length) {
    jar.set({ name: "myst-flash-error", value: "No services selected", path: "/" });
    revalidatePath("/team");
    return;
  }

  const payload: Record<string, unknown> = {
    contactId,
    propertyId,
    zoneId,
    selectedServices: services,
    applyBundles: typeof applyBundles === "string"
  };

  if (typeof surfaceArea === "string" && surfaceArea.trim().length > 0) {
    const area = Number(surfaceArea);
    if (!Number.isNaN(area) && area > 0) {
      payload["surfaceArea"] = area;
    }
  }

  if (typeof depositRate === "string" && depositRate.trim().length > 0) {
    const rate = Number(depositRate);
    if (!Number.isNaN(rate) && rate > 0 && rate <= 1) {
      payload["depositRate"] = rate;
    }
  }

  if (typeof expiresInDays === "string" && expiresInDays.trim().length > 0) {
    const days = Number(expiresInDays);
    if (!Number.isNaN(days) && days > 0) {
      payload["expiresInDays"] = days;
    }
  }

  if (typeof notes === "string" && notes.trim().length > 0) {
    payload["notes"] = notes.trim();
  }

  const response = await callAdminApi(`/api/quotes`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let message = "Unable to create quote";
    try {
      const data = (await response.json()) as { error?: string; details?: unknown };
      if (typeof data.error === "string") {
        message = data.error;
      }
    } catch {
      // ignore
    }
    jar.set({ name: "myst-flash-error", value: message, path: "/" });
    revalidatePath("/team");
    return;
  }

  try {
    const data = (await response.json()) as {
      quote?: { id: string; shareToken?: string | null };
      shareUrl?: string;
    };
    const link = data.shareUrl ?? (data.quote?.shareToken ? `/quote/${data.quote.shareToken}` : null);
    jar.set({ name: "myst-flash", value: link ? `Quote created. Share link: ${link}` : "Quote created", path: "/" });
  } catch {
    jar.set({ name: "myst-flash", value: "Quote created", path: "/" });
  }

  revalidatePath("/team");
}

export async function createContactAction(formData: FormData) {
  const jar = await cookies();

  const firstName = formData.get("firstName");
  const lastName = formData.get("lastName");
  const email = formData.get("email");
  const phone = formData.get("phone");
  const addressLine1 = formData.get("addressLine1");
  const city = formData.get("city");
  const state = formData.get("state");
  const postalCode = formData.get("postalCode");

  if (
    typeof firstName !== "string" ||
    typeof lastName !== "string" ||
    typeof addressLine1 !== "string" ||
    typeof city !== "string" ||
    typeof state !== "string" ||
    typeof postalCode !== "string" ||
    firstName.trim().length === 0 ||
    lastName.trim().length === 0 ||
    addressLine1.trim().length === 0 ||
    city.trim().length === 0 ||
    state.trim().length === 0 ||
    postalCode.trim().length === 0
  ) {
    jar.set({ name: "myst-flash-error", value: "Contact details are required", path: "/" });
    revalidatePath("/team");
    return;
  }

  const payload: Record<string, unknown> = {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: typeof email === "string" && email.trim().length ? email.trim() : undefined,
    phone: typeof phone === "string" && phone.trim().length ? phone.trim() : undefined,
    property: {
      addressLine1: addressLine1.trim(),
      city: city.trim(),
      state: state.trim(),
      postalCode: postalCode.trim()
    }
  };

  const response = await callAdminApi("/api/admin/contacts", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let message = "Unable to create contact";
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) {
        message = data.error.replace(/_/g, " ");
      }
    } catch {
      // ignore
    }
    jar.set({ name: "myst-flash-error", value: message, path: "/" });
    revalidatePath("/team");
    return;
  }

  jar.set({ name: "myst-flash", value: "Contact created", path: "/" });
  revalidatePath("/team");
}

export async function logoutCrew() {
  const jar = await cookies();
  jar.set({ name: "myst-crew-session", value: "", path: "/", maxAge: 0 });
  redirect("/team");
}

export async function logoutOwner() {
  const jar = await cookies();
  jar.set({ name: "myst-admin-session", value: "", path: "/", maxAge: 0 });
  redirect("/team");
}

