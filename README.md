# TatarusLedger

A TypeScript and React web tool utilizing Universalis data to find profitable crafting, gathering, and market arbitrage opportunities for the hit MMORPG Final Fantasy XIV.

## Deployment

The official project website is deployed to GitHub Pages at:

- https://GwenNealon.github.io/TatarusLedger/

Deployment is handled by `.github/workflows/pages.yml` and publishes on every push to `main` (or manual `workflow_dispatch`).

### One-time repository setup

1. Open **Settings → Pages**.
2. Set **Build and deployment** source to **GitHub Actions**.

### Update the website

1. Update content in `src/`.
2. Verify changes locally:
   - `npm run format:check`
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
3. Merge/push to `main`.
4. The **Deploy to GitHub Pages** workflow builds and publishes the updated site automatically.

### Rollback

If a deployment needs to be rolled back, revert the commit on `main` and push the revert commit. GitHub Pages will redeploy the previous stable content automatically through the same workflow.

### Accessibility and responsiveness

The public homepage uses semantic landmarks (`main`, headings, section labels), readable text contrast, and fluid layout sizing so it remains usable across desktop and mobile screens.
