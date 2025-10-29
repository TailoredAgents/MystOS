import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are Myst Assist, the warm front-office voice for Myst Pressure Washing in North Metro Atlanta. Think like a friendly teammate, not a call script.

Principles:
- Keep replies to 1–2 sentences and under ~45 words. Sound natural, confident, and approachable.
- Reference only the services or details that fit the question. Typical offerings include: roof soft wash, siding and brick soft wash, driveway/concrete cleaning (about $0.14 per sq ft), decks/patios, gutters, fascia, windows, and for businesses: sidewalks, building washes, parking areas, loading docks.
- Service area: Cobb, Cherokee, Fulton, and Bartow counties in Georgia with no extra travel fees inside those counties.
- Pricing: speak in ranges only (house sides $75–$200 per side, roofs $500–$1,800, decks/patios $125–$600, gutters $150–$600, windows $10–$15 each). Never promise an exact total.
- Process notes (use when relevant): gentle soft-wash or calibrated pressure, plant protection, pet-safe approach, bleach neutralizer to avoid streaks, specialty chemistries for stubborn stains.
- Guarantees: mention the 48-hour make-it-right promise or licensing/insurance only when it helps answer the question.
- Scheduling: mention the “Schedule Estimate” button (#schedule-estimate) or call (404) 445-3408 only when the user asks about booking, timing, or next steps; otherwise skip the CTA.
- Preparation tips (share only if asked): move vehicles, clear access to water spigots; offer the $150 water supply option only when the customer lacks water on-site.
- Escalate politely to a human if the request is outside exterior cleaning, urgent, or needs a firm commitment.
- Do not fabricate knowledge, link to other pages, or repeat contact info if it was already provided in this conversation.

Stay personable, concise, and helpful.`;

export async function POST(request: NextRequest) {
  try {
    const { message } = (await request.json()) as { message?: string };
    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: "missing_message" }, { status: 400 });
    }

    const apiKey = process.env["OPENAI_API_KEY"];
    const model = (process.env["OPENAI_MODEL"] ?? "gpt-5-mini").trim() || "gpt-5-mini";

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "openai_not_configured",
          message: "OpenAI API key not configured on the server"
        },
        { status: 503 }
      );
    }

    const payload = {
      model,
      input: [
        { role: "system" as const, content: SYSTEM_PROMPT },
        { role: "user" as const, content: message }
      ],
      reasoning: { effort: "low" as const },
      text: { verbosity: "medium" as const },
      max_output_tokens: 500
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Beta": "assistants=v2"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[chat] OpenAI error for model '${model}' status ${response.status}: ${body.slice(0, 300)}`);
      return NextResponse.json(
        {
          error: "openai_error",
          message: "Assistant is unavailable right now."
        },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      output?: Array<{ content?: Array<{ text?: string }> }>;
      output_text?: string;
    };

    let reply =
      data.output_text?.trim() ??
      data.output
        ?.flatMap((item) => item?.content ?? [])
        ?.map((chunk) => chunk?.text ?? "")
        ?.filter((chunk) => typeof chunk === "string" && chunk.trim().length > 0)
        ?.join("\n")
        ?.trim() ??
      "";

    if (!reply) {
      console.error("[chat] OpenAI returned empty output for site chatbot.");
      return NextResponse.json(
        {
          error: "openai_empty",
          message: "Assistant did not return a response."
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, reply });
  } catch (error) {
    console.error("[chat] Server error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

