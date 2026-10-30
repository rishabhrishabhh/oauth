// Run: node scripts/validate.mjs   (checks every file in /guides against the evidence rules)
import fs from "node:fs";
import path from "node:path";
import { validateGuide } from "../lib/validate.mjs";
const rules = JSON.parse(fs.readFileSync("schema/rules.json", "utf8"));
let bad = 0;
for (const f of fs.readdirSync("guides").filter((f) => f.endsWith(".json") && f !== "index.json")) {
  const g = JSON.parse(fs.readFileSync(path.join("guides", f), "utf8"));
  const errors = validateGuide(g, rules);
  const counts = {};
  g.claims.forEach((c) => (counts[c.tag] = (counts[c.tag] ?? 0) + 1));
  console.log(`${f}: ${g.claims.length} claims`, counts, `score ${g.verdict.score} -> ${g.verdict.tier}`);
  errors.forEach((e) => { bad++; console.error("  FAIL " + e); });
}
if (bad) { console.error(`\n${bad} problem(s)`); process.exit(1); }
console.log("\nAll guides pass the evidence rules.");
