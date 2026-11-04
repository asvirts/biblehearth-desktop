# BibleHearth design

This is the source of truth for BibleHearth's interface. Read it before any UI change. The tokens it names live as CSS custom properties at the top of `src/styles.css`, and `tests/design-tokens.test.ts` enforces the parts a machine can check. When a visual decision changes, update this file in the same commit.

BibleHearth is for people who read the Bible every day. The interface should feel calm, editorial and cared for. It gets out of the way of the text, and it should never look like a generic template.

## Principles

1. **The content is the interface.** Chrome shrinks to a thin rail and a row of text links. Scripture, notes and passages carry the screen.
2. **One quiet canvas, flat white cards.** A cool pale gray background holds borderless white cards with a near-invisible shadow. Depth appears only on hover, focus, and floating layers.
3. **Big, light type for orientation, small mono type for facts.** Page titles are large and light. Metadata (kind, version, date, status) is small, mono and muted.
4. **One accent, used rarely.** Ember marks the current page, the primary action, a label that invites writing, and focus. Everything else is ink and gray.
5. **Generous space, low density.** Wide margins, a short measure, and few items per row. Empty space is a feature.
6. **Thin line icons, never decoration.** An icon labels an action or a kind. No icon appears only to fill space.
7. **Motion settles, it does not perform.** Short fades and small rises. Nothing bounces, and everything stops under reduced motion.
8. **Warm, brief copy.** The interface speaks softly and personally. Copy lives in `src/locales.ts` and `src/i18n.ts`. Changing it is a content decision, not a design one.

## Tokens

Two layers. Primitives (`--gray-*`, `--night-*`, `--ember-*`, `--rose-*`) hold raw values. Semantic roles (`--color-*` and the rest below) say what a value is for. Components read semantic roles only. Light and dark use the same role names. Only the values change, under `:root[data-theme="dark"]`. `App.tsx` is the single owner of the theme and sets `data-theme` on `<html>`.

### Color

| Role | Light | Dark | Use |
|---|---|---|---|
| `--color-canvas` | `#edeff2` | `#16171b` | Page background |
| `--color-surface` | `#ffffff` | `#1d1f24` | Cards, settings, reader, modals |
| `--color-surface-sunken` | `#f6f7f9` | `#24272d` | Note previews, version rows, platform messages, segmented track |
| `--color-surface-raised` | `#ffffff` | `#2f3239` | Floating bars that sit over a surface (selection bar) |
| `--color-surface-hover` | `#e3e6eb` | `#2f3239` | Hover fill for quiet buttons |
| `--color-text` | `#1d2128` | `#e7e9ed` | Primary text |
| `--color-text-muted` | `#555e6c` | `#a3abb7` | Secondary text, labels, metadata |
| `--color-text-faint` | `#737c8a` | `#7c8492` | Large placeholders and decorative glyphs only. Never body text |
| `--color-border` | `#e3e6eb` | `#24272d` | Hairlines inside cards |
| `--color-border-strong` | `#d6dae1` | `#2f3239` | Page hairlines, outlines of secondary buttons |
| `--color-control` | `#737c8a` | `#7c8492` | Boundaries of form controls (selects, search underline, switch) |
| `--color-accent` | `#b8400f` | `#f2946b` | Primary action, current page, accent labels, text links |
| `--color-accent-hover` | `#97340c` | `#f6b394` | Hover of accent fills |
| `--color-accent-soft` | `#fcefe9` | `#3b1d11` | Text selection |
| `--color-on-accent` | `#ffffff` | `#111215` | Text on accent fills |
| `--color-danger` | `#c4183c` | `#ff7a90` | Destructive action, error text |
| `--color-on-danger` | `#ffffff` | `#111215` | Text on danger fills |
| `--color-inverse` | `#1d2128` | `#e7e9ed` | Toasts, the pressed filter chip |
| `--color-on-inverse` | `#ffffff` | `#111215` | Text on inverse |
| `--color-focus` | `#b8400f` | `#f2946b` | Focus outline |
| `--color-scrim` | ink at 50% | black at 62% | Modal backdrop |
| `--color-swatch-ring` | black at 10% | white at 14% | Ring around highlight color dots |

