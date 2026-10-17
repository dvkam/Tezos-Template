# Tezos wallet template

A small React application for connecting a Beacon-compatible wallet, displaying its address
and balance, and sending test XTZ on Shadownet. The favicon is from the Tezos visual identity.

## Development

Use Node 24 (`.nvmrc`) and pnpm 12.14.0 (`packageManager` in `package.json`).

```sh
nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm run dev
```

Open the URL Vite prints. The app uses the Shadownet RPC at `https://tezos-shadownet.octez.io`.
Taquito 25 uses its maintained Beacon fork. Beacon enums and types come from
`@taquito/beacon-wallet/types`, so the app needs no separate Beacon SDK dependency.
Disconnect ends the wallet session through the reconnectable `wallet.disconnect()` API.
It rejects active accounts from another network. Use a funded Shadownet wallet for manual
connection and transfer checks; automated tests mock wallet calls and never transfer funds.

## Verification

```sh
pnpm run lint          # Type-aware oxlint, including React hooks and promise rules
pnpm run format:check  # Oxfmt formatting check
pnpm run typecheck     # Strict app and build-configuration TypeScript checks
pnpm test              # Validation, wallet-adapter, and React interaction tests
pnpm run build         # All checks and tests, then the Vite production build
pnpm run preview       # Serve dist/ locally
pnpm run format        # Format template files
```

Vite 8 uses Oxc for TypeScript/JSX transformation. Its experimental native React Compiler
(`oxc-transform-react`) automatically memoizes eligible components and hooks, with
recoverable compiler diagnostics logged during development and builds.
Vitest shares the Vite configuration, so interaction tests run the compiled components.
React form actions expose pending and error states.
Amounts accept up to six decimal places and are converted to safe integer mutez before
calling Taquito. Failed transfers keep the entered values; successful transfers refresh
the balance. Wallet controls are disabled while a transfer is confirming.

Shared `tsconfig.base.json` enables strictest-style checks for browser and tooling code.
`pnpm-workspace.yaml` enables automatic dependency deduplication and records resolution
settings for reproducible frozen installs. Taquito 25 no longer needs the former
Angular-only installation-script exception.

## Continuous integration

GitHub Actions runs a frozen install and `pnpm run build` on pushes and pull requests.
The workflow uses read-only repository permissions. Vite reports bundle sizes in the build
log. The former Jenkins pipeline, automatic baseline commits, and PR-comment machinery
have been removed. The validation workflow does not deploy the app or perform wallet transactions.
The separate Pages workflow publishes successful builds from `main`.

Local planning notes (`ANALYSIS.md`, `PRODUCT.md`, and `oracle/`) are outside the tracked
template and excluded from formatting. They are not part of this migration.

## GitHub Pages

Live demo: [dvkam.github.io/Tezos-Template](https://dvkam.github.io/Tezos-Template/).

The Pages workflow deploys pushes to `main` after the full build and checks pass. It can also be run manually from that branch. The workflow uses GitHub Pages metadata to set the asset base path, while local development keeps `/`.

To build the Pages layout locally:

```sh
PAGES_BASE_PATH=/Tezos-Template/ pnpm build
PAGES_BASE_PATH=/Tezos-Template/ pnpm preview
```

GitHub Pages must use the GitHub Actions publishing source. Deployments use the `github-pages` environment and GitHub's short-lived deployment token. No separate deployment secret is required.
