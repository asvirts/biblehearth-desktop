# Release operations

No release has been certified by this scaffold. A green compilation is not runtime verification. Stable releases require the gated publication workflow and native evidence from every target. Experimental alpha prereleases follow the separate policy below; they must never be presented as stable or verified.

## Experimental alpha prereleases

The owner has authorized downloadable unsigned installers as alpha prereleases. **Publish alpha prerelease on push** runs on every push to `main` that changes application code (documentation-only pushes and commits whose message contains `[skip release]` are ignored). It runs the frontend checks, creates the next `vMAJOR.MINOR.PATCH-alpha.N` tag from the version in `package.json` and `src-tauri/tauri.conf.json` (which must match), publishes a GitHub prerelease with the standard caveats, then calls **Build unsigned alpha installers** to attach the six native builds. That build workflow can still be dispatched by hand against any existing published alpha prerelease tag. Neither workflow uses stable signing credentials or a stable updater manifest. Keep Sentry disabled, updater artifacts disabled, and the release marked as a prerelease. Never publish `latest.json` from this workflow.

Build all six planned native targets, but describe each uploaded artifact as **build-only / runtime unverified** unless the exact packaged artifact has an installed-app test receipt. The earlier macOS Apple Silicon debug verification is useful evidence, but does not certify a newly built release installer. Report missing or failed targets explicitly in the release notes; do not infer support from a successful compile. Publish checksums for the uploaded bytes and record the source commit.

Release notes must explain that installers are unsigned, macOS builds are unnotarized, platform security prompts may prevent launch, updates are manual, and users should export local data before changing versions. Do not provide commands to disable platform security protections. Content access still depends on the registered application and its licensed catalog; alpha status does not waive Scripture license obligations. Professional translation review and the full accessibility/runtime matrix remain incomplete.

## Stable release owner setup

1. Confirm `app.biblehearth.desktop`, BibleHearth branding, and `asvirts/biblehearth-desktop` as the public app identity. Register the Platform app, configure supported desktop origins, and verify licensed versions, search, attribution, and Verse of the Day on packaged applications.
2. Configure GitHub environments `release-signing` and `public-release` with required reviewers, no self-review, and protected tag/main rules. Repository administrators can bypass workflow controls; restrict that permission operationally. Never expose signing environments to pull requests.
3. Confirm access to native GitHub-hosted `ubuntu-22.04-arm` and `windows-11-arm` runners. Missing runners block release rather than falling back to emulation. The other matrix entries are native Intel/Apple Silicon macOS, Windows x64, and Ubuntu 22.04 x64.
4. Put `YOUVERSION_APP_KEY`, `TAURI_SIGNING_PRIVATE_KEY`, and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in signing-environment secrets. Generate the updater key using Tauri CLI's signer. Keep a separately secured recovery copy; losing it prevents updates to existing installations. The public key is safe to embed.
5. Supply Apple's Developer ID certificate/password, signing identity, Apple ID, app-specific password, and team ID in the `APPLE_*` secrets named in the candidate workflow. Verify code signature, notarization, and stapling on both Mac architectures.
6. Configure Windows certificate/signing infrastructure on both native Windows runners. Use a configured `bundle.windows.certificateThumbprint` or `signCommand` via the release overlay and the signing provider's supported authentication. **Windows signing is not provisioned by this repository.** GitHub-hosted runners require a real setup step for your chosen certificate provider; add that step before enabling public release. Verify Authenticode and timestamp on each installer. Never create placeholder signatures.
7. Sentry is deferred at the owner's request. The candidate workflow supplies no DSNs and release evidence must record `diagnostics: "disabled"`. If enabled later, only a personal project is permitted: add `VITE_SENTRY_ACCOUNT=personal`, `VITE_SENTRY_DSN`, `BIBLEHEARTH_SENTRY_ACCOUNT=personal`, and `BIBLEHEARTH_SENTRY_DSN` to the build configuration, then require frontend/Rust consent, withdrawal, and redaction receipts. Never embed privileged Sentry tokens.
8. Set repository variable `TAURI_RELEASE_CONFIG` to a JSON overlay, for example:

```json
{
  "bundle": { "createUpdaterArtifacts": true },
  "plugins": {
    "updater": {
      "pubkey": "YOUR_REAL_UPDATER_PUBLIC_KEY",
      "endpoints": ["https://github.com/asvirts/biblehearth-desktop/releases/latest/download/latest.json"]
    }
  }
}
```

Add the real Windows signing configuration to this overlay. `release-preflight.mjs` writes the overlay only during the candidate job. Base development builds do not pretend to have valid update credentials.

## Stable candidate and publication

Keep package and Tauri versions equal. Create an immutable `vVERSION` tag pointing at the reviewed release commit, then dispatch **Build release candidate** with that tag. It builds macOS Intel/ARM64 DMGs, Windows x64/ARM64 NSIS installers, and Linux x64/ARM64 AppImages and Debian packages. The signing environment must be configured before this workflow is usable. Installer signing and Tauri updater signing are distinct.

Install and test the exact draft artifacts, including an update from a prior signed version. Record all [verification checks](VERIFICATION.md). Upload `release-evidence.json` to the draft release. This file is an accountable human attestation, not a substitute for executing the tests. Its shape is:

```json
{
  "schemaVersion": 1,
  "diagnostics": "disabled",
  "tag": "v0.1.0",
  "commit": "FULL_RELEASE_COMMIT_SHA",
  "gates": {
    "identity": { "passed": true, "evidence": "review receipt" }
  },
  "targets": {
    "darwin-aarch64": {
      "native": true,
      "tester": "person or test-job identity",
      "environment": "OS version, native CPU, machine/VM reference",
      "checks": { "install": true }
    }
  },
  "sha256": { "EXACT_ASSET_FILENAME": "SHA256_OF_EXACT_ASSET_BYTES" }
}
```

The example is deliberately incomplete and will fail the gate. Required gates: `identity`, `contentLicenses`, `macSigningNotarization`, `windowsSigning`, `updaterSigning`, `translationReview`. When `diagnostics` is `personal`, also require `personalSentry`, `frontendConsentRedaction`, and `rustConsentRedaction`. Every gate needs `passed: true` and a nonempty evidence reference. Keep private receipts in restricted storage; public evidence should reference them without secrets.

Required targets: `darwin-x86_64`, `darwin-aarch64`, `windows-x86_64`, `windows-aarch64`, `linux-x86_64`, `linux-aarch64`. Each needs `native`, `tester`, `environment`, and every check listed in the verification document. Include SHA-256 for **every** release asset except `release-evidence.json`, including `latest.json` and signature files. Asset names and manifest entries must refer to this exact release in this repository.

Dispatch **Publish verified release** after review. It verifies draft status, exact tag commit, six native attestations, gate evidence, manifest version/URLs/signature-file consistency, and all asset hashes. It then publishes the draft, making its already-verified `latest.json` available at the stable endpoint. Signature-file matching is an integrity check, not a cryptographic verification: actual invalid-signature rejection must pass in installed applications and be attested. Never replace assets after verification; rebuild under a new candidate if bytes change.

## Current stable-release blockers

No content-license receipt, code-signing identities, notarization receipts, optional personal Sentry delivery receipts, six-target installed-app test results, or release approval is included. These cannot be manufactured by local source tests. Windows signing infrastructure needs owner provisioning; native hosted ARM runner availability must be confirmed. Locale review by a qualified reviewer remains necessary. The presence of workflows does not establish any of these gates.

## References

[Tauri GitHub distribution](https://v2.tauri.app/distribute/pipelines/github/), [updater and signing](https://v2.tauri.app/plugin/updater/), [macOS signing](https://v2.tauri.app/distribute/sign/macos/), [Windows signing](https://v2.tauri.app/distribute/sign/windows/).
