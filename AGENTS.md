# AGENTS.md

## Cursor Cloud specific instructions

This is an Astro 5 blog + AI Wordle app deployed to Cloudflare Workers/Pages.

### Key commands

See `package.json` scripts and the README commands table. Key ones:

- **Dev server**: `pnpm dev` (port 4321)
- **Type check**: `npx astro check` (requires `@astrojs/check` and `typescript` dev deps)
- **Build**: `pnpm build`

### Dev server gotchas

- The `@astrojs/cloudflare` adapter calls `getPlatformProxy()` from wrangler on dev startup. The `astro.config.mjs` sets `platformProxy.remoteBindings: false` so the dev server works without Cloudflare authentication. Do not remove this setting unless you have `wrangler login` configured.
- The AI Wordle feature (`/wordle/ai` and `/api/chat`) requires Cloudflare Workers AI bindings and API keys that are only available in the Cloudflare production environment. The manual Wordle game at `/wordle` works fully in local dev.
- The `wrangler.jsonc` KV namespace has `"remote": true` which is only relevant for production/wrangler-authenticated dev.

### Native dependency build scripts

`package.json` includes `pnpm.onlyBuiltDependencies` to allow postinstall scripts for `esbuild`, `sharp`, `workerd`, `protobufjs`, and `@openrouter/sdk`. Without this, `pnpm install` skips native binary downloads and the dev server / build will fail.

### No test framework

This project does not have an automated test suite. Validation is done via `astro check` (type checking) and `pnpm build`.
