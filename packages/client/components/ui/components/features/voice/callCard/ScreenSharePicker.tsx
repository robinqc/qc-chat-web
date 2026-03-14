import { useFloating } from "solid-floating-ui";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { Motion, Presence } from "solid-motionone";

import { autoUpdate, flip, offset, shift } from "@floating-ui/dom";
import { styled } from "styled-system/jsx";

import { useVoice } from "@revolt/rtc";
import { useState } from "@revolt/state";
import type {
  ScreenShareFrameRate,
  ScreenShareResolution,
} from "@revolt/state/stores/Voice";
import { Button } from "@revolt/ui/components/design";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

/**
 * Inline quality picker shown when the user clicks the screen-share button.
 * Allows choosing resolution (720p / 1080p / Original) and frame rate (30 / 60 fps)
 * before starting the share.
 */
export function ScreenSharePicker(props: {
  anchor: HTMLElement | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const voice = useVoice();
  const appState = useState();

  const [panel, setPanel] = createSignal<HTMLDivElement>();
  const [resolution, setResolution] = createSignal<ScreenShareResolution>(
    appState.voice.screenShareResolution,
  );
  const [frameRate, setFrameRate] = createSignal<ScreenShareFrameRate>(
    appState.voice.screenShareFrameRate,
  );

  const position = useFloating(() => props.anchor, panel, {
    placement: "top",
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  });

  function handleClickOutside(e: MouseEvent) {
    if (!props.open) return;
    const target = e.target as Node;
    const panelEl = panel();
    const anchorEl = props.anchor;
    if (
      panelEl &&
      !panelEl.contains(target) &&
      anchorEl &&
      !anchorEl.contains(target)
    ) {
      props.onClose();
    }
  }

  onMount(() => document.addEventListener("mousedown", handleClickOutside));
  onCleanup(() =>
    document.removeEventListener("mousedown", handleClickOutside),
  );

  function startSharing() {
    voice.toggleScreenshare(resolution(), frameRate());
    props.onClose();
  }

  return (
    <Portal mount={document.getElementById("floating")!}>
      <Presence>
        <Show when={props.open}>
          <Motion
            ref={setPanel}
            style={{
              position: position.strategy,
              top: `${position.y ?? 0}px`,
              left: `${position.x ?? 0}px`,
              "z-index": "1000",
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15, easing: [0.4, 0, 0.2, 1] }}
          >
            <PickerPanel>
              <PanelTitle>
                <Symbol size={18}>screen_share</Symbol>
                Screen Share Quality
              </PanelTitle>

              <OptionGroup>
                <OptionLabel>Resolution</OptionLabel>
                <OptionRow>
                  <OptionChip
                    selected={resolution() === "720"}
                    onClick={() => setResolution("720")}
                  >
                    720p
                  </OptionChip>
                  <OptionChip
                    selected={resolution() === "1080"}
                    onClick={() => setResolution("1080")}
                  >
                    1080p
                  </OptionChip>
                  <OptionChip
                    selected={resolution() === "original"}
                    onClick={() => setResolution("original")}
                  >
                    Original
                  </OptionChip>
                </OptionRow>
              </OptionGroup>

              <OptionGroup>
                <OptionLabel>Frame Rate</OptionLabel>
                <OptionRow>
                  <OptionChip
                    selected={frameRate() === 30}
                    onClick={() => setFrameRate(30)}
                  >
                    30 FPS
                  </OptionChip>
                  <OptionChip
                    selected={frameRate() === 60}
                    onClick={() => setFrameRate(60)}
                  >
                    60 FPS
                  </OptionChip>
                </OptionRow>
              </OptionGroup>

              <Button size="sm" variant="filled" onPress={startSharing}>
                <Symbol size={18}>screen_share</Symbol>
                Start Sharing
              </Button>
            </PickerPanel>
          </Motion>
        </Show>
      </Presence>
    </Portal>
  );
}

// -- Styled components --

const PickerPanel = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-sm)",
    padding: "12px",
    minWidth: "220px",
    borderRadius: "12px",
    background: "rgba(0, 0, 0, 0.75)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
    color: "var(--md-sys-color-on-surface, #fff)",
  },
});

const PanelTitle = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    fontWeight: 600,
    opacity: 0.9,
  },
});

const OptionGroup = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
});

const OptionLabel = styled("span", {
  base: {
    fontSize: "11px",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    opacity: 0.6,
  },
});

const OptionRow = styled("div", {
  base: {
    display: "flex",
    gap: "4px",
  },
});

const OptionChip = styled("button", {
  base: {
    flex: 1,
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 500,
    fontFamily: "inherit",
    borderRadius: "8px",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    background: "rgba(255, 255, 255, 0.08)",
    color: "rgba(255, 255, 255, 0.8)",
    cursor: "pointer",
    transition: "all 0.15s ease",
    textAlign: "center",
    whiteSpace: "nowrap",

    "&:hover": {
      background: "rgba(255, 255, 255, 0.15)",
    },
  },
  variants: {
    selected: {
      true: {
        background: "var(--md-sys-color-primary, #6750A4)",
        color: "var(--md-sys-color-on-primary, #fff)",
        borderColor: "var(--md-sys-color-primary, #6750A4)",

        "&:hover": {
          background: "var(--md-sys-color-primary, #6750A4)",
          opacity: 0.9,
        },
      },
    },
  },
});
