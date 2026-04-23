---
description: Run the pre-commit checklist for cf_ai_shadow (types, lint, tests, wrangler dry-run)
allowed-tools: Bash, Read
---

Run the four checks below in order. Do not skip or reorder. Parse each command's exit code and output; note pass/fail per step.

## 1. Wrangler types

Regenerate `worker-configuration.d.ts` so the rest of the build type-checks against the current `wrangler.toml`.

```
npx wrangler types
```

## 2. TypeScript

Strict type-check, no emit. This must pass cleanly — warnings are fine, errors are not.

```
npx tsc --noEmit
```

## 3. Tests

Run the full vitest suite once (no watch).

```
npx vitest run
```

## 4. Deploy dry-run

Ensure the Worker builds and `wrangler.toml` is valid without actually deploying.

```
npx wrangler deploy --dry-run --outdir=/tmp/shadow-dryrun
```

## Skipped vs failed

If a tool isn't installed yet (common in early milestones — e.g. `vitest` not added until M4, no tests to run in M1-M2), mark that step as **skipped**, not failed. Skipped steps do not block a commit. Missing `wrangler` or `tsc` *do* block a commit.

## Lint (optional)

If a lint config exists at the repo root (`biome.json`, `.eslintrc*`, or `eslint.config.*`), additionally run:

```
npx biome check . || npx eslint .
```

and include the result. If no config is present, skip.

## Report format

Print a concise summary in this exact shape:

```
shadow-check — M{n}
  [✓] wrangler types
  [✓] tsc --noEmit
  [✓] vitest run
  [✓] wrangler deploy --dry-run
  [-] lint (not configured)

Ready to commit.
```

Replace `[✓]` with `[✗]` on failure and `[-]` on skip. If any step failed, append the first 20 lines of its stderr/stdout under a `--- Failures ---` heading and end with `Not ready to commit.` instead of `Ready to commit.`

## Do not

- Do not attempt to fix failures automatically. Surface them and stop.
- Do not run `wrangler deploy` (without `--dry-run`). This command is read-only with respect to Cloudflare's production state.
- Do not commit. The user decides when to commit; you just report readiness.
