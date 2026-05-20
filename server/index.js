import { createServer } from "node:http";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.API_PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v20.0";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || "";
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || "";
const generatedDir = join(process.cwd(), "public", "generated");

function send(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function extractResponseText(response) {
  if (response.output_text) return response.output_text;
  const output = response.output || [];
  return output
    .flatMap((item) => item.content || [])
    .map((content) => content.text || content.output_text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function callOpenAiResponses(body) {
  if (!OPENAI_API_KEY) {
    return {
      status: 503,
      payload: { error: "OPENAI_API_KEY ausente. Configure a variável no ambiente da API local." },
    };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: body.model || OPENAI_TEXT_MODEL,
      instructions: body.systemPrompt,
      input: body.input,
      metadata: {
        product: "vertice-demand-agent",
        mode: body.mode || "agent",
      },
    }),
  });
  const data = await response.json();
  if (!response.ok) return { status: response.status, payload: data };
  return {
    status: 200,
    payload: {
      text: extractResponseText(data),
      model: data.model || body.model || OPENAI_TEXT_MODEL,
      usage: data.usage || null,
      rawId: data.id,
    },
  };
}

function sizeForFormat(format) {
  const key = String(format || "").toLowerCase();
  if (key.includes("story") || key.includes("vertical") || key.includes("reels")) return "1024x1536";
  if (key.includes("feed") || key.includes("quadrado") || key.includes("square")) return "1024x1024";
  return "1024x1536";
}

async function callOpenAiImages(body) {
  if (!OPENAI_API_KEY) {
    return {
      status: 503,
      payload: { error: "OPENAI_API_KEY ausente. Configure a variável no ambiente da API local." },
    };
  }

  await mkdir(generatedDir, { recursive: true });
  const count = Math.max(1, Math.min(Number(body.count || 1), 4));
  const images = [];
  const credits = [];

  for (let index = 0; index < count; index += 1) {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: body.model || OPENAI_IMAGE_MODEL,
        prompt: body.prompt,
        size: sizeForFormat(body.format),
        quality: body.quality || "medium",
        n: 1,
      }),
    });
    const data = await response.json();
    if (!response.ok) return { status: response.status, payload: data };
    const image = data.data?.[0];
    if (image?.b64_json) {
      const filename = `${Date.now()}-${randomUUID()}.png`;
      await writeFile(join(generatedDir, filename), Buffer.from(image.b64_json, "base64"));
      images.push({
        url: `http://127.0.0.1:${PORT}/generated/${filename}`,
        format: body.format || "vertical",
        size: sizeForFormat(body.format),
      });
    } else if (image?.url) {
      images.push({ url: image.url, format: body.format || "vertical", size: sizeForFormat(body.format) });
    }
    credits.push(data.usage || { image_count: 1, quality: body.quality || "medium" });
  }

  return {
    status: 200,
    payload: {
      images,
      model: body.model || OPENAI_IMAGE_MODEL,
      credits,
    },
  };
}

async function metaFetch(path, init = {}) {
  if (!META_ACCESS_TOKEN) {
    return { status: 503, payload: { error: "META_ACCESS_TOKEN ausente. Usando modo mock no front-end." } };
  }
  const glue = path.includes("?") ? "&" : "?";
  const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}${path}${glue}access_token=${META_ACCESS_TOKEN}`, init);
  const data = await response.json();
  return { status: response.status, payload: data };
}

async function route(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});

  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);

    if (req.method === "GET" && url.pathname.startsWith("/generated/")) {
      const file = normalize(url.pathname.replace("/generated/", ""));
      if (file.includes("..")) return send(res, 400, { error: "Arquivo inválido." });
      const filepath = join(generatedDir, file);
      if (!existsSync(filepath)) return send(res, 404, { error: "Imagem não encontrada." });
      const ext = extname(filepath).replace(".", "") || "png";
      res.writeHead(200, {
        "Content-Type": `image/${ext === "jpg" ? "jpeg" : ext}`,
        "Access-Control-Allow-Origin": "*",
      });
      res.end(await readFile(filepath));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      return send(res, 200, {
        ok: true,
        openaiConfigured: Boolean(OPENAI_API_KEY),
        metaConfigured: Boolean(META_ACCESS_TOKEN),
      });
    }

    if (req.method === "POST" && url.pathname === "/api/ai/respond") {
      const result = await callOpenAiResponses(await readJson(req));
      return send(res, result.status, result.payload);
    }

    if (req.method === "POST" && url.pathname === "/api/images/generate") {
      const result = await callOpenAiImages(await readJson(req));
      return send(res, result.status, result.payload);
    }

    if (req.method === "GET" && url.pathname === "/api/meta/ad-accounts") {
      const result = await metaFetch("/me/adaccounts?fields=id,name,account_status,currency,timezone_name");
      return send(res, result.status, result.payload);
    }

    if (req.method === "GET" && url.pathname === "/api/meta/campaigns") {
      const adAccountId = url.searchParams.get("adAccountId") || META_AD_ACCOUNT_ID;
      const result = await metaFetch(`/${adAccountId}/campaigns?fields=id,name,status,objective,created_time`);
      return send(res, result.status, result.payload);
    }

    if (req.method === "GET" && url.pathname === "/api/meta/insights") {
      const campaignId = url.searchParams.get("campaignId");
      if (!campaignId) return send(res, 400, { error: "campaignId obrigatório." });
      const result = await metaFetch(`/${campaignId}/insights?fields=spend,impressions,reach,frequency,cpm,cpc,ctr,clicks,actions,cost_per_action_type`);
      return send(res, result.status, result.payload);
    }

    if (req.method === "POST" && url.pathname === "/api/meta/campaigns/paused") {
      const body = await readJson(req);
      const adAccountId = body.adAccountId || META_AD_ACCOUNT_ID;
      const result = await metaFetch(`/${adAccountId}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: body.name,
          objective: body.objective || "OUTCOME_LEADS",
          status: "PAUSED",
          special_ad_categories: body.specialAdCategories || [],
        }),
      });
      return send(res, result.status, result.payload);
    }

    return send(res, 404, { error: "Rota não encontrada." });
  } catch (error) {
    return send(res, 500, { error: error instanceof Error ? error.message : "Erro desconhecido." });
  }
}

createServer(route).listen(PORT, "127.0.0.1", () => {
  console.log(`Vértice API local em http://127.0.0.1:${PORT}`);
});
