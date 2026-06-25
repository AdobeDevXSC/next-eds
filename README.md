# Your Project's Title...
Your project's description...

## Next.js rendering layer

This project renders AEM Edge Delivery content through **Next.js App Router + React Server
Components** instead of the native client-side `aem.js` decoration. EDS remains the content +
authoring source (Docs/DA, sidekick, `.page`/`.live` unchanged), consumed for decoupled
rendering; the app **prerenders to static HTML** (`output: 'export'`) at build time, which you
host anywhere. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full picture.

- Blocks live in `/blocks/<name>/`: `Name.jsx` (the React component) + `name.js` (entry shim)
  + `name.css`. The registry in [`lib/registry.js`](lib/registry.js) maps block name → component.
- The EDS parse layer is in [`lib/eds/`](lib/eds) (fetch → parse → render → metadata).
- Requires Node 18+ (`nvm use 22`). Run locally with `npm run dev`.
- The app **prerenders to static HTML** (`output: 'export'`): `npm run build` → `out/`, then
  host that folder anywhere. See [DEPLOYMENT.md](./DEPLOYMENT.md).

> Status: spike — `hero`, `cards`, and `columns` are converted. Other blocks still have their
> native `aem.js` decorate functions and render as placeholders until ported.

## Environments
- Preview: https://main--{repo}--{owner}.aem.page/
- Live: https://main--{repo}--{owner}.aem.live/

## Documentation

Before using the aem-block-collection, we recommand you to go through the documentation on https://www.aem.live/docs/ and more specifically:
1. [Developer Tutorial](https://www.aem.live/developer/tutorial)
2. [The Anatomy of a Project](https://www.aem.live/developer/anatomy-of-a-project)
3. [Web Performance](https://www.aem.live/developer/keeping-it-100)
4. [Markup, Sections, Blocks, and Auto Blocking](https://www.aem.live/developer/markup-sections-blocks)
5. [AEM Block Collection](https://www.aem.live/developer/block-collection#block-collection-1)

## Installation

```sh
npm i
```

## Linting

```sh
npm run lint
```

## Local development

1. Create a new repository based on the `aem-block-collection` template and add a mountpoint in the `fstab.yaml`
1. Add the [AEM Code Sync GitHub App](https://github.com/apps/aem-code-sync) to the repository
1. Install the [AEM CLI](https://github.com/adobe/helix-cli): `npm install -g @adobe/aem-cli`
1. Start AEM Proxy: `aem up` (opens your browser at `http://localhost:3000`)
1. Open the `{repo}` directory in your favorite IDE and start coding :)