Highlight colors (violet, coral, teal, amber) are user data that comes from the native layer. They are rendered inline and are not tokens.

Measured WCAG 2.2 contrast, light then dark. Text is 14.0 and 14.7 on canvas. Muted 5.7 and 7.7 on canvas. Accent 4.8 and 7.9 on canvas. Danger 5.9 and 6.6 on surface. On-accent 5.6 and 8.2. Faint 3.7 and 4.8 on canvas, which is why faint is restricted to large text and decoration. The test checks every role pair in both themes, and it fails if a new `--color-*` role is neither checked nor listed as decorative.

### Type

The whole Geist pack, bundled through Fontsource so the app works offline. No font loads from a CDN.

| Token | Value | Use |
|---|---|---|
| `--font-sans` | Geist (variable), then system fallbacks for Arabic, Korean and Chinese | All interface text |
| `--font-mono` | Geist Mono (variable) | Metadata: version, dates, save status, language code, preview banner |
| `--font-pixel` | Geist Pixel, latin only | The "BibleHearth" wordmark and nothing else |
| `--font-label` | `--font-mono`, or `--font-sans` in ar, ko, zh | The label role |
| `--font-meta` | `--font-mono`, or `--font-sans` in ar, ko, zh | The meta role (mono would break Arabic joining) |
| `--font-reading-serif` | System serif (Iowan, Charter, Georgia) | Scripture when the reader picks the serif option. The default reading font is Geist Sans |

Geist covers Latin, Cyrillic and Vietnamese. Arabic, Korean and Chinese fall back to the system fonts named in `--font-sans`.

| Size token | rem | Use |
|---|---|---|
| `--text-label` | 0.6875 | Labels and metadata |
| `--text-sm` | 0.8125 | Buttons, chips, secondary copy |
| `--text-base` | 0.9375 | Body |
| `--text-md` | 1.0625 | Lead paragraphs, settings section titles, note editor |
| `--text-lg` | 1.25 | Card passage references, section headings |
| `--text-xl` | 1.625 | Modal titles, empty-state titles, library search |
| `--text-2xl` | 2.125 | Continue-reading title, fatal screens |
| `--text-display` | 2.25 to 3.5, fluid | Page titles |

Weights are `--weight-light` (300) for display and titles, `--weight-regular` (400) for text, and `--weight-medium` (500) for buttons and labels. Never bold. Leading is `--leading-tight` (1.08, or 1.3 in Arabic), `--leading-snug` (1.3) and `--leading-body` (1.6). Tracking is `--tracking-display` (-0.035em), `--tracking-title` (-0.015em) and `--tracking-label` (0.08em). All three become 0 in Arabic, Korean and Chinese. The label case (`--case-label`) is uppercase, and `none` in those languages, where the label size (`--size-label`) also grows from `--text-label` to `--text-sm` so the script stays legible.

Type roles:

- **Display.** `.page-heading h1`. `--text-display`, light, display tracking.
- **Title.** Modal, empty-state, confirm and fatal headings. `--text-xl` or `--text-2xl`, light, title tracking.
- **Label.** `.label`. Mono, uppercase, tracked, muted. Add `.accent` for an invitation ("Note", empty library). Use the class. Do not rebuild the recipe.
- **Meta.** Version, date, save status, language code, preview banner. `--font-meta` (mono, sans in ar, ko, zh), `--text-label`, muted.

### Space, size and layout

| Token | Value |
|---|---|
| `--space-1` to `--space-9` | 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6 rem |
| `--control-sm`, `--control-md`, `--control-lg` | 2, 2.25, 2.5 rem (chips, icon buttons, buttons and selects) |
| `--rail-width` | 4.5rem |
| `--content-max` | 70rem |
| `--settings-max` | 45rem |
| `--measure` | 60ch |

