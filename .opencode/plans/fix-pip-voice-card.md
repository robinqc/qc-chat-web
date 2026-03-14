# Fix PiP Voice Call Card Issues

## Issues

1. Toolbar overflows the PiP card boundaries
2. Focused video stream too small/cropped - should cover entire card
3. Dragging PiP card triggers file upload drag-and-drop

## Files to modify

### 1. `packages/client/components/ui/components/features/voice/callCard/VoiceCallCardPiP.tsx`

**Restructure `MiniCard` layout:**

Replace `MiniCard` styled component (lines 190-211) with:

```tsx
const MiniCard = styled("div", {
  base: {
    userSelect: "none",
    pointerEvents: "all",
    width: "100%",
    height: "100%",
    position: "relative",
    overflow: "hidden",
    borderRadius: "var(--borderRadius-lg)",
    border:
      "1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 50%, transparent)",
    background: "var(--md-sys-color-secondary-container)",

    // Show toolbar overlay on hover
    "& > [data-pip-actions]": {
      opacity: 0,
      transition: "opacity 0.2s ease",
    },
    "&:hover > [data-pip-actions]": {
      opacity: 1,
    },
  },
});
```

- Removes flex column layout (video fills via absolute positioning)
- Adds `position: relative` and `overflow: hidden` so children can be absolutely positioned and won't escape
- Adds hover-based opacity toggle for the toolbar overlay

**Add `ActionsOverlay` styled component:**

```tsx
/** Toolbar overlay positioned at the bottom of the PiP card, visible on hover */
const ActionsOverlay = styled("div", {
  base: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    padding: "var(--gap-sm)",
    background: "linear-gradient(transparent, rgba(0,0,0,0.5))",
    zIndex: 1,
  },
});
```

**Add `FallbackContent` styled component (for avatar row + status when no focused stream):**

```tsx
const FallbackContent = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--gap-md)",
    width: "100%",
    height: "100%",
  },
});
```

**Update `ChannelLink` styled component (lines 157-171):**

```tsx
const ChannelLink = styled("a", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    pointerEvents: "all",
    textDecoration: "none",
    color: "inherit",
    // Fill entire card
    position: "absolute",
    inset: 0,
  },
});
```

- Changed from flex-grow to `position: absolute; inset: 0` to fill the entire MiniCard

**Update `PiPVideoContainer` styled component (lines 177-188):**

```tsx
const PiPVideoContainer = styled("div", {
  base: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
```

- Removed `flexGrow`, `minHeight`, `borderRadius` - video now fills the entire card via ChannelLink's absolute positioning

**Update JSX in `VoiceCallCardPiP` component (lines 63-106):**

Replace the return JSX with:

```tsx
return (
  <MiniCard>
    <ChannelLink href={voice.channel()?.path} draggable={false}>
      <Show
        when={focusedTrack()}
        fallback={
          <FallbackContent>
            <Row>
              <TrackLoop tracks={micTracks}>
                {() => <ConnectedUser />}
              </TrackLoop>
            </Row>
            <VoiceCallCardStatus />
          </FallbackContent>
        }
      >
        {(focused) => (
          <PiPVideoContainer>
            <Key each={[focused()]} by={(item) => getTrackReferenceId(item)}>
              {(trackRef) => (
                <Show when={isTrackReference(trackRef())}>
                  <VideoTrack
                    style={{
                      width: "100%",
                      height: "100%",
                      "object-fit": "cover",
                    }}
                    trackRef={trackRef() as TrackReference}
                    manageSubscription={true}
                  />
                </Show>
              )}
            </Key>
          </PiPVideoContainer>
        )}
      </Show>
    </ChannelLink>
    <ActionsOverlay data-pip-actions>
      <VoiceCallCardActions size="xs" />
    </ActionsOverlay>
  </MiniCard>
);
```

Key changes:

- Wrapped fallback content in `<FallbackContent>` instead of bare fragment
- Added `draggable={false}` to `ChannelLink` (fixes issue 3)
- Moved `VoiceCallCardActions` into `<ActionsOverlay>` with `data-pip-actions` attribute for hover targeting
- Toolbar now sits over the video at the bottom, hidden until hover

---

### 2. `packages/client/components/ui/components/features/voice/callCard/VoiceCallCard.tsx`

**Add drag prevention on outer PiP div (line 287-312):**

On the outer `<div>` that wraps the PiP card (around line 287), add `ondragstart` handler:

```tsx
<div
  style={{ ... }}
  onMouseDown={() => { ... }}
  onDragStart={(e: DragEvent) => e.preventDefault()}
>
```

This prevents any child element from initiating a native HTML drag, which was causing the `FileDropAnywhereCollector` to trigger.

---

### 3. `packages/client/components/ui/components/features/voice/callCard/VoiceCallCardActions.tsx`

**Update `Actions` styled component (lines 167-181) to constrain width in PiP:**

```tsx
const Actions = styled("div", {
  base: {
    flexShrink: 0,
    gap: "var(--gap-sm)",
    padding: "var(--gap-sm)",

    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignSelf: "center",
    maxWidth: "100%",

    borderRadius: "var(--borderRadius-full)",
    background: "var(--md-sys-color-surface-container)",
  },
});
```

- Changed gap from `var(--gap-md)` to `var(--gap-sm)` for more compact layout
- Changed padding from `var(--gap-md)` to `var(--gap-sm)`
- Added `maxWidth: "100%"` so it can't exceed its container
- Added `flexWrap: "wrap"` as a safety net if buttons still overflow

---

## Summary of all changes

| Change                                                    | File                     | Purpose                                  |
| --------------------------------------------------------- | ------------------------ | ---------------------------------------- |
| MiniCard: relative + overflow hidden, hover-based toolbar | VoiceCallCardPiP.tsx     | Video fills card, toolbar shows on hover |
| ChannelLink: absolute positioning, `draggable={false}`    | VoiceCallCardPiP.tsx     | Fill card + prevent drag issue           |
| PiPVideoContainer: simplified to fill parent              | VoiceCallCardPiP.tsx     | Video covers entire card                 |
| New ActionsOverlay: absolute bottom overlay               | VoiceCallCardPiP.tsx     | Toolbar floats over video                |
| New FallbackContent: centered flex container              | VoiceCallCardPiP.tsx     | Avatar row layout when no video          |
| Actions: smaller gaps, maxWidth, flexWrap                 | VoiceCallCardActions.tsx | Prevent toolbar overflow                 |
| Outer div: `onDragStart` prevention                       | VoiceCallCard.tsx        | Stop native drag triggering file upload  |
