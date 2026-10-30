# Will your OAuth app get approved?

Look up an app and get a guide that says how hard approval is, how long it takes (your effort vs. waiting on the provider), what can block you, what an agent can do for you, and where you take over. Every claim is tagged with how we know it.

## The problem

Before an AI agent can connect to a user's Gmail, Slack or LinkedIn, the developer usually has to register an OAuth app with that provider. That ranges from a 10-minute form to weeks of review, business verification or a paid security audit. Developers find out which one they are in only after they have started. The docs exist; the missing piece is knowing the path up front. So each guide leads with a verdict, not a tutorial.

## What is in this repo

| Path | What it does |
|---|---|
| `index.html` | The whole front end (no build step). Library guides plus a lookup box. |
| `guides/` | Ready-made guides as JSON. `index.json` lists them. Currently: Google (Gmail API). |
| `schema/rules.json` | The evidence tags, the visible difficulty formula, and tier cutoffs. |
| `lib/validate.mjs` | The evidence checker, shared by the CLI and the live generator. |
| `scripts/validate.mjs` | `npm run validate` checks every guide against the rules. |
| `api/generate.js` | Live generation for any app (Vercel function). |

## Run it

**Just the ready-made guides (GitHub Pages, free, no key):** upload this folder to a GitHub repo, then Settings → Pages → deploy from the `main` branch, root folder.

**With live generation (any app):** GitHub Pages cannot run server code, so deploy the same repo on Vercel (free): import the GitHub repo, then add the environment variable `ANTHROPIC_API_KEY`. Optionally add `ACCESS_CODE` so strangers cannot spend your credits; the page will ask for it. Never commit your key. `.env.example` shows the names.

**Check the guides locally:** `node scripts/validate.mjs`

## Key decisions

- **Verdict first.** Guides open with one of three tiers (self-serve, review-gated, partner-gated), because every other piece of advice depends on which one you are in.
- **Evidence over polish.** Every claim is Tested, Sourced, Inferred or Unknown. The checker refuses a claim without the proof its tag requires (a URL and date for Sourced, a basis for Inferred, what we tried for Unknown). High confidence needs an official source.
- **A difficulty score people can argue with.** Points per factor (review +2, business verification +2, security audit +3, paid requirement +1, partner program +3, annual revalidation +1) and each point links to the claim that earned it.
- **The live flow is the same pipeline.** The generator researches with web search, then the same checker runs on its output. It rejects "Tested" (no live probes are run), rejects any source URL that did not appear in the search results, and gets one repair attempt. Remaining problems are shown on the page, not hidden.
- **Ranges, not fake precision.** Wait times are shown as ranges tagged Inferred with low confidence when sources conflict.

## What was checked, and what was not

Google (Gmail) guide: researched on 2026-10-28 from web search results. 13 Sourced, 2 Inferred, 1 Unknown, 0 Tested.

- **Corrected:** I expected every Gmail scope to need a security audit. Sources say `gmail.send` is only "sensitive", so a send-only agent avoids it. I also expected approval to be one-time; restricted scopes re-verify every year (Google's own page).
- **Conflicting:** sources disagree on review time (under a week vs. several weeks vs. Google gives no number), so the guide gives a planning range and says why.
- **Weak:** only Google's verification help page is a primary source. Scope lists, cost and timing come from vendors (Composio, Nango, Leviathan, consultancies) who benefit from Google looking hard, and are labeled secondary. Check scope categories on Google's Gmail scopes page before relying on them.
- **Not tested:** no live probes (OIDC discovery, authorize endpoint) were run, because the research sandbox could not reach Google's servers. Nothing is tagged Tested.

## Limitations

- Only one ready-made guide so far. The schema and generator are built to produce the rest.
- The live generator was tested against a simulated API response (it catches fabricated tests and sources and repairs them). It has **not** been run against the real Anthropic API with a key; check the first real run and the model name (`ANTHROPIC_MODEL`, default `claude-sonnet-4-6`).
- Live guides are not saved or shareable by link; use Download JSON. Persistent share links need storage (for example a database) that is not included.
- The checker confirms a source URL appeared in search results, not that the page says what the claim says. Treat live guides as a first draft and read the linked source.
- No probe runner yet, no browser automation of provider signup, no accounts.
- Live generation spends API credits per lookup and has no rate limiting beyond the optional access code.
