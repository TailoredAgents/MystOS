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
    // Prefer configured model; default to GPT‑5 mini per project preference
    const configuredModel = process.env["OPENAI_MODEL"];
    const model = configuredModel && configuredModel.trim().length > 0 ? configuredModel : "gpt-5-mini";
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "openai_not_configured",
          message: "OpenAI API key not configured on the server"
        },
        { status: 503 }
      );
    }

    async function callOpenAI(targetModel: string) {
      return fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: message }
          ],
          temperature: 0.4,
          max_tokens: 500
        })
      });
    }

    let response = await callOpenAI(model);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const isDev = process.env["NODE_ENV"] !== "production";
      const status = response.status;

      // In development, try a known stable fallback if the configured model fails with 400/404
      if (isDev && (status === 400 || status === 404)) {
        const fallbackModel = "gpt-4.1";
        response = await callOpenAI(fallbackModel);
        if (!response.ok) {
          const fbText = await response.text().catch(() => "");
          return NextResponse.json(
            {
              error: "openai_error",
              details: text || fbText,
              hint: `Model '${model}' may be unsupported. Tried dev fallback '${fallbackModel}'.`
            },
            { status: 502 }
          );
        }
      } else {
        return NextResponse.json(
          {
            error: "openai_error",
            details: text,
            hint: `Check OPENAI_MODEL ('${model}') and API key permissions.`
          },
          { status: 502 }
        );
      }
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



