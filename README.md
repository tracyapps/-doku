# \*doku

An expressive family of sudoku-style puzzles for the web and Discord. Guest play is accountless: an unfinished game, preferences, and history are saved in the browser. Discord identity is an optional future sync layer, not a requirement to play.

## Local development

```bash
cd app
npm ci
cp .env.example .env
npm run dev:api
```

In another terminal, run `npm run dev:web`. The public site uses `web.html`; the framed mobile prototype uses the default Vite entry.

## GitHub roadmap and feedback

The public roadmap reads open and closed issues carrying the `roadmap` label. Create these repository labels after the first push:

- `roadmap`
- `status:planned`
- `status:in-progress`
- `status:shipped`
- `bug`
- `suggestion`

Add `roadmap` plus one status label to any issue that should appear publicly. Closing an issue also places it in Shipped. New feedback starts as `bug` or `suggestion` and stays off the roadmap until it is triaged.

Set `GITHUB_REPO=owner/repository` in Vercel. An optional, server-only `GITHUB_TOKEN` raises GitHub API limits and is useful for a private repository. `VITE_GITHUB_REPO` exposes the same public repository name to the browser so in-game feedback links are available immediately.

## Vercel

Import the GitHub repository into Vercel and choose `app` as the Root Directory. The checked-in `app/vercel.json` supplies the build and routes. Vercel’s Git integration provides preview deployments for branch pushes and production deployments from the production branch, so no deployment workflow or Vercel token is needed in GitHub Actions.

Configure these environment variables in Vercel:

- `VITE_DISCORD_CLIENT_ID=1548073007950602303`
- `DISCORD_CLIENT_ID=1548073007950602303`
- `DISCORD_CLIENT_SECRET`
- `DATABASE_URL` for durable hosted challenge data
- `GITHUB_REPO=owner/repository`
- `VITE_GITHUB_REPO=owner/repository`
- `GITHUB_TOKEN` (optional; read-only access is sufficient)

Before launch, add the final Vercel origin and Discord Activity URL mappings in the Discord Developer Portal. Never commit `.env`, `.vercel`, database credentials, a Discord client secret, or a GitHub token.