### Radius, shadow, layers

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 4px | Focus rings on inline links |
| `--radius-sm` | 6px | Note previews, version rows, selects |
| `--radius-md` | 8px | Cards |
| `--radius-lg` | 12px | Modals, mobile selection sheet |
| `--radius-pill` | 999px | Buttons, chips, segmented control, selection bar |
| `--shadow-card` | 1px, nearly invisible | Resting cards |
| `--shadow-outline` | 1px inset hairline | Secondary buttons, pressed segment |
| `--shadow-raised` | soft 32px | Hovered cards, selection bar, toasts |
| `--shadow-modal` | deep 80px | Modals, mobile drawer |
| `--z-sticky`, `--z-rail`, `--z-floating`, `--z-modal`, `--z-toast`, `--z-skip` | 10, 20, 30, 50, 60, 100 | Stacking order |

### Motion

| Token | Value |
|---|---|
| `--ease-standard` | cubic-bezier(0.2, 0, 0, 1) |
| `--ease-out` | cubic-bezier(0.16, 1, 0.3, 1) |
| `--duration-fast` | 120ms (color and hover) |
| `--duration-base` | 200ms (shadows, backdrop fade) |
| `--duration-slow` | 320ms (modal settle, bar rise, drawer) |

Animations are `fade`, `settle` (6px rise with a slight scale) and `rise` (8px). They animate opacity and transform only. `prefers-reduced-motion` turns all animation and transition off.

## Iconography

Phosphor (`@phosphor-icons/react`), weight `light`. `App.tsx` sets defaults through `IconContext` (size 18, light, `aria-hidden`, not focusable), so an icon never adds to an accessible name. Sizes come from a short scale: 14 (meta, inline with small text), 16 (buttons), 18 (default), 20 (rail and close buttons), 32 (empty states). Arrows that point along the reading direction take `className="directional"` and mirror in RTL.

| Meaning | Icon |
|---|---|
| Note | `PencilSimpleLine` |
| Highlight | `HighlighterCircle` (a color swatch replaces it on highlight cards) |
| Bookmark | `BookmarkSimple` |
| Library, empty library | `Books` |
| Settings | `GearSix` |
| Theme | `Sun`, `Moon`, `Desktop` |
| Open passage, go | `ArrowUpRight`, `ArrowRight` |
| Search | `MagnifyingGlass` |
| Delete | `Trash` |
| Backup | `DownloadSimple`, `UploadSimple` |
| Private by design | `ShieldCheck` |
| Offline | `WifiSlash` |
| Menu, close, saved | `List`, `X`, `Check` |

The ember book mark in `Brand` is BibleHearth's logo. Its fixed colors are the only literal colors allowed in TSX, besides user highlight colors.

## Components

All classes live in `src/styles.css`.

- **Shell.** `.rail` is a fixed column at the inline start. It holds the brand mark with the vertical Geist Pixel wordmark at the top, and the theme toggle, language code and settings at the bottom. `.topbar` holds the primary nav as text links at the inline end. The current page gets a 2px ember underline under its label. Below 800px the rail becomes a drawer opened by the menu button, and the nav stays in the top bar.
- **Page heading.** `.page-heading`. An optional label, a display title, a muted lead, and a hairline below.
- **Card.** `.card` is the surface recipe (white, `--radius-md`, `--shadow-card`). Variants add layout: `.continue-card`, `.daily-card`, `.saved-card`, `.settings-card`, `.onboarding-card`, `.empty-card`, `.platform-reader`.
- **Saved card.** Label with kind icon or color swatch, then the delete button, the passage reference as a link, the version (meta), a note preview on a sunken surface, then the date (meta) and edit button. The card lifts to `--shadow-raised` on hover and focus-within.
- **Buttons.** `.button.primary` (accent pill), `.button.secondary` (surface pill with outline), `.button.ghost` (text only, for cancel), `.button.danger`. `.text-button` is an accent text link. `.icon-button` is a round quiet button, and `.quiet` makes it smaller. YouVersion SDK wrappers in `src/platform/` use `.button.secondary` too.
- **Library search.** `.search-field` is a large light input on an underline, like a title you type into. `.chips` holds filter chips. The pressed chip turns inverse.
- **Settings.** Single column of `.settings-card`s, each with a title and a hairline. `.segmented` is the theme control. `.switch` is a styled native checkbox. Ranges use the accent color.
- **Selection bar.** `.selection-bar` is a floating pill on `--color-surface-raised` with the reference, note and bookmark actions, highlight color dots and close. On mobile it becomes a sheet.
- **Modal.** `.modal` with size `narrow`, `regular` or `wide`. It traps focus, closes on Escape and backdrop click, and returns focus. The note editor is a wide modal with an accent "Note" label, a light title, and a borderless textarea between hairlines.
- **Confirm.** `.confirm`. Centered light title, muted text, ghost cancel and danger delete.
- **Toast.** `.toast` is an inverse rounded box at the bottom inline end. `.update-toast` stacks above it.
- **Platform message.** `.platform-message` is a sunken box for SDK states (missing key, offline, errors), with a secondary retry button.

