// Live generation: POST { app } -> researches the app with Claude + web search and returns a validated guide.
// Deploy on Vercel with ANTHROPIC_API_KEY set. Optional: ACCESS_CODE to stop strangers spending your credits.
import fs from "node:fs";
import { validateGuide } from "../lib/validate.mjs";

export const config = { maxDuration: 60 };
const rules = JSON.parse(fs.readFileSync(new URL("../schema/rules.json", import.meta.url), "utf8"));
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const SYSTEM = (today) => `You are an OAuth research agent. A developer building an AI agent wants their users to connect an app. Find out what it takes to get an OAuth app for that provider approved for production use. Today is ${today}.
Use web search several times: the provider's official developer docs, scopes page, app review or verification policy, marketplace or listing requirements, and any partner or business-verification requirement. Prefer official sources.

Return ONLY one JSON object (no markdown fences, no commentary) shaped like:
{"app":"","slug":"kebab-case","generated_at":"${today}","scenario":"the typical agent use case you assumed",
"verdict":{"tier":"","score":0,"score_breakdown":[{"factor":"","points":0,"claim_id":"c1"}],"headline":"one sentence",
 "your_effort":{"summary":"","claim_ids":[]},"provider_wait":{"summary":"","claim_ids":[]}},
"claims":[{"id":"c1","statement":"","tag":"","confidence":"","checked_at":"${today}","sources":[{"url":"","title":"","type":"primary|secondary","retrieved":"${today}"}],"basis":"(Inferred only)","what_we_tried":"(Unknown only)","note":"(optional)"}],
"steps":[{"title":"","who":"agent|human|either","detail":"","claim_ids":[]}],
"blockers":[{"if":"","do":"","claim_ids":[]}],
"expected_vs_found":[]}

Rules you must follow:
- Score factors and points (use only these, include a factor only if a claim supports it): ${JSON.stringify(rules.score_factors)}. score = sum of points. Tier: ${rules.tiers.map((t) => `${t.id} for ${t.min}-${t.max}`).join(", ")}.
- Every claim has a tag: Sourced (needs sources with real URLs you actually saw in search results), Inferred (needs basis), or Unknown (needs what_we_tried). NEVER use Tested; no live probes were run.
- confidence "high" only when a primary (official provider) source supports the claim. Vendor blogs and consultancies are "secondary".
- Time ranges (your effort vs provider wait) must be tagged Inferred or Sourced with honest low confidence when sources are thin or conflict. Never invent precise numbers.
- Steps must say who does them: "agent" only for things an AI can truly do (draft scope justifications, privacy policy checklist, demo video script, emails); account creation, 2FA, business verification, KYC and submission are "human".
- Leave expected_vs_found as an empty array. If you cannot find enough, say so with Unknown claims rather than guessing.`;

async function callClaude(body) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, ...body }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Anthropic API error ${r.status}`);
  return data;
}
const textOf = (d) => d.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
function parseJson(t) {
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < 0) throw new Error("model did not return JSON");
  return JSON.parse(t.slice(a, b + 1));
}
function seenUrlsOf(d) {
  const s = new Set();
  for (const b of d.content) if (b.type === "web_search_tool_result" && Array.isArray(b.content)) b.content.forEach((x) => x.url && s.add(x.url));
  return s;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "Server has no ANTHROPIC_API_KEY set." });
  if (process.env.ACCESS_CODE && req.headers["x-access-code"] !== process.env.ACCESS_CODE) return res.status(401).json({ error: "Access code required." });
  const app = String(req.body?.app ?? "").trim().slice(0, 80);
  if (app.length < 2) return res.status(400).json({ error: "Enter an app name or website." });
  const today = new Date().toISOString().slice(0, 10);
  try {
    const first = await callClaude({
      system: SYSTEM(today),
      messages: [{ role: "user", content: `App to investigate (name or website): ${app}` }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
    });
    const seen = seenUrlsOf(first);
    let guide = parseJson(textOf(first));
    const check = (g) => validateGuide(g, rules, { forbidTested: true, seenUrls: seen });
    let errors = check(guide);
    let repaired = false;
    if (errors.length) {
      const fix = await callClaude({
        system: "You fix JSON guides. Return ONLY the corrected full JSON object, nothing else. Fix the listed problems by downgrading claims (to Inferred or Unknown), removing unsupported sources, and correcting the score; never invent sources.",
        messages: [{ role: "user", content: `Problems:\n- ${errors.join("\n- ")}\n\nGuide:\n${JSON.stringify(guide)}` }],
      });
      guide = parseJson(textOf(fix));
      errors = check(guide);
      repaired = true;
    }
    guide.generated_live = true;
    guide.generated_at = today;
    return res.status(200).json({ guide, repaired, remaining_problems: errors, sources_seen: seen.size });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
