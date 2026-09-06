# AGENTS.md

## Cursor Cloud specific instructions

### Product

Single **Next.js 15** app (**Krezzo** / package `budgenudge`): personal finance insights (Plaid, Supabase, SMS). One local process; external services are SaaS.

### Services

| Service | Local? | Notes |
|---------|--------|--------|
| Next.js (`pnpm dev`, port **3000**) | Yes | Only required local runtime |
| Supabase | Cloud | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Plaid | Cloud | `PLAID_*` for bank link / transactions |
| OpenAI, Resend, SlickText, Update.dev, Slack | Cloud | Optional; see `.env.example` |

### Commands (from repo root)

See `README.md` and `package.json`:

- **Install:** `pnpm install` (repo has `pnpm-lock.yaml`; Vercel also documents `npm install`)
- **Dev:** `pnpm dev` → http://localhost:3000
- **Lint:** `pnpm lint` (currently fails on pre-existing `react/no-unescaped-entities` in `components/recurring-bills-manager.tsx`)
- **Build:** `pnpm build` (fails for the same ESLint errors during the build lint step)
- **Typecheck:** `npx tsc --noEmit` (passes)
- **Tests:** No `test` script; manual checks via `/protected/test-suite`, `agents/TESTING_GUIDE.md`, and `scripts/*.js`

### Environment

1. `cp .env.example .env.local` and fill real keys for auth/dashboard E2E.
2. **Middleware requires a valid Supabase URL** (`https://….supabase.co`). Placeholder strings like `your_supabase_url_here` cause `Invalid URL` on every request.
3. Plaid webhooks from localhost need a public tunnel; `PLAID_WEBHOOK_URL` in `.env.example` points at localhost for local dev only.

### Dev server

Use tmux for long-running `pnpm dev` (e.g. session `next-dev-server`). After changing `.env.local`, restart the dev server so Next.js reloads env vars.

### pnpm build scripts

If image optimization misbehaves, pnpm may ignore `sharp` postinstall until allowed (`pnpm approve-builds` or `pnpm.onlyBuiltDependencies` in `package.json`). Prefer fixing that in-repo if images break in dev.
