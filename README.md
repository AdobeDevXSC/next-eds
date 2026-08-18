# Your Project's Title...
Your project's description...

## Next.js rendering layer

This project renders AEM Edge Delivery content through **Next.js App Router + React Server
Components** instead of the native client-side `aem.js` decoration. EDS remains the headless
content/authoring source (Docs/DA, sidekick, `.page`/`.live` unchanged); a Cloudflare Worker
fronts EDS and renders at the edge. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full picture.

- Content blocks are portable, vanilla OOTB blocks — `blocks/<name>/<name>.js` (`decorate()`) +
  `<name>.css`, no `.jsx`. They render natively via `aem.js` on the raw EDS URL, and via the
  `LegacyBlock` bridge in Next; the registry in [`lib/registry.js`](lib/registry.js) is an
  intentionally empty escape hatch. App features (auth, cart, menu, builder, flags) are RSC under
  `app/` + `lib/`. See [`docs/architecture/blocks-and-rsc.md`](docs/architecture/blocks-and-rsc.md)
  for the full two-tier convention.
- The EDS parse layer is in [`lib/eds/`](lib/eds) (fetch → parse → render).
- Requires Node 18+ (`nvm use 22`). Run locally with `npm run dev`; deploy with `npm run deploy:cf`.

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