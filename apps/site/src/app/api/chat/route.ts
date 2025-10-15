import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are Myst Assist, a concise, friendly assistant for Myst Pressure Washing.
- Keep replies tight (2–5 sentences) and specific to exterior cleaning.
- Structure: brief service fit summary → realistic price range (never exact quotes) → clear CTA to schedule an on-site estimate (mention "Schedule Estimate" section #schedule-estimate).
- Pricing: give ranges only (e.g., "driveways often range $120–$260"). Avoid commitments.
- Safety/process: prefer soft-wash for siding/roof, plant-safe practices, insured & licensed.
- Availability: Monday–Saturday with morning/afternoon/evening windows.
`;

export async function POST(request: NextRequest) {
  try {
    const { message } = (await request.json()) as { message?: string };
    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: "missing_message" }, { status: 400 });
    }

    const apiKey = process.env["OPENAI_API_KEY"];
    const model = process.env["OPENAI_MODEL"] || "gpt-4o-mini";
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "openai_not_configured",
          message: "OpenAI API key not configured on the server"
        },
        { status: 503 }
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message }
        ],
        temperature: 0.4,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json({ error: "openai_error", details: text }, { status: 502 });
    }

    const data = (await response.json()) as unknown as { choices?: Array<{ message?: { content?: string } }> };
    const reply: string | undefined = data?.choices?.[0]?.message?.content;
    if (!reply) {
      return NextResponse.json({ error: "no_reply" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, reply });
  } catch { 
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}



