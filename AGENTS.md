# AGENTS.md

Guidance for AI agents working in this repository.

## Cursor Cloud / contextmemo

**contextmemo** is the Cursor workspace name for this repo. The codebase is **Krezzo** (npm package `budgenudge`): a Next.js 15 financial wellness app (Plaid, Supabase, SMS insights). There is no separate `contextmemo` package or directory.

### Services (local dev)

| Service | Required | Notes |
|--------|----------|--------|
| Next.js (`pnpm dev`) | Yes | http://localhost:3000 |
| Hosted Supabase | Yes | Auth + DB; no local Supabase/Docker in repo |
| Plaid sandbox | For bank linking | Optional for marketing pages only |
| OpenAI / SlickText / Resend / Update.dev | No | Needed only for those features |

### Commands

Standard scripts live in `package.json` and `README.md`:

- Install: `pnpm install`
- Dev: `pnpm dev`
- Lint: `pnpm lint` (see caveat below)
- Build: `pnpm build`
- Typecheck: `npx tsc --noEmit`

### Environment

1. Copy `.env.example` → `.env.local`.
2. **Do not** leave `NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here` — middleware parses it as a URL and returns 500 on every route. Use real project values or well-formed placeholders, e.g. `https://<project-ref>.supabase.co` plus a valid JWT-shaped anon key.
3. Full sign-in, Plaid Link, and protected routes need real `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, and `PLAID_*` secrets (configure in Cursor Cloud secrets / local `.env.local`).

### Non-obvious gotchas

- **Middleware**: `middleware.ts` runs Supabase session refresh on almost all paths (including `/api/*`). Invalid Supabase env breaks the whole app, not just auth pages.
- **pnpm + sharp**: First `pnpm install` may skip `sharp` build scripts. If `next/image` fails at runtime, allow builds for `sharp` (e.g. project `pnpm.onlyBuiltDependencies`) and reinstall.
- **Lint/build**: `pnpm lint` and `pnpm build` currently fail on pre-existing ESLint errors in `components/recurring-bills-manager.tsx` (`react/no-unescaped-entities`). `pnpm dev` and `tsc --noEmit` still work.
- **Long-running dev server**: Prefer a named tmux session, e.g. `krezzo-dev`, with `pnpm dev` from repo root.
- **E2E bank webhooks**: Point `PLAID_WEBHOOK_URL` at a public HTTPS tunnel (ngrok, etc.) to receive Plaid webhooks locally.

### Smoke checks (no real credentials)

```bash
curl -s http://localhost:3000/ | grep -q "Stay on top of your money"
curl -s http://localhost:3000/api/test
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/sign-up
```

Expected: homepage and sign-up return `200`; `/api/test` returns JSON.
