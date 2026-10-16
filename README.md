# Tezos Blockchain dApp

This is a simple dApp template that demonstrates the integration and interaction with the Tezos blockchain, showcasing:

- how a user connects/disconnects a wallet
- how to retrieve and display the wallet address and balance
- how to send Tezos to another address

> The favicon and specific background colors are from the Tezos [Visual Identity](https://tezos.com/visual-identity/) guide.

## Getting Started

1. Use Node 24 (`nvm use`) and enable Corepack (`corepack enable`). The project pins pnpm 12.14.0.
2. Create a new repository by clicking "Use this template".
3. Clone your new repository:

   `git clone <YOUR_REPOSITORY_URL>`

4. Change your current working directory to the newly cloned repository directory.
5. Install dependencies:

   `pnpm install --frozen-lockfile`

6. Start development server:

   `pnpm run dev`

7. Open http://localhost:5173/ in your browser to see a sample application.

## Building the App

1. Run the command:

   `pnpm run build`

2. After you have build the app you can run it locally:

   `pnpm run preview`

3. Open http://localhost:4173/ in your browser to see the production build.

For more information read the [Vite Guide](https://vitejs.dev/guide/static-deploy.html)