## Screen inventory

Every screen and state, with the harness scenario that captures it. The harness lives outside the repo. It seeds browser-preview storage and answers YouVersion API requests with fixtures, so all of these render in `bun run dev`.

| Screen or state | Where | Scenario |
|---|---|---|
| Loading | `App` before storage loads | `loading` |
| Storage failed | `App` load error | `load-error` |
| Home, new user | Home without a location or saved items | `home-empty` |
| Home | Continue reading, verse of the day, recent saved items | `home-filled` |
| Choose a Bible | Reader without a location, version catalog | `reader-onboarding` |
| Reader | Passage with the YouVersion reader | `reader` |
| Verse selected | Selection bar | `reader-selection` |
| Note editor | Wide modal | `note-editor` |
| Change version | Modal with the catalog | `version-chooser-modal` |
| Library | All saved items | `library-filled` |
| Library filtered | Notes only | `library-filter-notes` |
| Library, no match | Search with no results | `library-search-empty` |
| Library, empty | No saved items | `library-empty` |
| Delete confirmation | Narrow modal | `delete-confirm` |
| Settings | Appearance, privacy, backups, updates, about | `settings` |
| Toast | Backup action in the browser preview | `toast` |
| Offline | Offline badge and offline message | `offline` |
| Scripture failed | SDK request error | `platform-error` |
| Not connected | No platform key | `missing-key` |
| Mobile drawer | 390px wide | `mobile-nav` |
| Update available | Floating update button | Tauri only, not reachable in the preview |
| Something interrupted | Error boundary | Only on a render crash |

Arabic RTL captures cover home, reader, library, settings and the note editor.

## Accessibility

- WCAG 2.2 AA contrast for every text and control role, in both themes, checked by the test.
- Focus is always visible. The global rule is a 2px `--color-focus` outline with a 2px offset. Inputs that hide their own outline (search field, note editor) show focus on their container or hairline instead.
- Every action is a native button with a text or `aria-label` name. Toggles expose `aria-pressed`. The current page exposes `aria-current`.
- Layout uses logical properties (`inset-inline`, `margin-inline`, `padding-inline`, `text-align: start`), so Arabic mirrors without separate rules.
- Passage references are wrapped in `<bdi>`, and user-written text (note editor, note previews) takes `dir="auto"`, so an English note in the Arabic interface still reads left to right. The SDK's book and chapter button is read as one `unicode-bidi: plaintext` run, so RTL shows "John 1", not "1 John".
- Forced colors mode gives cards, buttons, chips, modals, toasts and the selection bar a real border.

## Do not

- Do not write a color literal outside the two token blocks in `styles.css`. Add a primitive and a role instead. The test fails otherwise.
- Do not read a primitive (`--gray-*`, `--night-*`, `--ember-*`, `--rose-*`) from a component. Read a role.
- Do not add a dark-mode rule outside the dark token block. If dark needs a different value, it needs a role.
- Do not add a `:lang()` rule to a component. Language differences belong in the token layer.
- Do not load fonts or styles from a CDN. New fonts come through Fontsource or local files. `vite.config.ts` strips remote `@import`s, and the CSP allows no font host.
- Do not add decorative art. That means glows, gradients, orbit rings, sparkles, ornamental glyphs, illustration blobs and dark hero cards.
- Do not use serif display type, bold weights, or all-caps headings. Uppercase belongs to the label role only.
- Do not use the accent for more than one call to action per view, or as a background for large areas.
- Do not put an icon in a section heading, or use an icon without a label or `aria-label`.
- Do not change i18n strings as part of a visual change.
- Do not add a new pill or card recipe. Compose `.button`, `.chip`, `.card` and `.label`.
