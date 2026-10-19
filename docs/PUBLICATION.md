# Publication and privacy

The public repository contains the standalone FireworX editor, required shared MIDI Studio services, build/test scripts and illustrated EN/FR manuals. It excludes upstream Git history, local audit/research reports, physical MIDI captures, device dumps, vendor PDFs, local caches, credentials and personal workspace paths. Synthetic test images are generated under ignored `tests/generated/`.

The automated leak gate checks common credential patterns, personal home paths, private network addresses, email addresses and embedded image metadata. Maintainers can additionally use a private denylist stored outside Git; the default location is described in `scripts/leak-gate.mjs`. Findings identify files/rules without echoing the matched value. CI runs generic checks on source, commit identities/messages and `dist`. These checks reduce accidental disclosure; they cannot prove anonymity or identify every possible sensitive value.

Before a maintainer push:

```sh
npm test
META_CSP=1 npm run build
npm run leak-gate -- --artifact dist
```

The full gate requires the external private denylist. CI uses `--ci` because that list must never be published. Commit emails use GitHub noreply identities; license attribution is preserved. GitHub still exposes public organization/account names, commit records, workflow runs and hosting infrastructure. Browsing the deployed application also involves GitHub's normal hosting/access processing.

There is no analytics SDK or application server. MIDI data are handled by the browser and selected local MIDI ports. Local libraries/journals are not uploaded by this application. Downloads are explicit. Clearing site data removes browser-held data; export copies before migration. An initial visit still downloads application assets from the hosting origin, and the service worker can cache them for later use.

Deployment is performed by the pinned Pages workflow. Only `dist` is uploaded as the site. The source repository remains separately public. Actions require no personal deployment token; the job uses GitHub's scoped Pages/OIDC permissions. A successful local build is not deployment proof: inspect the Actions run and live site after pushing.
