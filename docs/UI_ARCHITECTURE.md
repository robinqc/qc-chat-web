# Stoat for Web -- UI Architecture Guide

Reference for navigating, theming, and modifying the frontend UI.

---

## Table of Contents

1. [Repository Structure](#repository-structure)
2. [Build & Dev](#build--dev)
3. [Styling Stack](#styling-stack)
4. [Theming System](#theming-system)
5. [CSS Variable Reference](#css-variable-reference)
6. [Component Inventory](#component-inventory)
7. [Layout Architecture](#layout-architecture)
8. [State Management](#state-management)
9. [Modal System](#modal-system)
10. [Routing](#routing)
11. [Phase 1 Changes Log](#phase-1-changes-log)

---

## Repository Structure

pnpm monorepo (`pnpm-workspace.yaml`):

```
qc-chat-web/
  packages/
    client/              # Main SolidJS frontend (this is where all UI lives)
      src/               # App pages, layout shell, routing
      components/        # Reusable UI, state stores, modals, features
      styled-system/     # Panda CSS generated output (do not edit)
      panda.config.ts    # Panda CSS configuration
    stoat.js/            # API client library
    solid-livekit-components/  # LiveKit voice/video bindings
    js-lingui-solid/     # i18n (Lingui) SolidJS bindings
```

### Key directory map inside `packages/client/`

```
src/
  index.tsx                          # Entry point, imports mdui.css, mounts Router
  Interface.tsx                      # Main layout shell (Layout + Content styled divs)
  interface/
    Sidebar.tsx                      # Sidebar orchestrator (server list + channel list)
    Development.tsx                  # Dev tools page
    Discover.tsx                     # Server discovery
    channels/
      ChannelHeader.tsx              # Channel header bar (title, search, actions)
      text/
        TextChannel.tsx              # Text channel page (messages + member sidebar)
        Composition.tsx              # Message composition area
        MemberSidebar.tsx            # Member list sidebar
      voice/                         # Voice channel UI
    navigation/
      servers/                       # Server list rail
      channels/
        common.tsx                   # SidebarBase (channel sidebar container)
        ServerChannelList.tsx         # Channel list for servers
        DMList.tsx                   # DM channel list

components/
  ui/
    components/
      design/                        # 23 design system atoms
      layout/                        # Layout primitives (Column, Row, Header, Main)
      features/
        messaging/                   # Message rendering, composition, bars
          composition/
            MessageBox.tsx           # CodeMirror message input + action buttons
          elements/                  # Individual message element renderers
        texteditor/                  # CodeMirror editor wrapper
    themes/                          # All theming files (see Theming System)
    web-components.d.ts              # MDUI web component type declarations
    styles/                          # Global CSS imports
  state/
    stores/
      Theme.ts                       # Theme store (accent, mode, font, variant, etc.)
      Layout.ts                      # Layout state (sidebar visibility)
      Draft.ts                       # Message draft persistence
      Ordering.ts                    # Server/channel ordering
      ...
  modal/
    modals/                          # 54 modal components (see Modal System)
  app/
    interface/
      settings/                      # Settings pages (user, server, channel)
        _layout/
          Sidebar.tsx                # Settings sidebar
          SidebarButton.tsx          # Settings sidebar button (uses primary-container)
          Content.tsx                # Settings content area
```

---

## Build & Dev

There is no `build` script in `package.json`. Use Vite directly:

```bash
# From packages/client/
npx vite dev          # Dev server
npx vite build        # Production build
npx vite preview      # Preview production build
```

Panda CSS regeneration (after changing `panda.config.ts`):

```bash
npx panda codegen
```

---

## Styling Stack

Three systems work together. All three are active; none can be removed without a migration.

### 1. Panda CSS (`@pandacss/dev` v0.46.1)

The primary CSS-in-JS engine. ~140 files import from the generated `styled-system/` directory.

**Config:** `packages/client/panda.config.ts`

- `jsxFramework: "solid"` -- generates SolidJS-compatible `styled()` factory
- `preflight: true` -- CSS reset enabled
- `include`: scans both `src/` and `components/`
- Custom keyframes: `materialPhysicsButtonSelect`, `scrimFadeIn`, `slideIn`, `highlightMessage`, `skeletonShimmer`

**APIs used in components:**

- `styled("div", { base: {...}, variants: {...} })` -- styled components with variants
- `cva({ base: {...}, variants: {...} })` -- class variance authority (className generators)
- `css({...})` -- inline style objects
- `cx(...)` -- class merging

**Import paths:** Always from `styled-system/jsx` (for `styled`), `styled-system/css` (for `css`, `cva`, `cx`).

### 2. MDUI v2.1.3 (Material Design web components)

16 MDUI web components are used, declared in `components/ui/web-components.d.ts`:

| Web Component                 | Wrapped By                   |
| ----------------------------- | ---------------------------- |
| `mdui-checkbox`               | `design/Checkbox.tsx`        |
| `mdui-circular-progress`      | `design/LoadingProgress.tsx` |
| `mdui-segmented-button`       | (used directly)              |
| `mdui-segmented-button-group` | (used directly)              |
| `mdui-menu-item`              | `design/Menu.tsx`            |
| `mdui-badge`                  | `design/Badge.tsx`           |
| `mdui-navigation-rail`        | (server list rail)           |
| `mdui-navigation-rail-item`   | (server list items)          |
| `mdui-select`                 | `design/FloatingSelect.tsx`  |
| `mdui-list`                   | `design/List.tsx`            |
| `mdui-list-item`              | `design/List.tsx`            |
| `mdui-list-subheader`         | `design/List.tsx`            |
| `mdui-text-field`             | `design/TextField.tsx`       |
| `mdui-slider`                 | `design/Slider.tsx`          |
| `mdui-radio`                  | `design/Radio.tsx`           |
| `mdui-radio-group`            | `design/Radio.tsx`           |

MDUI CSS is loaded globally: `import "mdui/mdui.css"` in `src/index.tsx`.

MDUI consumes `--mdui-color-*` CSS variables (R,G,B triplets), which are generated from the same M3 scheme as `--md-sys-color-*` (hex values).

### 3. Inline styles

Some components use SolidJS `style={{...}}` for dynamic values (e.g., `document.body.style.setProperty()` in `LoadTheme.tsx`).

---

## Theming System

### Data Flow

```
Theme.ts store (user preferences)
        |
        v
LoadTheme.tsx (createEffect -- runs on any theme change)
        |
        +---> stoatWebTheme.ts  --> app CSS variables (gaps, radii, layout, fonts, effects, brand)
        +---> materialTheme.ts  --> --md-sys-color-* (37 hex values)
        +---> materialTheme.ts  --> --mdui-color-*   (37 R,G,B triplets for MDUI)
        |
        v
document.body.style.setProperty(key, value)  -- all variables set on <body>
```

### Theme Store (`components/state/stores/Theme.ts`)

```typescript
type TypeTheme = {
  preset: "you"; // Only "you" (Material You) is supported
  mode: "light" | "dark" | "system"; // Light/dark/auto
  m3Accent: string; // Hex accent color (default "#5470ec")
  m3Contrast: number; // Contrast level (default 0.0)
  m3Variant:
    | "monochrome"
    | "neutral"
    | "tonal_spot"
    | "vibrant"
    | "expressive"
    | "fidelity"
    | "content"
    | "rainbow"
    | "fruit_salad";
  blur: boolean; // Allow blurry surfaces
  interfaceFont: Fonts; // Default "Inter"
  monospaceFont: MonospaceFonts; // Default "Fira Code"
  messageSize: number; // Default 14
  messageGroupSpacing: number; // Default 12
};
```

### M3 Color Generation (`materialTheme.ts`)

Uses `@material/material-color-utilities` to generate a full Material 3 scheme from the accent hex color.

9 scheme variants supported: `tonal_spot` (default), `content`, `expressive`, `fidelity`, `fruit_salad`, `monochrome`, `neutral`, `rainbow`, `vibrant`.

**How to change colors globally:** Modify the return object in `generateMaterialYouScheme()` (line 181). Each key maps directly to a `--md-sys-color-*` CSS variable. You can remap any slot to any scheme property. For example, our Phase 1 change remaps `primary-container` to `surfaceContainerHigh` for muted highlights.

### Available Fonts

**Interface fonts** (15): Inter, Open Sans, OpenDyslexic, Atkinson Hyperlegible, Roboto, Noto Sans, Bitter, Lato, Lexend, Montserrat, Poppins, Raleway, Ubuntu, Comic Neue, IBM Plex Sans Variable, Plus Jakarta Sans Variable

**Monospace fonts** (7): JetBrains Mono, Fira Code, Roboto Mono, Source Code Pro, Space Mono, Ubuntu Mono, IBM Plex Mono

Fonts are lazy-loaded via `@fontsource` on first use.

---

## CSS Variable Reference

All variables are set on `document.body.style` by `LoadTheme.tsx`.

### Material 3 Color Tokens -- Detailed Usage Map

37 tokens, all hex values. These are the primary color system for the entire app.
Every usage below references files under `packages/client/`.

#### `--md-sys-color-primary` -- Main accent

Used for: filled button/icon-button backgrounds, link text, accent borders, active indicators.

| CSS Property      | UI Element                                     | File                                                                           |
| ----------------- | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| background        | Button "filled" variant bg                     | `components/ui/components/design/Button.tsx`                                   |
| background        | IconButton "filled" variant bg                 | `components/ui/components/design/IconButton.tsx`                               |
| background        | CategoryButton "filled" variant bg             | `components/ui/components/design/CategoryButton.tsx`                           |
| background        | Avatar high-contrast variant bg                | `components/ui/components/design/Avatar.tsx`                                   |
| background        | Unread message divider badge bg                | `components/ui/components/features/messaging/elements/MessageDivider.tsx`      |
| background        | "New messages" floating indicator bg (55% mix) | `components/ui/components/features/messaging/bars/FloatingIndicator.tsx`       |
| background        | Markdown internal link pill bg                 | `components/markdown/plugins/anchors.tsx`                                      |
| background        | Mention pill (in-editor) bg                    | `components/markdown/plugins/mentions.tsx`                                     |
| background        | Add bot modal "added" badge bg                 | `components/modal/modals/AddBot.tsx`                                           |
| --color           | Button "elevated" variant text                 | `components/ui/components/design/Button.tsx`                                   |
| --color           | Button "text" variant text                     | `components/ui/components/design/Button.tsx`                                   |
| color             | Text editor rendered anchor links              | `components/ui/components/design/TextEditor.tsx`                               |
| color             | Markdown external link text                    | `components/markdown/plugins/anchors.tsx`                                      |
| color             | Voice call "CONNECTED" status text             | `components/ui/components/features/voice/callCard/VoiceCallCardStatus.tsx`     |
| color             | Edit message action link text                  | `components/app/interface/channels/text/EditMessage.tsx`                       |
| color             | System message icons (join, pin, rename, etc.) | `components/ui/components/features/messaging/elements/SystemMessageIcon.tsx`   |
| borderBottomColor | FloatingSelect focused/open border             | `components/ui/components/design/FloatingSelect.tsx`                           |
| borderTop         | Unread message divider line                    | `components/ui/components/features/messaging/elements/MessageDivider.tsx`      |
| borderInlineStart | Text embed left accent border                  | `components/ui/components/features/messaging/elements/TextEmbed.tsx`           |
| outlineColor      | Voice call speaking user outline               | `components/ui/components/features/voice/callCard/VoiceCallCardActiveRoom.tsx` |
| outline           | Drag-and-drop target outline (40% mix)         | `components/ui/components/utils/Draggable.tsx`                                 |
| fill              | New user indicator icon                        | `components/app/interface/channels/text/Message.tsx`                           |
| scrollbarColor    | Global scrollbar thumb color                   | `components/ui/directives/scrollable.ts`                                       |

#### `--md-sys-color-on-primary` -- Text/icons on primary

Used for: text and icons displayed on `primary`-colored backgrounds.

| CSS Property | UI Element                                 | File                                                                      |
| ------------ | ------------------------------------------ | ------------------------------------------------------------------------- |
| --color      | Button "filled" variant text               | `components/ui/components/design/Button.tsx`                              |
| --color      | CategoryButton "filled" variant text       | `components/ui/components/design/CategoryButton.tsx`                      |
| --colour     | IconButton "filled" variant icon           | `components/ui/components/design/IconButton.tsx`                          |
| color        | Avatar high-contrast variant text          | `components/ui/components/design/Avatar.tsx`                              |
| color        | Unread message divider badge text          | `components/ui/components/features/messaging/elements/MessageDivider.tsx` |
| color        | "New messages" floating indicator text     | `components/ui/components/features/messaging/bars/FloatingIndicator.tsx`  |
| color        | Markdown internal link pill text           | `components/markdown/plugins/anchors.tsx`                                 |
| color        | Mention pill (in-editor) text              | `components/markdown/plugins/mentions.tsx`                                |
| color        | Add bot modal "added" badge text           | `components/modal/modals/AddBot.tsx`                                      |
| color        | User account summary card text (no banner) | `components/app/interface/settings/user/account/UserSummary.tsx`          |
| fill         | "New messages" floating indicator icon     | `components/ui/components/features/messaging/bars/FloatingIndicator.tsx`  |
| fill         | Markdown internal link pill icon           | `components/markdown/plugins/anchors.tsx`                                 |

#### `--md-sys-color-primary-container` -- Selected/highlighted backgrounds (MUTED in Phase 1)

After Phase 1, this maps to `surfaceContainerHigh` instead of the saturated primary tint.

| CSS Property    | UI Element                                                   | File                                                                              |
| --------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| background      | MenuButton "selected" variant bg (active channel in sidebar) | `components/ui/components/design/MenuButton.tsx`                                  |
| background      | Switch toggle track bg                                       | `components/ui/components/design/Switch.tsx`                                      |
| background      | Connection status bar "disconnected" bg                      | `src/Interface.tsx`                                                               |
| background      | Message highlight animation keyframes (5%-95%)               | `panda.config.ts`                                                                 |
| background      | CodeMirror mention widget pill bg                            | `components/ui/components/features/texteditor/codeMirrorWidgets.ts`               |
| backgroundColor | CodeMirror text selection bg                                 | `components/ui/components/features/texteditor/codeMirrorTheme.ts`                 |
| background      | Text embed container bg                                      | `components/ui/components/features/messaging/elements/TextEmbed.tsx`              |
| background      | Message container "mentioned" variant bg                     | `components/ui/components/features/messaging/elements/Container.tsx`              |
| background      | Message reply preview bar bg                                 | `components/ui/components/features/messaging/composition/MessageReplyPreview.tsx` |
| background      | File carousel replace warning bg                             | `components/ui/components/features/messaging/composition/FileCarousel.tsx`        |
| background      | Mention pill (rendered in messages) bg                       | `components/markdown/plugins/mentions.tsx`                                        |
| background      | User account summary card bg (no banner)                     | `components/app/interface/settings/user/account/UserSummary.tsx`                  |
| background      | Settings sidebar button selected bg                          | `components/app/interface/settings/_layout/SidebarButton.tsx`                     |
| background      | Desktop titlebar "disconnected" bg                           | `components/app/interface/desktop/Titlebar.tsx`                                   |

#### `--md-sys-color-on-primary-container` -- Text on primary-container (MUTED in Phase 1)

After Phase 1, this maps to `onSurface`.

| CSS Property | UI Element                                               | File                                                                              |
| ------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| --color      | MenuButton "selected" variant text (active channel name) | `components/ui/components/design/MenuButton.tsx`                                  |
| color        | Connection status bar "disconnected" text                | `src/Interface.tsx`                                                               |
| color        | CodeMirror mention widget pill text                      | `components/ui/components/features/texteditor/codeMirrorWidgets.ts`               |
| color        | CodeMirror text selection foreground                     | `components/ui/components/features/texteditor/codeMirrorTheme.ts`                 |
| color        | Text embed container text                                | `components/ui/components/features/messaging/elements/TextEmbed.tsx`              |
| color        | Message reply preview bar text                           | `components/ui/components/features/messaging/composition/MessageReplyPreview.tsx` |
| color        | File carousel replace warning text                       | `components/ui/components/features/messaging/composition/FileCarousel.tsx`        |
| color        | Mention pill (rendered in messages) text                 | `components/markdown/plugins/mentions.tsx`                                        |
| color        | Desktop titlebar "disconnected" text                     | `components/app/interface/desktop/Titlebar.tsx`                                   |

#### `--md-sys-color-secondary` -- Secondary accent

| CSS Property | UI Element                                       | File                                                             |
| ------------ | ------------------------------------------------ | ---------------------------------------------------------------- |
| --border     | CodeMirror blockquote (levels 1 & 3) left border | `components/ui/components/features/texteditor/TextEditor2.tsx`   |
| --border     | Markdown blockquote (levels 1 & 3) left border   | `components/markdown/elements.ts`                                |
| background   | User account summary profile badges bg           | `components/app/interface/settings/user/account/UserSummary.tsx` |

#### `--md-sys-color-on-secondary` -- Text on secondary

| CSS Property | UI Element                                    | File                                                             |
| ------------ | --------------------------------------------- | ---------------------------------------------------------------- |
| fill         | User account summary profile badges icon fill | `components/app/interface/settings/user/account/UserSummary.tsx` |

#### `--md-sys-color-secondary-container` -- Secondary highlights (MUTED in Phase 1)

After Phase 1, this maps to `surfaceContainerHigh`.

| CSS Property | UI Element                              | File                                                                      |
| ------------ | --------------------------------------- | ------------------------------------------------------------------------- |
| background   | Button "tonal" variant bg               | `components/ui/components/design/Button.tsx`                              |
| background   | IconButton "tonal" variant bg           | `components/ui/components/design/IconButton.tsx`                          |
| background   | Active (user-reacted) reaction chip bg  | `components/ui/components/features/messaging/elements/Reactions.tsx`      |
| background   | Message hover actions toolbar bg        | `components/ui/components/features/messaging/elements/MessageToolbar.tsx` |
| background   | Server invite embed container bg        | `components/ui/components/features/messaging/elements/Invite.tsx`         |
| background   | CodeMirror blockquote (levels 1 & 3) bg | `components/ui/components/features/texteditor/TextEditor2.tsx`            |
| background   | Markdown blockquote (levels 1 & 3) bg   | `components/markdown/elements.ts`                                         |
| background   | Voice call PiP container bg             | `components/ui/components/features/voice/callCard/VoiceCallCardPiP.tsx`   |
| background   | Add bot description/footer/overlay bg   | `components/modal/modals/AddBot.tsx`                                      |

#### `--md-sys-color-on-secondary-container` -- Text on secondary-container (MUTED in Phase 1)

After Phase 1, this maps to `onSurface`.

| CSS Property | UI Element                                | File                                                                      |
| ------------ | ----------------------------------------- | ------------------------------------------------------------------------- |
| --color      | CategoryButton "tonal" variant text       | `components/ui/components/design/CategoryButton.tsx`                      |
| --color      | Button "tonal" variant text               | `components/ui/components/design/Button.tsx`                              |
| --colour     | IconButton "tonal" variant icon           | `components/ui/components/design/IconButton.tsx`                          |
| color        | Active reaction chip text                 | `components/ui/components/features/messaging/elements/Reactions.tsx`      |
| fill         | Message hover toolbar icon fill           | `components/ui/components/features/messaging/elements/MessageToolbar.tsx` |
| color        | Server invite embed text                  | `components/ui/components/features/messaging/elements/Invite.tsx`         |
| color        | CodeMirror blockquote (levels 1 & 3) text | `components/ui/components/features/texteditor/TextEditor2.tsx`            |
| color        | Markdown blockquote (levels 1 & 3) text   | `components/markdown/elements.ts`                                         |
| color        | Add bot description text                  | `components/modal/modals/AddBot.tsx`                                      |
| color        | User account summary username text        | `components/app/interface/settings/user/account/UserSummary.tsx`          |

#### `--md-sys-color-tertiary` -- Tertiary accent

| CSS Property | UI Element                                       | File                                                                                |
| ------------ | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| --border     | CodeMirror blockquote (levels 2 & 4) left border | `components/ui/components/features/texteditor/TextEditor2.tsx`                      |
| --border     | Markdown blockquote (levels 2 & 4) left border   | `components/markdown/elements.ts`                                                   |
| colorPrimary | Stripe payment form accent                       | `components/app/interface/settings/user/subscriptions/EditSubscriptionJoinFlow.tsx` |

#### `--md-sys-color-on-tertiary` -- UNUSED

No references found in the codebase.

#### `--md-sys-color-tertiary-container` -- Tertiary container

| CSS Property | UI Element                              | File                                                           |
| ------------ | --------------------------------------- | -------------------------------------------------------------- |
| background   | CodeMirror blockquote (levels 2 & 4) bg | `components/ui/components/features/texteditor/TextEditor2.tsx` |
| background   | Markdown blockquote (levels 2 & 4) bg   | `components/markdown/elements.ts`                              |

#### `--md-sys-color-on-tertiary-container` -- Text on tertiary-container

| CSS Property | UI Element                                | File                                                           |
| ------------ | ----------------------------------------- | -------------------------------------------------------------- |
| --color      | CategoryButton "tertiary" variant text    | `components/ui/components/design/CategoryButton.tsx`           |
| color        | CodeMirror blockquote (levels 2 & 4) text | `components/ui/components/features/texteditor/TextEditor2.tsx` |
| color        | Markdown blockquote (levels 2 & 4) text   | `components/markdown/elements.ts`                              |

#### `--md-sys-color-error` -- Error / destructive actions

| CSS Property | UI Element                                                 | File                                                                          |
| ------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| background   | Button "\_error" variant bg                                | `components/ui/components/design/Button.tsx`                                  |
| fill         | Unread count badge circle fill (count > 0)                 | `components/ui/components/design/Unreads.tsx`                                 |
| background   | Pending friend requests badge bg                           | `src/interface/navigation/channels/HomeSidebar.tsx`                           |
| color        | System message icons (user_left, user_kicked, user_banned) | `components/ui/components/features/messaging/elements/SystemMessageIcon.tsx`  |
| color        | Message container "failed" send status text                | `components/ui/components/features/messaging/elements/Container.tsx`          |
| color        | Muted-by-user voice status icon                            | `components/ui/components/features/voice/VoiceStatefulUserIcons.tsx`          |
| errorColor   | KaTeX math rendering error                                 | `components/markdown/index.tsx`                                               |
| fill, color  | Context menu destructive item icon & text                  | `components/app/menus/ContextMenu.tsx`                                        |
| fill         | Settings "Disable Account" / "Delete Account" icons        | `components/app/interface/settings/user/Account.tsx`                          |
| fill         | Session management icons (auto-mode, log out)              | `components/app/interface/settings/user/Sessions.tsx`                         |
| fill, colour | Settings "Log Out" icon & text                             | `components/app/interface/settings/UserSettings.tsx`                          |
| color        | Settings "Delete Server" / "Delete Channel" icon & text    | `components/app/interface/settings/ServerSettings.tsx`, `ChannelSettings.tsx` |
| color        | Link warning modal scrutinize text                         | `components/modal/modals/LinkWarning.tsx`                                     |

#### `--md-sys-color-on-error` -- Text/icons on error

| CSS Property | UI Element                         | File                                                |
| ------------ | ---------------------------------- | --------------------------------------------------- |
| --color      | Button "\_error" variant text      | `components/ui/components/design/Button.tsx`        |
| color, fill  | Unread count badge text & icon     | `components/ui/components/design/Unreads.tsx`       |
| color        | Pending friend requests badge text | `src/interface/navigation/channels/HomeSidebar.tsx` |

#### `--md-sys-color-error-container` -- UNUSED

No references found in the codebase.

#### `--md-sys-color-on-error-container` -- UNUSED

No references found in the codebase.

#### `--md-sys-color-surface` -- Default surface

| CSS Property    | UI Element                                  | File                                                                                 |
| --------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| background      | Image viewer modal controls bar bg          | `components/modal/modals/ImageViewer.tsx`                                            |
| background      | Authentication page full bg                 | `components/auth/src/AuthPage.tsx`                                                   |
| background      | Channel permissions floating actions bar bg | `components/app/interface/settings/channel/permissions/ChannelPermissionsEditor.tsx` |
| colorBackground | Stripe payment form bg                      | `components/app/interface/settings/user/subscriptions/EditSubscriptionJoinFlow.tsx`  |

#### `--md-sys-color-surface-dim` -- Dimmed surface

| CSS Property    | UI Element                              | File                                                 |
| --------------- | --------------------------------------- | ---------------------------------------------------- |
| background      | CategoryButton icon wrapper bg          | `components/ui/components/design/CategoryButton.tsx` |
| backgroundColor | File input image preview placeholder bg | `components/ui/components/utils/files/FileInput.tsx` |

#### `--md-sys-color-surface-bright` -- Bright surface

| CSS Property | UI Element               | File                                                                 |
| ------------ | ------------------------ | -------------------------------------------------------------------- |
| background   | "Add reaction" button bg | `components/ui/components/features/messaging/elements/Reactions.tsx` |

#### `--md-sys-color-surface-container-lowest` -- Lowest elevation

| CSS Property | UI Element                                  | File                                                                      |
| ------------ | ------------------------------------------- | ------------------------------------------------------------------------- |
| background   | Main content area bg (messages scroll area) | `components/ui/components/layout/Main.tsx`                                |
| background   | Voice room view container bg                | `components/ui/components/features/voice/callCard/VoiceRoomView.tsx`      |
| background   | CodeMirror spoiler text revealed bg         | `components/ui/components/features/texteditor/codeMirrorMarks.ts`         |
| background   | Message divider date label bg               | `components/ui/components/features/messaging/elements/MessageDivider.tsx` |

#### `--md-sys-color-surface-container-low` -- Low elevation

| CSS Property     | UI Element                                    | File                                                                 |
| ---------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| background       | Main app Content area bg                      | `src/Interface.tsx`                                                  |
| background       | Channel sidebar navigation bg (SidebarBase)   | `src/interface/navigation/channels/common.tsx`                       |
| background       | Server sidebar category section bg            | `src/interface/navigation/channels/ServerSidebar.tsx`                |
| fill             | Server list swoosh/cutout SVG shape           | `src/interface/navigation/servers/Swoosh.tsx`                        |
| background       | Button "elevated" variant bg                  | `components/ui/components/design/Button.tsx`                         |
| background       | Avatar low-contrast variant bg                | `components/ui/components/design/Avatar.tsx`                         |
| background       | Inactive reaction chip bg                     | `components/ui/components/features/messaging/elements/Reactions.tsx` |
| background       | Profile card container bg                     | `components/ui/components/features/profiles/ProfileCard.tsx`         |
| background       | Settings content pane bg                      | `components/app/interface/settings/_layout/Content.tsx`              |
| background-image | User account summary banner overlay (70% mix) | `components/app/interface/settings/user/account/UserSummary.tsx`     |

#### `--md-sys-color-surface-container` -- Mid elevation

| CSS Property | UI Element                         | File                                                                                        |
| ------------ | ---------------------------------- | ------------------------------------------------------------------------------------------- |
| background   | Context menu container bg          | `components/app/menus/ContextMenu.tsx`                                                      |
| background   | Autocomplete dropdown bg           | `components/ui/components/floating/AutoComplete.tsx`                                        |
| background   | CodeMirror autocomplete tooltip bg | `components/ui/components/features/texteditor/codeMirrorAutoComplete.ts`                    |
| background   | Message container hover state bg   | `components/ui/components/features/messaging/elements/Container.tsx`                        |
| background   | Emoji/media picker container bg    | `components/ui/components/features/messaging/composition/picker/CompositionMediaPicker.tsx` |
| background   | Text editor popup menu bg          | `components/ui/components/design/TextEditor.tsx`                                            |
| background   | FloatingSelect dropdown menu bg    | `components/ui/components/design/FloatingSelect.tsx`                                        |
| background   | Voice call card actions bar bg     | `components/ui/components/features/voice/callCard/VoiceCallCardActions.tsx`                 |
| background   | Auth flow card container bg        | `components/auth/src/flows/Flow.tsx`                                                        |

#### `--md-sys-color-surface-container-high` -- High elevation

| CSS Property | UI Element                                       | File                                                                     |
| ------------ | ------------------------------------------------ | ------------------------------------------------------------------------ |
| background   | Layout "connected" (normal) bg (behind sidebars) | `src/Interface.tsx`                                                      |
| background   | Channel header search input bg                   | `src/interface/channels/ChannelHeader.tsx`                               |
| background   | Message input box container bg                   | `components/ui/components/features/messaging/composition/MessageBox.tsx` |
| background   | CategoryButton "tonal"/"tertiary" hover bg       | `components/ui/components/design/CategoryButton.tsx`                     |
| background   | Dialog/modal container bg                        | `components/ui/components/design/Dialog.tsx`                             |
| background   | User hover card popup bg                         | `components/ui/components/floating/UserCard.tsx`                         |
| background   | Desktop titlebar "connected" bg                  | `components/app/interface/desktop/Titlebar.tsx`                          |
| background   | Skeleton loading shimmer gradient midpoint       | `components/ui/components/utils/ListView2.tsx`                           |

#### `--md-sys-color-surface-container-highest` -- Highest elevation

| CSS Property | UI Element                                    | File                                                                     |
| ------------ | --------------------------------------------- | ------------------------------------------------------------------------ |
| background   | Settings modal full-screen overlay bg         | `components/modal/modals/Settings.tsx`                                   |
| background   | Form editor box container bg                  | `components/ui/components/utils/Form2.tsx`                               |
| background   | FloatingSelect input trigger bg               | `components/ui/components/design/FloatingSelect.tsx`                     |
| background   | Edit message editor box bg                    | `components/app/interface/channels/text/EditMessage.tsx`                 |
| background   | Theme appearance preview container bg         | `components/app/interface/settings/user/appearance/AppearanceMenu.tsx`   |
| background   | Skeleton loading shimmer gradient endpoints   | `components/ui/components/utils/ListView2.tsx`                           |
| background   | Server list bottom shadow gradient endpoint   | `src/interface/navigation/servers/ServerList.tsx`                        |
| background   | CodeMirror autocomplete role preview fallback | `components/ui/components/features/texteditor/codeMirrorAutoComplete.ts` |

#### `--md-sys-color-on-surface` -- Primary text color

The most widely used token. Used for: all primary text, icon fills, editor text, disabled state overlays.

| CSS Property | UI Element                                         | File                                                                                        |
| ------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| color        | Text channel sidebar text                          | `src/interface/channels/text/TextChannel.tsx`                                               |
| fill, color  | Channel sidebar navigation default icon & text     | `src/interface/navigation/channels/common.tsx`                                              |
| --color      | Server sidebar category title text                 | `src/interface/navigation/channels/ServerSidebar.tsx`                                       |
| fill         | Server list base icon fill                         | `src/interface/navigation/servers/ServerList.tsx`                                           |
| background   | Server list entry indicator bg                     | `src/interface/navigation/servers/ServerList.tsx`                                           |
| color        | Member sidebar category & member title text        | `src/interface/channels/text/MemberSidebar.tsx`                                             |
| color        | Home page base text                                | `src/interface/Home.tsx`                                                                    |
| --color      | MenuButton "active" (default) variant text         | `components/ui/components/design/MenuButton.tsx`                                            |
| fill         | CategoryButton icon wrapper fill                   | `components/ui/components/design/CategoryButton.tsx`                                        |
| background   | Button disabled/loading overlays (38% & 10% mixes) | `components/ui/components/design/Button.tsx`                                                |
| background   | IconButton disabled/loading overlays               | `components/ui/components/design/IconButton.tsx`                                            |
| fill, color  | Avatar low-contrast variant icon & text            | `components/ui/components/design/Avatar.tsx`                                                |
| fill         | Unread indicator dot (unread, no count)            | `components/ui/components/design/Unreads.tsx`                                               |
| color        | FloatingSelect trigger & dropdown text             | `components/ui/components/design/FloatingSelect.tsx`                                        |
| color        | Dialog container text                              | `components/ui/components/design/Dialog.tsx`                                                |
| fill         | Dialog icon fill                                   | `components/ui/components/design/Dialog.tsx`                                                |
| color, fill  | Page header bar text & icon                        | `components/ui/components/layout/Header.tsx`                                                |
| color        | Breadcrumbs active item text                       | `components/ui/components/navigation/Breadcrumbs.tsx`                                       |
| color        | Autocomplete dropdown text                         | `components/ui/components/floating/AutoComplete.tsx`                                        |
| color        | User hover card text                               | `components/ui/components/floating/UserCard.tsx`                                            |
| color        | CodeMirror editor content text, caret, cursor      | `components/ui/components/features/texteditor/codeMirrorTheme.ts`                           |
| color        | Inactive reaction chip text                        | `components/ui/components/features/messaging/elements/Reactions.tsx`                        |
| color        | Message reply preview content text                 | `components/ui/components/features/messaging/elements/MessageReply.tsx`                     |
| color        | Message container "sent" status text               | `components/ui/components/features/messaging/elements/Container.tsx`                        |
| color        | Conversation start header text                     | `components/ui/components/features/messaging/elements/ConversationStart.tsx`                |
| color        | Message input box text                             | `components/ui/components/features/messaging/composition/MessageBox.tsx`                    |
| color        | Typing indicator bar text                          | `components/ui/components/features/messaging/composition/TypingIndicator.tsx`               |
| color, fill  | Media picker text & icon                           | `components/ui/components/features/messaging/composition/picker/CompositionMediaPicker.tsx` |
| color        | Profile card text                                  | `components/ui/components/features/profiles/ProfileCard.tsx`                                |
| color, fill  | Context menu text, icon, hover bg (8% mix)         | `components/app/menus/ContextMenu.tsx`                                                      |
| color        | Settings modal overlay text                        | `components/modal/modals/Settings.tsx`                                                      |
| color        | Auth page text, auth flow card text                | `components/auth/src/AuthPage.tsx`, `components/auth/src/flows/Flow.tsx`                    |
| color, fill  | Settings sidebar button default text & icon        | `components/app/interface/settings/_layout/SidebarButton.tsx`                               |
| fill         | Desktop titlebar base icon fill                    | `components/app/interface/desktop/Titlebar.tsx`                                             |

#### `--md-sys-color-on-surface-variant` -- Secondary/muted text color

| CSS Property | UI Element                                      | File                                                                       |
| ------------ | ----------------------------------------------- | -------------------------------------------------------------------------- |
| color        | Home page action buttons group text             | `src/interface/Home.tsx`                                                   |
| --color      | Server sidebar category title hover text        | `src/interface/navigation/channels/ServerSidebar.tsx`                      |
| --color      | Button "outlined" variant text                  | `components/ui/components/design/Button.tsx`                               |
| --colour     | IconButton "outlined" & "standard" variant icon | `components/ui/components/design/IconButton.tsx`                           |
| color        | FloatingSelect label text                       | `components/ui/components/design/FloatingSelect.tsx`                       |
| color        | Dialog body content text                        | `components/ui/components/design/Dialog.tsx`                               |
| color        | DataTable header row text                       | `components/ui/components/design/DataTable.tsx`                            |
| fill         | Navigation rail icon default fill               | `components/ui/components/navigation/NavigationRail.tsx`                   |
| fill         | File carousel "add file" button icon            | `components/ui/components/features/messaging/composition/FileCarousel.tsx` |

#### `--md-sys-color-outline` -- Borders, dividers, muted text

| CSS Property | UI Element                                                        | File                                                                              |
| ------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| color        | Layout "connected" (normal) text                                  | `src/Interface.tsx`                                                               |
| --color      | MenuButton "normal" attention variant text                        | `components/ui/components/design/MenuButton.tsx`                                  |
| borderBottom | FloatingSelect default bottom border                              | `components/ui/components/design/FloatingSelect.tsx`                              |
| color        | Breadcrumbs unselected text                                       | `components/ui/components/navigation/Breadcrumbs.tsx`                             |
| color        | Voice call "connecting"/"disconnected"/"reconnecting" status text | `components/ui/components/features/voice/callCard/VoiceCallCardStatus.tsx`        |
| color        | Message divider date label text                                   | `components/ui/components/features/messaging/elements/MessageDivider.tsx`         |
| color, fill  | Blocked message notice text & icon                                | `components/ui/components/features/messaging/elements/BlockedMessage.tsx`         |
| color        | Message "sending" status text                                     | `components/ui/components/features/messaging/elements/Container.tsx`              |
| color        | Message timestamp text                                            | `components/ui/components/features/messaging/elements/Container.tsx`              |
| color        | Reply preview "not mentioning" label                              | `components/ui/components/features/messaging/composition/MessageReplyPreview.tsx` |
| background   | File carousel divider between entries                             | `components/ui/components/features/messaging/composition/FileCarousel.tsx`        |
| border       | Markdown table header & cell borders                              | `components/markdown/elements.ts`                                                 |
| color        | Desktop titlebar "connected" text                                 | `components/app/interface/desktop/Titlebar.tsx`                                   |
| color        | Settings sidebar section header text                              | `components/app/interface/settings/_layout/Sidebar.tsx`                           |

#### `--md-sys-color-outline-variant` -- Subtle borders, dividers

| CSS Property                 | UI Element                                                   | File                                                                      |
| ---------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| backgroundColor              | Channel header divider/separator bg                          | `src/interface/channels/ChannelHeader.tsx`                                |
| borderLeft                   | Member sidebar left border (50% mix)                         | `src/interface/channels/text/TextChannel.tsx`                             |
| border                       | Channel sidebar right border (50% mix)                       | `src/interface/navigation/channels/common.tsx`                            |
| background                   | Server list line divider between sections                    | `src/interface/navigation/servers/ServerList.tsx`                         |
| --color                      | MenuButton "muted" attention variant text                    | `components/ui/components/design/MenuButton.tsx`                          |
| border                       | Button "outlined" variant border                             | `components/ui/components/design/Button.tsx`                              |
| border                       | IconButton "outlined" variant border                         | `components/ui/components/design/IconButton.tsx`                          |
| border, borderBlock          | DataTable container border & row borders                     | `components/ui/components/design/DataTable.tsx`                           |
| borderBottom                 | Page header bottom border (50% mix)                          | `components/ui/components/layout/Header.tsx`                              |
| borderTop                    | Non-unread message divider top border                        | `components/ui/components/features/messaging/elements/MessageDivider.tsx` |
| background                   | Reactions list divider line                                  | `components/ui/components/features/messaging/elements/Reactions.tsx`      |
| borderInlineStart, borderTop | Message reply connector "L" shape borders                    | `components/ui/components/features/messaging/elements/MessageReply.tsx`   |
| background                   | Context menu divider line                                    | `components/app/menus/ContextMenu.tsx`                                    |
| background                   | Role icon fallback color (profile, permissions, role editor) | Multiple settings files                                                   |

#### `--md-sys-color-inverse-surface` -- Inverted surface

| CSS Property | UI Element                                    | File                                                                  |
| ------------ | --------------------------------------------- | --------------------------------------------------------------------- |
| background   | Switch "neutral selected" compound variant bg | `components/ui/components/design/Switch.tsx`                          |
| background   | Spoiler overlay revealed state bg             | `components/ui/components/utils/Spoiler.tsx`                          |
| background   | File attachment container bg                  | `components/ui/components/features/messaging/elements/Attachment.tsx` |
| background   | Markdown spoiler text revealed bg             | `components/markdown/plugins/spoiler.tsx`                             |

#### `--md-sys-color-inverse-on-surface` -- Text on inverted surface

| CSS Property | UI Element                                      | File                                                                  |
| ------------ | ----------------------------------------------- | --------------------------------------------------------------------- |
| fill         | Switch "neutral selected" compound variant icon | `components/ui/components/design/Switch.tsx`                          |
| color        | Spoiler overlay revealed state text             | `components/ui/components/utils/Spoiler.tsx`                          |
| color        | File attachment container text                  | `components/ui/components/features/messaging/elements/Attachment.tsx` |
| color        | Markdown spoiler text revealed text             | `components/markdown/plugins/spoiler.tsx`                             |

#### `--md-sys-color-inverse-primary` -- UNUSED

No references found.

#### `--md-sys-color-scrim` -- UNUSED

No references found.

#### `--md-sys-color-shadow` -- Shadows

| CSS Property | UI Element                                    | File                                                                                        |
| ------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| textShadow   | Page header with background image text shadow | `components/ui/components/layout/Header.tsx`                                                |
| boxShadow    | Autocomplete dropdown shadow                  | `components/ui/components/floating/AutoComplete.tsx`                                        |
| boxShadow    | User hover card popup shadow                  | `components/ui/components/floating/UserCard.tsx`                                            |
| boxShadow    | Message hover actions toolbar shadow          | `components/ui/components/features/messaging/elements/MessageToolbar.tsx`                   |
| box-shadow   | CodeMirror autocomplete tooltip shadow        | `components/ui/components/features/texteditor/codeMirrorAutoComplete.ts`                    |
| boxShadow    | Emoji/media picker container shadow           | `components/ui/components/features/messaging/composition/picker/CompositionMediaPicker.tsx` |
| boxShadow    | Text editor popup menu shadow                 | `components/ui/components/design/TextEditor.tsx`                                            |
| boxShadow    | Context menu container shadow                 | `components/app/menus/ContextMenu.tsx`                                                      |

#### Fixed-tone tokens (`*-fixed`, `*-fixed-dim`, `on-*-fixed`, `on-*-fixed-variant`)

Generated but not directly referenced in the codebase. Available for future use.

### MDUI Color Triplets (`--mdui-color-*`)

Same 37 tokens but as `R, G, B` triplets (e.g., `84, 112, 236`). Used by MDUI web components internally via `rgb(var(--mdui-color-primary))`. The MDUI web components (`mdui-checkbox`, `mdui-slider`, `mdui-text-field`, `mdui-navigation-rail`, etc.) read these triplets from the DOM automatically -- you never reference `--mdui-color-*` in your own CSS, they exist solely for MDUI's internal styling.

### App Variables (`stoatWebTheme.ts`)

| Variable                     | Value                                    | Description                                 |
| ---------------------------- | ---------------------------------------- | ------------------------------------------- |
| **Messages**                 |                                          |                                             |
| `--message-size`             | `{messageSize}px`                        | Message text size (default 14px)            |
| `--message-group-spacing`    | `{messageGroupSpacing}px`                | Space between message groups (default 12px) |
| **Emojis**                   |                                          |                                             |
| `--emoji-size`               | `1.4em`                                  | Inline emoji size                           |
| `--emoji-size-medium`        | `48px`                                   | Medium emoji                                |
| `--emoji-size-large`         | `96px`                                   | Large emoji                                 |
| **Effects**                  |                                          |                                             |
| `--effects-blur-md`          | `blur(20px)` or `unset`                  | Controlled by `blur` setting                |
| `--effects-invert-black`     | `invert(100%)` / `invert(0%)`            | Adapts icons to dark/light                  |
| `--effects-invert-light`     | `invert(0%)` / `invert(1000%)`           | Inverse of above                            |
| **Transitions**              |                                          |                                             |
| `--transitions-fast`         | `.1s ease-in-out`                        | Quick transitions                           |
| `--transitions-medium`       | `.2s ease`                               | Medium transitions                          |
| **Brand / Presence**         |                                          |                                             |
| `--brand-presence-online`    | `#3ABF7E`                                | Online status (green)                       |
| `--brand-presence-idle`      | `#F39F00`                                | Idle status (amber)                         |
| `--brand-presence-busy`      | `#F84848`                                | Busy/DND status (red)                       |
| `--brand-presence-focus`     | `#4799F0`                                | Focus status (blue)                         |
| `--brand-presence-invisible` | `#A5A5A5`                                | Invisible status (grey)                     |
| **Fonts**                    |                                          |                                             |
| `--fonts-primary`            | `"{font}", "Inter", sans-serif`          | Interface font stack                        |
| `--fonts-monospace`          | `"{font}", "Jetbrains Mono", sans-serif` | Monospace font stack                        |

### Border Radius Scale (`--borderRadius-*`)

Material 3 Expressive ten-level corner radius scale:

| Token                   | Value                  |
| ----------------------- | ---------------------- |
| `--borderRadius-none`   | `0px`                  |
| `--borderRadius-xs`     | `4px`                  |
| `--borderRadius-sm`     | `8px`                  |
| `--borderRadius-md`     | `12px`                 |
| `--borderRadius-lg`     | `16px`                 |
| `--borderRadius-li`     | `20px`                 |
| `--borderRadius-xl`     | `28px`                 |
| `--borderRadius-xli`    | `32px`                 |
| `--borderRadius-xxl`    | `48px`                 |
| `--borderRadius-full`   | `calc(infinity * 1px)` |
| `--borderRadius-circle` | `100%`                 |

### Gap Scale (`--gap-*`) -- DEPRECATED

Deprecated; new components should decide spacing at the component level.

| Token        | Value  |
| ------------ | ------ |
| `--gap-none` | `0`    |
| `--gap-xxs`  | `1px`  |
| `--gap-xs`   | `2px`  |
| `--gap-s`    | `6px`  |
| `--gap-sm`   | `4px`  |
| `--gap-md`   | `8px`  |
| `--gap-l`    | `12px` |
| `--gap-lg`   | `15px` |
| `--gap-x`    | `28px` |
| `--gap-xl`   | `32px` |
| `--gap-xxl`  | `64px` |

### Layout Dimensions (`--layout-*`)

| Variable                                    | Value   |
| ------------------------------------------- | ------- |
| `--layout-width-channel-sidebar`            | `248px` |
| `--layout-width-user-context-menu-truncate` | `300px` |
| `--layout-height-message-box`               | `32vh`  |

---

## Component Inventory -- Detailed Usage Map

All file paths are relative to `packages/client/`. Each component lists where it is used and what UI feature it serves.

### Design System Atoms (`components/ui/components/design/`)

#### Avatar (`Avatar.tsx`)

User/server avatar with fallback image, status indicator overlay, and click ripple.
Internally uses `Ripple`.

| Used In                                                                          | UI Feature                                       |
| -------------------------------------------------------------------------------- | ------------------------------------------------ |
| `src/interface/navigation/servers/ServerList.tsx`                                | Server list server/user avatars                  |
| `src/interface/navigation/servers/UserMenu.tsx`                                  | User menu avatar                                 |
| `src/interface/navigation/channels/HomeSidebar.tsx`                              | Home sidebar DM conversation avatars             |
| `src/interface/channels/text/MemberSidebar.tsx`                                  | Member sidebar member avatars                    |
| `src/interface/channels/ChannelHeader.tsx`                                       | Channel header DM user avatar                    |
| `src/interface/Friends.tsx`                                                      | Friends list user avatars                        |
| `components/ui/components/design/TextEditor.tsx`                                 | Inline mention chip avatar in prosemirror editor |
| `components/ui/components/floating/AutoComplete.tsx`                             | Autocomplete suggestion avatar                   |
| `components/ui/components/features/profiles/ProfileBanner.tsx`                   | Profile card banner avatar                       |
| `components/ui/components/features/profiles/ProfileMutuals.tsx`                  | Mutual friends/servers avatar list               |
| `components/ui/components/features/voice/VoiceChannelPreview.tsx`                | Voice channel participant avatar                 |
| `components/ui/components/features/voice/callCard/VoiceCallCardActiveRoom.tsx`   | Active voice room participant avatar             |
| `components/ui/components/features/voice/callCard/VoiceCallCardPiP.tsx`          | Picture-in-picture voice call avatar             |
| `components/ui/components/features/voice/callCard/VoiceCallCardPreview.tsx`      | Voice call preview avatar                        |
| `components/ui/components/features/messaging/elements/MessageReply.tsx`          | Reply preview avatar                             |
| `components/ui/components/features/messaging/elements/Invite.tsx`                | Embedded invite server avatar                    |
| `components/ui/components/features/messaging/composition/TypingIndicator.tsx`    | Typing indicator user avatar                     |
| `components/ui/components/features/messaging/composition/picker/EmojiPicker.tsx` | Emoji picker custom emoji avatar                 |
| `components/markdown/plugins/customEmoji.tsx`                                    | Custom emoji rendering in markdown               |
| `components/markdown/plugins/mentions.tsx`                                       | Mention rendering in markdown                    |
| `components/markdown/plugins/anchors.tsx`                                        | Link preview avatars in markdown                 |
| `components/modal/modals/UserProfileMutualFriends.tsx`                           | Mutual friends modal avatar                      |
| `components/modal/modals/UserProfileMutualGroups.tsx`                            | Mutual groups modal avatar                       |
| `components/modal/modals/KickMember.tsx`                                         | Kick member confirmation avatar                  |
| `components/modal/modals/BanMember.tsx`                                          | Ban member confirmation avatar                   |
| `components/modal/modals/BanNonMember.tsx`                                       | Ban non-member confirmation avatar               |
| `components/modal/modals/Invite.tsx`                                             | Invite modal server avatar                       |
| `components/modal/modals/EmojiPreview.tsx`                                       | Emoji preview modal avatar                       |
| `components/modal/modals/ReportContent.tsx`                                      | Report content modal avatar                      |
| `components/modal/modals/CreateGroup.tsx`                                        | Create group modal avatar                        |
| `components/modal/modals/AddMembersToGroup.tsx`                                  | Add members to group avatar                      |
| `components/modal/modals/AddBot.tsx`                                             | Add bot modal bot avatar                         |
| `components/app/interface/settings/user/account/UserSummary.tsx`                 | User settings account summary avatar             |
| `components/app/interface/settings/user/profile/EditProfile.tsx`                 | Edit profile page avatar                         |
| `components/app/interface/settings/user/bots/MyBots.tsx`                         | Bot list avatars                                 |
| `components/app/interface/settings/user/appearance/AppearanceMenu.tsx`           | Appearance preview avatar                        |
| `components/app/interface/settings/user/_AccountCard.tsx`                        | Account card avatar                              |
| `components/app/interface/settings/server/bans/ListBans.tsx`                     | Banned user avatars                              |
| `components/app/interface/settings/server/emojis/EmojiList.tsx`                  | Custom emoji list preview                        |
| `components/app/interface/settings/server/invites/ListServerInvites.tsx`         | Invite creator avatars                           |
| `components/app/interface/settings/channel/webhooks/WebhooksList.tsx`            | Webhook avatars                                  |

#### Badge (`Badge.tsx`)

Wraps `<mdui-badge>`. Small notification dot/count badge.

| Used In                     | UI Feature                                       |
| --------------------------- | ------------------------------------------------ |
| `src/interface/Friends.tsx` | Friends list badge (e.g., pending request count) |

#### Button (`Button.tsx`)

Primary button with variants: `filled`, `tonal`, `elevated`, `outlined`, `text`, `_error`.
Internally uses `Ripple` and `typography` from `Text.tsx`.

| Used In                                                                                     | UI Feature                                          |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `components/ui/components/design/Dialog.tsx`                                                | Dialog action buttons (confirm, cancel)             |
| `components/ui/components/design/DataTable.tsx`                                             | DataTable pagination buttons                        |
| `components/ui/components/features/profiles/ProfileActions.tsx`                             | Profile action buttons (add friend, message, block) |
| `components/ui/components/features/voice/callCard/VoiceCallCardActions.tsx`                 | Voice call action buttons (join, leave)             |
| `components/ui/components/features/messaging/elements/Invite.tsx`                           | Embedded invite "Join" button                       |
| `components/ui/components/features/messaging/elements/TextFile.tsx`                         | Text file "Load" button                             |
| `components/ui/components/features/messaging/composition/picker/CompositionMediaPicker.tsx` | Media picker action button                          |
| `components/ui/components/utils/Form2.tsx`                                                  | Form submit/cancel buttons                          |
| `components/ui/components/utils/files/FileInput.tsx`                                        | File upload button                                  |
| `src/interface/channels/ChannelHeader.tsx`                                                  | Channel header action buttons                       |
| `src/interface/channels/text/TextSearchSidebar.tsx`                                         | Search sidebar "Search" button                      |
| `src/interface/channels/AgeGate.tsx`                                                        | Age gate confirmation button                        |
| `src/interface/Home.tsx`                                                                    | Home page action buttons                            |
| `src/interface/Development.tsx`                                                             | Dev page test buttons                               |
| `components/auth/src/flows/FlowHome.tsx`                                                    | Auth "Login"/"Create Account" buttons               |
| `components/auth/src/flows/FlowLogin.tsx`                                                   | Login flow submit button                            |
| `components/auth/src/flows/FlowCreate.tsx`                                                  | Create account button                               |
| `components/auth/src/flows/FlowReset.tsx`                                                   | Password reset button                               |
| `components/auth/src/flows/FlowResend.tsx`                                                  | Resend verification button                          |
| `components/auth/src/flows/FlowVerify.tsx`                                                  | Verify flow button                                  |
| `components/auth/src/flows/FlowConfirmReset.tsx`                                            | Confirm reset button                                |
| `components/auth/src/flows/FlowCheck.tsx`                                                   | Check flow buttons                                  |
| `components/auth/src/flows/MailProvider.tsx`                                                | Mail provider link button                           |
| `components/app/interface/settings/user/appearance/AppearanceMenu.tsx`                      | Appearance theme/reset buttons                      |
| `components/app/interface/settings/server/roles/ServerRoleEditor.tsx`                       | Role editor action buttons                          |
| `components/app/interface/settings/server/bans/ListBans.tsx`                                | "Unban" button                                      |
| `components/app/interface/settings/server/invites/ListServerInvites.tsx`                    | "Revoke" invite button                              |
| `components/app/interface/settings/channel/Overview.tsx`                                    | Channel overview save button                        |
| `components/app/interface/settings/channel/permissions/ChannelPermissionsEditor.tsx`        | Permissions editor save button                      |

#### CategoryButton (`CategoryButton.tsx`)

Settings/sidebar category list items with icon, label, description. Variants: `tonal` (default), `filled`, `tertiary`. Phase 1: transparent bg with hover-only highlight.
Internally uses `Ripple` and `typography`.

| Used In                                                                                | UI Feature                                        |
| -------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `src/interface/Home.tsx`                                                               | Home page category links (create server, explore) |
| `src/interface/Development.tsx`                                                        | Dev page category test items                      |
| `components/modal/modals/Changelog.tsx`                                                | Changelog modal category items                    |
| `components/modal/modals/MFAFlow.tsx`                                                  | MFA method selection buttons (TOTP, recovery)     |
| `components/app/interface/settings/user/account/UserSummary.tsx`                       | Account summary action items                      |
| `components/app/interface/settings/user/Account.tsx`                                   | Account settings items (email, password, 2FA)     |
| `components/app/interface/settings/user/profile/EditProfile.tsx`                       | Profile editor category items                     |
| `components/app/interface/settings/user/profile/UserProfileEditor.tsx`                 | Profile editor items                              |
| `components/app/interface/settings/user/Advanced.tsx`                                  | Advanced settings experiment toggles              |
| `components/app/interface/settings/user/Feedback.tsx`                                  | Feedback links                                    |
| `components/app/interface/settings/user/Native.tsx`                                    | Desktop app settings items                        |
| `components/app/interface/settings/user/Sync.tsx`                                      | Sync settings items                               |
| `components/app/interface/settings/user/Notifications.tsx`                             | Notification settings items                       |
| `components/app/interface/settings/user/Sessions.tsx`                                  | Session list items                                |
| `components/app/interface/settings/user/Language.tsx`                                  | Language selection items                          |
| `components/app/interface/settings/user/bots/MyBots.tsx`                               | Bot list items                                    |
| `components/app/interface/settings/user/bots/ViewBot.tsx`                              | Bot detail action items                           |
| `components/app/interface/settings/user/voice/VoiceInputOptions.tsx`                   | Voice input device selection                      |
| `components/app/interface/settings/user/voice/VoiceProcessingOptions.tsx`              | Voice processing toggle items                     |
| `components/app/interface/settings/server/roles/ServerRoleOverview.tsx`                | Role list items                                   |
| `components/app/interface/settings/server/roles/ServerRoleEditor.tsx`                  | Role editor items                                 |
| `components/app/interface/settings/server/emojis/EmojiList.tsx`                        | Emoji list items                                  |
| `components/app/interface/settings/channel/permissions/ChannelPermissionsOverview.tsx` | Permissions overview items                        |
| `components/app/interface/settings/channel/webhooks/WebhooksList.tsx`                  | Webhooks list items                               |
| `components/app/interface/settings/channel/webhooks/ViewWebhook.tsx`                   | Webhook detail items                              |

#### Checkbox (`Checkbox.tsx`)

Wraps `<mdui-checkbox>`. Toggle checkbox with label.

| Used In                                                                   | UI Feature                                          |
| ------------------------------------------------------------------------- | --------------------------------------------------- |
| `components/ui/components/utils/Form2.tsx`                                | Form checkbox fields                                |
| `src/interface/channels/AgeGate.tsx`                                      | Age gate "I confirm" checkbox                       |
| `components/modal/modals/UserProfileRoles.tsx`                            | Role assignment checkboxes                          |
| `components/modal/modals/LinkWarning.tsx`                                 | "Don't show again" checkbox                         |
| `components/modal/modals/PolicyChange.tsx`                                | Policy agreement checkbox                           |
| `components/auth/src/flows/Form.tsx`                                      | Auth form checkboxes (via `Checkbox2` legacy alias) |
| `components/app/interface/settings/user/Advanced.tsx`                     | Experiment toggle checkboxes                        |
| `components/app/interface/settings/user/Native.tsx`                       | Desktop app setting checkboxes                      |
| `components/app/interface/settings/user/Sync.tsx`                         | Sync setting checkboxes                             |
| `components/app/interface/settings/user/Notifications.tsx`                | Notification setting checkboxes                     |
| `components/app/interface/settings/user/Language.tsx`                     | Language preference checkboxes                      |
| `components/app/interface/settings/user/appearance/AppearanceMenu.tsx`    | Appearance option checkboxes                        |
| `components/app/interface/settings/user/voice/VoiceInputOptions.tsx`      | Voice input option checkboxes                       |
| `components/app/interface/settings/user/voice/VoiceProcessingOptions.tsx` | Voice processing option checkboxes                  |

#### DataTable (`DataTable.tsx`)

Paginated data table. Internally uses `Button` for pagination.

| Used In                                                                  | UI Feature                     |
| ------------------------------------------------------------------------ | ------------------------------ |
| `src/interface/Development.tsx`                                          | Dev page DataTable demo        |
| `components/app/interface/settings/server/bans/ListBans.tsx`             | Server bans paginated table    |
| `components/app/interface/settings/server/invites/ListServerInvites.tsx` | Server invites paginated table |

#### Dialog (`Dialog.tsx`)

Modal dialog container with title, body, and action button slots. Internally uses `Button` and `typography`.
Used by virtually every modal -- 54 modal files import it.

| Used In (representative)                    | UI Feature                           |
| ------------------------------------------- | ------------------------------------ |
| `components/modal/modals/Settings.tsx`      | Settings modal (full-screen overlay) |
| `components/modal/modals/UserProfile.tsx`   | User profile modal                   |
| `components/modal/modals/ImageViewer.tsx`   | Image viewer modal                   |
| `components/modal/modals/CreateChannel.tsx` | Create channel modal                 |
| `components/modal/modals/CreateServer.tsx`  | Create server modal                  |
| `components/modal/modals/DeleteMessage.tsx` | Delete message confirmation          |
| `components/modal/modals/BanMember.tsx`     | Ban member confirmation              |
| `components/modal/modals/KickMember.tsx`    | Kick member confirmation             |
| `components/modal/modals/Invite.tsx`        | Invite link modal                    |
| `components/modal/modals/MFAFlow.tsx`       | MFA authentication flow              |
| ...and 44 more modal files                  | All other modals                     |

#### FloatingSelect (`FloatingSelect.tsx`)

Custom styled dropdown select (does NOT use `mdui-select` internally despite the type declaration -- uses a custom floating div implementation).

| Used In                                     | UI Feature                     |
| ------------------------------------------- | ------------------------------ |
| `components/modal/modals/ReportContent.tsx` | Report content reason dropdown |

#### IconButton (`IconButton.tsx`)

Icon-only button with variants: `filled`, `tonal`, `outlined`, `standard`. Has a `_compositionSendMessage` special variant.
Internally uses `Ripple` and `typography`.

| Used In                                                                     | UI Feature                                                     |
| --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `src/interface/channels/ChannelHeader.tsx`                                  | Channel header icon buttons (toggle members, search, settings) |
| `src/interface/channels/text/Composition.tsx`                               | Composition toolbar icons (emoji, GIF, file attach, send)      |
| `src/interface/navigation/channels/ServerSidebar.tsx`                       | Server sidebar settings gear icon button                       |
| `src/interface/Development.tsx`                                             | Dev page test icon buttons                                     |
| `components/ui/components/features/profiles/ProfileActions.tsx`             | Profile quick-action icon buttons                              |
| `components/ui/components/features/voice/callCard/VoiceCallCardActions.tsx` | Voice call mute/deafen/disconnect icon buttons                 |
| `components/ui/components/features/messaging/elements/FileInfo.tsx`         | File download icon button                                      |
| `components/auth/src/AuthPage.tsx`                                          | Auth page back/language icon button                            |
| `components/modal/modals/ImageViewer.tsx`                                   | Image viewer close/download icon buttons                       |
| `components/app/interface/settings/user/account/UserSummary.tsx`            | Account summary edit icon button                               |
| `components/app/interface/settings/user/appearance/AppearanceMenu.tsx`      | Appearance reset icon buttons                                  |
| `components/app/interface/settings/server/roles/ServerRoleEditor.tsx`       | Role editor action icon buttons                                |
| `components/app/interface/settings/_layout/Content.tsx`                     | Settings close (X) icon button                                 |

#### List / List.Item / List.Subheader (`List.tsx`)

Wraps `<mdui-list>`, `<mdui-list-item>`, `<mdui-list-subheader>`.

| Used In                                                | UI Feature                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| `src/interface/Friends.tsx`                            | Friends list (via `ListItem`/`ListSubheader` legacy aliases) |
| `components/modal/modals/UserProfileMutualGroups.tsx`  | Mutual groups list                                           |
| `components/modal/modals/UserProfileMutualFriends.tsx` | Mutual friends list                                          |
| `components/modal/modals/PolicyChange.tsx`             | Policy change items list                                     |

#### CircularProgress (`LoadingProgress.tsx`)

Wraps `<mdui-circular-progress>`. Spinning loading indicator.

| Used In                                                                  | UI Feature                                       |
| ------------------------------------------------------------------------ | ------------------------------------------------ |
| `src/Interface.tsx`                                                      | App-level loading screen (before login resolves) |
| `src/interface/channels/text/TextSearchSidebar.tsx`                      | Search results loading spinner                   |
| `src/interface/channels/AgeGate.tsx`                                     | Age gate loading spinner                         |
| `components/ui/components/utils/Deferred.tsx`                            | Generic deferred loading placeholder             |
| `components/ui/components/features/messaging/elements/Invite.tsx`        | Invite embed loading spinner                     |
| `components/ui/components/features/messaging/elements/TextFile.tsx`      | Text file loading spinner                        |
| `components/auth/src/flows/FlowLogin.tsx`                                | Login flow loading spinner                       |
| `components/auth/src/flows/FlowVerify.tsx`                               | Verification loading spinner                     |
| `components/modal/modals/MFAFlow.tsx`                                    | MFA flow loading spinner                         |
| `components/app/interface/settings/user/Sessions.tsx`                    | Sessions loading spinner                         |
| `components/app/interface/settings/user/profile/UserProfileEditor.tsx`   | Profile editor loading                           |
| `components/app/interface/settings/user/bots/MyBots.tsx`                 | Bots list loading                                |
| `components/app/interface/settings/server/Overview.tsx`                  | Server overview loading                          |
| `components/app/interface/settings/server/roles/ServerRoleEditor.tsx`    | Role editor loading                              |
| `components/app/interface/settings/server/bans/ListBans.tsx`             | Bans list loading                                |
| `components/app/interface/settings/server/emojis/EmojiList.tsx`          | Emoji list loading                               |
| `components/app/interface/settings/server/invites/ListServerInvites.tsx` | Invites list loading                             |
| `components/app/interface/settings/channel/Overview.tsx`                 | Channel overview loading                         |
| `components/app/interface/settings/channel/webhooks/WebhooksList.tsx`    | Webhooks list loading                            |
| `components/app/interface/settings/channel/webhooks/ViewWebhook.tsx`     | Webhook detail loading                           |

#### Menu / MenuItem (`Menu.tsx`)

Wraps `<mdui-menu-item>`. Dropdown menu item entries.

| Used In                                                                | UI Feature                               |
| ---------------------------------------------------------------------- | ---------------------------------------- |
| `components/app/interface/settings/user/appearance/AppearanceMenu.tsx` | Font/emoji pack selection dropdown items |
| `components/app/interface/settings/server/Overview.tsx`                | Server system channel select items       |
| `components/modal/modals/ReportContent.tsx`                            | Report content category selection items  |

#### MenuButton (`MenuButton.tsx`)

Sidebar navigation button with attention variants: `normal`, `unread`, `mention`, `muted`, `selected`.
Internally uses `Ripple` and `Unreads`. This is the workhorse component for sidebar channel/DM items.

| Used In                                               | UI Feature                         |
| ----------------------------------------------------- | ---------------------------------- |
| `src/interface/navigation/channels/HomeSidebar.tsx`   | Home sidebar DM conversation items |
| `src/interface/navigation/channels/ServerSidebar.tsx` | Server sidebar channel items       |
| `src/interface/channels/text/MemberSidebar.tsx`       | Member sidebar member items        |

#### Radio (`Radio.tsx`)

Wraps `<mdui-radio>` and `<mdui-radio-group>`.

| Used In                                     | UI Feature                                 |
| ------------------------------------------- | ------------------------------------------ |
| `components/ui/components/utils/Form2.tsx`  | Form radio button fields                   |
| `components/modal/modals/CreateChannel.tsx` | Create channel type selection (text/voice) |

#### Ripple (`Ripple.tsx`)

Wraps `<md-ripple>`. Material ink ripple effect on click/tap.

Used internally by: `Avatar`, `Button`, `IconButton`, `Switch`, `CategoryButton`, `MenuButton`.

Also used directly in:

| Used In                                                                          | UI Feature                           |
| -------------------------------------------------------------------------------- | ------------------------------------ |
| `components/ui/components/features/profiles/ProfileBio.tsx`                      | Profile bio section click ripple     |
| `components/ui/components/features/profiles/ProfileBanner.tsx`                   | Profile banner click ripple          |
| `components/ui/components/features/profiles/ProfileMutuals.tsx`                  | Profile mutuals section click ripple |
| `components/ui/components/features/profiles/ProfileRoles.tsx`                    | Profile roles section click ripple   |
| `components/ui/components/features/voice/VoiceChannelPreview.tsx`                | Voice channel preview click ripple   |
| `components/ui/components/features/messaging/elements/Container.tsx`             | Message container interaction ripple |
| `components/ui/components/features/messaging/elements/MessageToolbar.tsx`        | Message toolbar action ripple        |
| `components/ui/components/features/messaging/elements/Reactions.tsx`             | Reaction button click ripple         |
| `components/ui/components/features/messaging/elements/BlockedMessage.tsx`        | Blocked message click ripple         |
| `components/ui/components/features/messaging/composition/FileCarousel.tsx`       | File carousel item click ripple      |
| `components/ui/components/features/messaging/composition/picker/EmojiPicker.tsx` | Emoji picker item click ripple       |
| `components/ui/components/features/messaging/bars/JumpToBottom.tsx`              | Jump-to-bottom button ripple         |
| `components/ui/components/features/messaging/bars/NewMessages.tsx`               | New messages indicator ripple        |
| `components/app/interface/settings/_layout/Sidebar.tsx`                          | Settings sidebar item ripple         |
| `components/app/interface/settings/user/_AccountCard.tsx`                        | Account card click ripple            |
| `components/modal/modals/AddBot.tsx`                                             | Add bot server selection ripple      |

#### Slider (`Slider.tsx`)

Wraps `<mdui-slider>`. Range slider input.

| Used In                                                                        | UI Feature                      |
| ------------------------------------------------------------------------------ | ------------------------------- |
| `components/ui/components/features/voice/callCard/VoiceCallCardActiveRoom.tsx` | Voice room user volume slider   |
| `components/app/menus/UserContextMenu.tsx`                                     | User context menu volume slider |
| `components/app/interface/settings/user/appearance/AppearanceMenu.tsx`         | Font size / zoom sliders        |
| `components/app/interface/settings/user/voice/VoiceInputOptions.tsx`           | Voice input sensitivity slider  |

#### Switch (`Switch.tsx`)

Toggle switch with `Switch.Override` sub-component for tri-state (allow/deny/neutral) permission overrides.
Internally uses `Ripple`.

| Used In                                                                              | UI Feature                                                       |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `components/app/interface/settings/channel/permissions/ChannelPermissionsEditor.tsx` | Permission override switches (via `OverrideSwitch` legacy alias) |

Note: Many imports of `Switch` from `@revolt/ui` are actually the SolidJS `Switch`/`Match` control flow, not this component.

#### Text / typography (`Text.tsx`)

Typography component with semantic size/weight variants. The `typography` cva export is also used internally by `Button`, `Dialog`, `IconButton`, `CategoryButton`, and `TextEditor`.

Used in 60+ files across the entire codebase. Representative usage:

| Used In                                                                       | UI Feature                            |
| ----------------------------------------------------------------------------- | ------------------------------------- |
| `src/interface/channels/ChannelHeader.tsx`                                    | Channel header title typography       |
| `src/interface/channels/text/TextChannel.tsx`                                 | Text channel heading text             |
| `src/interface/channels/text/MemberSidebar.tsx`                               | Member sidebar typography             |
| `src/interface/navigation/servers/ServerList.tsx`                             | Server list tooltip text              |
| `src/interface/navigation/servers/UserMenu.tsx`                               | User menu display name text           |
| `components/ui/components/features/messaging/elements/Container.tsx`          | Message container typography          |
| `components/ui/components/features/messaging/elements/ConversationStart.tsx`  | Conversation start text               |
| `components/ui/components/features/messaging/elements/TextEmbed.tsx`          | Text embed title/description          |
| `components/ui/components/features/messaging/composition/TypingIndicator.tsx` | Typing indicator text                 |
| `components/ui/components/features/profiles/*`                                | All profile section text              |
| `components/ui/components/floating/Tooltip.tsx`                               | Tooltip typography                    |
| `components/auth/src/flows/Flow.tsx`                                          | Auth flow title text                  |
| `components/app/menus/ContextMenu.tsx`                                        | Context menu item text                |
| `components/app/interface/settings/_layout/Content.tsx`                       | Settings breadcrumb text              |
| `components/app/interface/settings/user/appearance/AppearanceMenu.tsx`        | Appearance section headings           |
| All modal files                                                               | Modal body text, labels, descriptions |
| All settings pages                                                            | Section headings, field labels        |

#### TextEditor (`TextEditor.tsx`)

Prosemirror-based rich text editor. Internally uses `Avatar` and `typography`.
Not consumed directly -- wrapped by `TextEditor2` which is used by `Form2` and `MessageBox`.

#### TextField (`TextField.tsx`)

Wraps `<mdui-text-field>`. Text input field with label and validation.

| Used In                                                                          | UI Feature                                    |
| -------------------------------------------------------------------------------- | --------------------------------------------- |
| `components/ui/components/utils/Form2.tsx`                                       | Form text input fields                        |
| `components/ui/components/features/messaging/composition/picker/EmojiPicker.tsx` | Emoji picker search field                     |
| `src/interface/Development.tsx`                                                  | Dev page test text fields                     |
| `components/auth/src/flows/Form.tsx`                                             | Auth form text input fields (login, register) |
| `components/modal/modals/CreateGroup.tsx`                                        | Create group name field                       |
| `components/modal/modals/AddMembersToGroup.tsx`                                  | Add members search field                      |
| `components/modal/modals/AddBot.tsx`                                             | Add bot search/filter field                   |
| `components/app/interface/settings/user/appearance/AppearanceMenu.tsx`           | Custom CSS field                              |
| `components/app/interface/settings/server/bans/ListBans.tsx`                     | Bans search/filter field                      |

#### Unreads (`Unreads.tsx`)

Unread indicator: dot (unread, no count) or circle with count. Used internally by `MenuButton`.

| Used In                                           | UI Feature                    |
| ------------------------------------------------- | ----------------------------- |
| `src/interface/navigation/servers/ServerList.tsx` | Server list unread indicators |

#### UserStatus (`UserStatus.tsx`)

Presence status display (online/idle/busy/invisible dot).

| Used In                                                        | UI Feature                          |
| -------------------------------------------------------------- | ----------------------------------- |
| `src/interface/navigation/servers/ServerList.tsx`              | Server list user status indicator   |
| `src/interface/navigation/servers/UserMenu.tsx`                | User menu status indicator          |
| `src/interface/navigation/channels/HomeSidebar.tsx`            | Home sidebar DM conversation status |
| `src/interface/channels/ChannelHeader.tsx`                     | Channel header DM user status       |
| `src/interface/channels/text/MemberSidebar.tsx`                | Member sidebar member status        |
| `src/interface/Friends.tsx`                                    | Friends list user status indicators |
| `components/ui/components/features/profiles/ProfileBanner.tsx` | Profile banner status indicator     |

### Raw MDUI Web Components (used directly, no SolidJS wrapper)

#### `<mdui-navigation-rail>` / `<mdui-navigation-rail-item>`

Defined in wrapper: `components/ui/components/navigation/NavigationRail.tsx`

| Used In                     | UI Feature                                                  |
| --------------------------- | ----------------------------------------------------------- |
| `src/interface/Friends.tsx` | Friends page tab navigation (All, Online, Pending, Blocked) |

#### `<mdui-segmented-button>` / `<mdui-segmented-button-group>`

Defined in: `components/ui/components/features/legacy/SegmentedButton.tsx` (marked `@deprecated`)

No external consumers found. Exported from legacy barrel but never imported.

### Layout Primitives (`components/ui/components/layout/`)

| File         | Component(s)                                | Description                                               |
| ------------ | ------------------------------------------- | --------------------------------------------------------- |
| `Column.tsx` | Column, OverflowingColumn, ScrollableColumn | Vertical flex containers                                  |
| `Row.tsx`    | Row                                         | Horizontal flex container                                 |
| `Header.tsx` | Header                                      | Section header with `bottomBorder` variant                |
| `Main.tsx`   | Main                                        | Main content wrapper (uses `surface-container-lowest` bg) |

### Messaging (`components/ui/components/features/messaging/`)

| Area        | Key Files                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition | `composition/MessageBox.tsx` (CodeMirror input + action buttons), `composition/FileCarousel.tsx` (file attachment previews), `composition/MessageReplyPreview.tsx` (reply preview bar), `composition/TypingIndicator.tsx`                                                                                                                                                                                                                    |
| Elements    | `elements/Container.tsx` (message wrapper), `elements/MessageReply.tsx` (reply connector), `elements/TextEmbed.tsx` (link embeds), `elements/Reactions.tsx` (reaction chips), `elements/Invite.tsx` (server invite embed), `elements/MessageDivider.tsx` (date/unread dividers), `elements/MessageToolbar.tsx` (hover action toolbar), `elements/Attachment.tsx` (file attachments), `elements/SystemMessageIcon.tsx` (system message icons) |
| Bars        | `bars/FloatingIndicator.tsx` (new messages indicator), `bars/JumpToBottom.tsx` (scroll-to-bottom button), `bars/NewMessages.tsx` (new messages banner)                                                                                                                                                                                                                                                                                       |

### Deprecated Legacy Aliases

Defined in `components/ui/components/features/legacy/index.ts`:

| Legacy Name           | Maps To                   | Still Used?                           |
| --------------------- | ------------------------- | ------------------------------------- |
| `Modal2`              | `Dialog`                  | No                                    |
| `ModalScrim`          | `Dialog.Scrim`            | No                                    |
| `ListItem`            | `List.Item`               | Yes -- `src/interface/Friends.tsx`    |
| `ListSubheader`       | `List.Subheader`          | Yes -- `src/interface/Friends.tsx`    |
| `NavigationRailItem`  | `NavigationRail.Item`     | Yes -- `src/interface/Friends.tsx`    |
| `Select`              | `TextField.Select`        | No                                    |
| `CategoryButtonGroup` | `CategoryButton.Group`    | Yes -- multiple settings pages        |
| `CategoryCollapse`    | `CategoryButton.Collapse` | Yes -- multiple settings pages        |
| `OverrideSwitch`      | `Switch.Override`         | Yes -- `ChannelPermissionsEditor.tsx` |
| `Checkbox2`           | `Checkbox`                | Yes -- auth forms, permissions editor |

---

## Layout Architecture

The layout is a nested flex structure:

```
<body>                                  -- CSS variables set here
  <div> (column flex, full height)
    <Titlebar />                        -- Desktop titlebar
    <Layout> (row flex, flex-grow)      -- styled div, sets background color
      <Sidebar>                         -- Left sidebar orchestrator
        <NavigationRail />              -- Server icon rail (MDUI navigation-rail)
        <SidebarBase />                 -- Channel list (248px wide, right border)
      </Sidebar>
      <Content> (row flex, fill)        -- Main content area
        <ChannelHeader />              -- Top header bar
        <TextChannel>                  -- Message area
          <Messages />                 -- Message list (scrollable)
          <Composition />              -- Message input area
          <MemberSidebar />            -- Right member list (left border)
        </TextChannel>
      </Content>
    </Layout>
  </div>
```

### Key background colors

| Element               | Color Variable                                            |
| --------------------- | --------------------------------------------------------- |
| Layout (connected)    | `--md-sys-color-surface-container-high`                   |
| Layout (disconnected) | `--md-sys-color-primary-container`                        |
| Content area          | `--md-sys-color-surface-container-low`                    |
| Channel sidebar       | `--md-sys-color-surface-container-high` (via SidebarBase) |
| Navigation rail       | Inherits from Layout                                      |

---

## State Management

SolidJS reactive stores in `components/state/stores/`. Each extends `AbstractStore` with persistence.

| Store      | File          | Manages                                              |
| ---------- | ------------- | ---------------------------------------------------- |
| `Theme`    | `Theme.ts`    | Colors, fonts, dark mode, contrast, variant          |
| `Layout`   | `Layout.ts`   | Sidebar visibility, last active path, section states |
| `Draft`    | `Draft.ts`    | Unsent message drafts per channel                    |
| `Ordering` | `Ordering.ts` | Server and channel sort order                        |

Access via `useState()` hook anywhere in the component tree:

```typescript
const state = useState();
const theme = state.theme.activeTheme; // SelectedTheme object
const isDark = state.theme.darkMode; // Computed boolean
```

---

## Modal System

54 modal components in `components/modal/modals/`. Opened via `useModals()` hook:

```typescript
const { openModal } = useModals();
openModal({ type: "settings", config: "user" });
openModal({ type: "create_channel", server });
```

Settings is itself a modal (`Settings.tsx`) containing sub-pages for user, server, and channel settings.

---

## Routing

Uses `@solidjs/router`. Routes defined in `src/index.tsx`. Key routes:

| Path                               | Component                                               |
| ---------------------------------- | ------------------------------------------------------- |
| `/login`, `/create`, etc.          | Auth flows                                              |
| `/server/:server/channel/:channel` | Text/voice channel                                      |
| `/channel/:channel`                | DM channel                                              |
| `/discover`                        | Server discovery                                        |
| `/dev`                             | Development tools                                       |
| `/settings`                        | Intercepted by `useBeforeLeave` -> opens settings modal |

---

## Phase 1 Changes Log

All changes made to reduce Material Design visual weight and move toward a Discord-like compact aesthetic, within the existing Panda CSS + MDUI system.

### 1. Muted accent containers (global)

**File:** `components/ui/themes/materialTheme.ts` (lines 178-189)

Remapped `primary-container` -> `surfaceContainerHigh` and `on-primary-container` -> `onSurface`. Same for secondary. This globally mutes all selected/highlighted states from saturated accent tints to subtle surface elevations.

### 2. Compact search input

**File:** `src/interface/channels/ChannelHeader.tsx` (lines 238-247)

Height 40px -> 32px, dynamic width using `calc(var(--layout-width-channel-sidebar) - 30px)`, reduced padding, added fontSize 14px.

### 3. Round bottom-aligned send button

**Files:**

- `src/interface/channels/text/Composition.tsx` (lines 380-391): Removed `_compositionSendMessage` prop, changed `shape="square"` to `shape="round"`.
- `components/ui/components/features/messaging/composition/MessageBox.tsx` (lines 225-230+): Added `AppendContainer` styled div with `align-items: flex-end` for bottom alignment.

### 4. Channel sidebar right border

**File:** `src/interface/navigation/channels/common.tsx`

Added `borderRight: "1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 50%, transparent)"` to SidebarBase.

### 5. Member sidebar left border

**File:** `src/interface/channels/text/TextChannel.tsx`

Added matching `borderLeft` to the member sidebar cva. Removed `borderRadius` that was previously present.

### 6. Transparent settings category buttons

**File:** `components/ui/components/design/CategoryButton.tsx`

Changed `tonal` and `tertiary` variants from colored backgrounds to `transparent` default with `&:hover` showing `surface-container-high`.
