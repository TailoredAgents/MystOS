const GA_ENDPOINT = "https://www.google-analytics.com/mp/collect";

interface ConversionPayload {
  clientId?: string;
  userId?: string;
  params?: Record<string, unknown>;
}

export async function sendConversion(eventName: string, payload: ConversionPayload = {}) {
  const measurementId = process.env["GA4_MEASUREMENT_ID"];
  const apiSecret = process.env["GA4_API_SECRET"];

  if (!measurementId || !apiSecret) {
    return;
  }

  try {
    const body = {
      client_id: payload.clientId ?? "myst-os-web",
      user_id: payload.userId,
      events: [
        {
          name: eventName,
          params: {
            engagement_time_msec: 1,
            ...payload.params
          }
        }
      ]
    };

    await fetch(`${GA_ENDPOINT}?measurement_id=${measurementId}&api_secret=${apiSecret}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    console.warn("GA4 conversion tracking failed", error);
  }
}

