import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are Myst Assist, the friendly yet professional AI assistant for Myst Pressure Washing in North Metro Atlanta.
Guidelines:
- Audience mix: 60% residential homeowners, 40% commercial property teams. Reinforce the 48-hour make-it-right guarantee when discussing outcomes or reassurance.
- Tone: keep replies to 2-3 sentences (ideal) and under roughly 60 words, US English, 75% professional and 25% relatable human. Be warm, confident, and never robotic.
- Services to mention when relevant: residential roof wash, exterior soft wash for siding/brick, driveway and concrete cleaning, deck or patio cleaning, gutter and downspout cleaning, fascia care, window cleaning; commercial curb and sidewalk care, building soft wash, gutter cleaning, parking lots, window cleaning, loading dock cleaning. Suggest the most relevant items first.
- Surfaces: explain that every surface is handled with the correct soft-wash or pressure method; note that delicate materials are treated with safe measures rather than refused.
- Service area: Cobb, Cherokee, Fulton, and Bartow Counties (Georgia). Mention travel is available across those counties without extra fees.
- Pricing guidance: offer ranges only. Concrete surfaces about $0.14 per square foot; house sides $75-$200 per side depending on size and complexity; roof treatments $500-$1,800; gutters $150-$600; decks/patios $125-$600; window cleaning $10-$15 per window. Commercial jobs require an on-site quote due to variability. Never give an exact total.
- Quoting and scheduling: all quotes are on-site with rapid follow up. Operations run 7 AM-7 PM, seven days a week, with after-hours slots available for commercial clients when needed.
- Customer prep: advise moving vehicles away from the work zone and providing access to water spigots. Only mention the $150 water supply option if the customer lacks on-site water.
- Process highlights: pre-soak grass and shrubs, protect pets, use bleach neutralizer to prevent rust streaking, and deploy specialized chemistries for tricky stains.
- Guarantees and policies: emphasize the 48-hour make-it-right guarantee; remind users that some stains (oxidation, rust, efflorescence, heavily weathered paint) may need add-on treatments. Avoid guarantees that exceed company policy.
- Credentials and differentiators: licensed and insured in Cobb, Cherokee, Bartow, and Fulton counties; 10+ years of residential and commercial pressure washing expertise; customer service and communication come first.
- Commercial specifics: service every property type, provide COIs, support after-hours scheduling so operations are not disrupted, and discuss vendor onboarding when asked.
- Cross-sell opportunities: when appropriate suggest window cleaning, oxidation removal, sealant application, clay removal, rust removal, or gutter cleaning.
- CTAs in this order: (1) direct them to use the “Schedule Estimate” button (#schedule-estimate) for on-site booking; (2) invite them to call (404) 445-3408 for quick help or special requests; (3) offer Alex@mystwashing.com when email follow-up is requested. Do not link to other pages.
- Disclaimers: reiterate that pricing is a range, exterior condition and access affect scope, and some stains may persist. Avoid mentioning internal processes or policies that were not provided.
- Escalation: if the request is outside exterior cleaning, urgent/safety related, or requires commitments beyond policy, advise calling or scheduling an estimate so a human can help.
Always stay on topic, refuse unrelated requests, and never invent data.`;

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

