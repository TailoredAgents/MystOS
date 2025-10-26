import http from "node:http";
import { randomBytes } from "node:crypto";
import { URL } from "node:url";

const port = Number(process.env["PORT"] ?? 4010);

const messages = [];

function generateSid(prefix) {
  return `${prefix}${randomBytes(16).toString("hex")}`;
}

function parseForm(body) {
  return Object.fromEntries(
    body
      .split("&")
      .map((pair) => pair.split("=").map((value) => decodeURIComponent(value.replace(/\+/g, " "))))
      .map(([key, value]) => [key, value])
  );
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://twilio-mock.local");

  if (req.method === "POST" && /\/Messages\.json$/.test(url.pathname)) {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks).toString("utf8");

    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.includes("application/x-www-form-urlencoded")) {
      return json(res, 400, { error: "Unsupported content type" });
    }

    const form = parseForm(rawBody);
    const accountSid = url.pathname.split("/")[3] ?? "AC00000000000000000000000000000000";
    const sid = generateSid("SM");
    const record = {
      sid,
      account_sid: accountSid,
      to: form["To"],
      from: form["From"],
      body: form["Body"],
      status: "queued",
      direction: "outbound-api",
      date_created: new Date().toISOString()
    };
    messages.unshift(record);
    console.info("[twilio-mock] message.received", record);

    return json(res, 201, {
      ...record,
      uri: `/2010-04-01/Accounts/${accountSid}/Messages/${sid}.json`
    });
  }

  if (req.method === "GET" && url.pathname === "/messages") {
    return json(res, 200, { messages });
  }

  if (req.method === "DELETE" && url.pathname === "/messages") {
    messages.length = 0;
    console.info("[twilio-mock] messages.cleared");
    return json(res, 204, {});
  }

  json(res, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`[twilio-mock] listening on http://0.0.0.0:${port}`);
});
