// Shared evidence checker. Used by the CLI (scripts/validate.mjs) and the live generator (api/generate.js).
export function validateGuide(g, rules, opts = {}) {
  const errors = [];
  const err = (m) => errors.push(m);
  const ids = new Set();
  if (!Array.isArray(g?.claims) || !g?.verdict?.score_breakdown) return ["guide is missing claims or verdict.score_breakdown"];
  for (const c of g.claims) {
    if (ids.has(c.id)) err(`duplicate claim id ${c.id}`);
    ids.add(c.id);
    if (!c.statement) err(`${c.id}: missing statement`);
    if (!rules.tags.includes(c.tag)) err(`${c.id}: invalid tag "${c.tag}"`);
    if (!rules.confidence.includes(c.confidence)) err(`${c.id}: invalid confidence`);
    if (!c.checked_at) err(`${c.id}: missing checked_at`);
    if (c.tag === "Sourced") {
      if (!c.sources?.length) err(`${c.id}: Sourced needs at least one source`);
      for (const s of c.sources ?? []) {
        if (!s.url || !s.retrieved) err(`${c.id}: source needs url and retrieved date`);
        if (!["primary", "secondary"].includes(s.type)) err(`${c.id}: source.type must be primary or secondary`);
        if (opts.seenUrls && s.url && !opts.seenUrls.has(s.url)) err(`${c.id}: source ${s.url} never appeared in the search results`);
      }
      if (c.confidence === "high" && !(c.sources ?? []).some((s) => s.type === "primary")) err(`${c.id}: high confidence requires a primary source`);
    }
    if (c.tag === "Tested") {
      if (opts.forbidTested) err(`${c.id}: Tested is not allowed because no live probes were run; use Sourced, Inferred or Unknown`);
      else if (!(c.probe?.target && c.probe?.result)) err(`${c.id}: Tested needs probe.target and probe.result`);
    }
    if (c.tag === "Inferred" && !c.basis) err(`${c.id}: Inferred needs a basis`);
    if (c.tag === "Unknown" && !c.what_we_tried) err(`${c.id}: Unknown needs what_we_tried`);
  }
  const ref = (where, list) => (list ?? []).forEach((id) => ids.has(id) || err(`${where} references missing claim ${id}`));
  let sum = 0;
  for (const b of g.verdict.score_breakdown) {
    const expect = rules.score_factors[b.factor];
    if (expect === undefined) err(`unknown factor ${b.factor}`);
    else if (b.points !== expect) err(`factor ${b.factor} should be ${expect} points`);
    if (!b.claim_id) err(`factor ${b.factor} has no supporting claim`);
    ref(`factor ${b.factor}`, [b.claim_id]);
    sum += b.points;
  }
  if (sum !== g.verdict.score) err(`score ${g.verdict.score} does not equal breakdown sum ${sum}`);
  const tier = rules.tiers.find((t) => sum >= t.min && sum <= t.max)?.id;
  if (tier !== g.verdict.tier) err(`tier should be ${tier} for score ${sum}`);
  ref("verdict.your_effort", g.verdict.your_effort?.claim_ids);
  ref("verdict.provider_wait", g.verdict.provider_wait?.claim_ids);
  g.steps?.forEach((s, i) => ref(`step ${i}`, s.claim_ids));
  g.blockers?.forEach((b, i) => ref(`blocker ${i}`, b.claim_ids));
  g.expected_vs_found?.forEach((e, i) => ref(`expected_vs_found ${i}`, e.claim_ids));
  return errors;
}
