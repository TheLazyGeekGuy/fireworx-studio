# FireworX Studio

A browser editor and librarian for the **TC Electronic FireworX**, built on the MIDI Studio platform. This is an independent community project, not an official TC Electronic product.

**[Open the editor](https://thelazygeekguy.github.io/fireworx-studio/)** · [Français](README.fr.md) · [User manual](docs/instruments/fireworx/USER-MANUAL.en.md)

Alpha release. The protocol target is **FireworX OS 2.00+**; this is not certification of every firmware, MIDI interface or memory card. The application controls external hardware; it does not process audio.

## Use

1. Open the editor in a browser supporting Web MIDI and allow MIDI/SysEx access.
2. Select the FireworX input/output ports in **MIDI / Buffer** if automatic discovery cannot choose one unambiguous pair.
3. Wait for two matching P0 reads and the verified live status before editing.

Without MIDI permission, local editing and file operations remain available. Only one application should control the device at a time.

The interface and illustrated manual support English and French, with automatic browser language selection. Open the manual from the header; it follows the selected theme and offers a self-contained illustrated HTML download.

## Features

- Hardware and modern facades, native preset recall and compact signal matrix.
- Block settings, routing, decoded modulation links, Alpha/Ext MIDI Learn and controller profiles.
- Local librarian, progressive bank reads, JSON/SysEx export and complete preset preservation.
- Seeded random variations of parameters, blocks and routing with an estimated DSP budget.
- Protected temporary P0 writes with comparison/readback and an enforced quiet period for full images.
- User/Card STORE with destination backup and verification. **Complete hardware qualification and retention after restart remain pending.**

Unknown bytes are preserved rather than universally interpreted. The DSP figure is an estimate, not hardware telemetry. Global CTRL assignment read/write and actual global BPM readback are not established. Learn does not configure the physical CTRL menu. Packed User dumps are preserved but not completely decoded/restored as editable banks. See the [manual's limitations](docs/instruments/fireworx/USER-MANUAL.en.md#troubleshooting-and-known-limitations).

## Local data and privacy

Presets, preferences and journals stay in browser LocalStorage/IndexedDB unless you explicitly export them. There is no application backend, analytics or preset upload service. GitHub serves the site and may process normal hosting/access data under its own policies. Public GitHub accounts, organization names and contribution records remain public.

This repository starts with a clean source snapshot: no previous Git history, private MIDI captures, research/audit logs, personal filesystem paths or vendor manuals. Test MIDI images are generated synthetically. Original software and third-party license notices are retained. See [publication and privacy](docs/PUBLICATION.md).

## Development

Use Node.js 22.12 or later (Node 22 is used in CI).

```sh
npm ci
npm test
npm run dev
```

```sh
META_CSP=1 npm run build
npm run leak-gate -- --ci --artifact dist
npm run preview
```

The seven offline test suites use synthetic ports and generated fixtures; they never open physical MIDI devices. The build contains only the FireworX editor and required shared MIDI Studio services. Assets use relative URLs, including the embedded manual screenshots, so the build works under the repository's GitHub Pages path.

[Architecture](docs/ARCHITECTURE.md) describes the host/module boundary. The pinned GitHub Actions workflow tests, builds, checks the publication files and deploys `dist` to Pages on pushes to `main`. Deployment status is available in the repository's Actions tab.

## License

MIT; see [LICENSE](LICENSE). FireworX and TC Electronic names identify the supported hardware and remain the property of their respective owners.
