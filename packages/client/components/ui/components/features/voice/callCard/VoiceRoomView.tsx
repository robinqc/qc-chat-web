import { createMemo } from "solid-js";

import { useLingui } from "@lingui-solid/solid/macro";
import { styled } from "styled-system/jsx";

import { useState } from "@revolt/state";
import { IconButton } from "@revolt/ui/components/design";
import { Symbol } from "@revolt/ui/components/utils/Symbol";
import { createMaterialColourVariables } from "@revolt/ui/themes";

import { VoiceCallCardActiveRoom } from "./VoiceCallCardActiveRoom";

interface VoiceRoomViewProps {
  /** Called when the user clicks the Minimize button */
  onMinimize: () => void;
  /** Called when the user clicks the chat toggle to switch to messages view */
  onSwitchToMessages: () => void;
}

/**
 * Full-space voice room view rendered in normal document flow.
 * Occupies the entire chat area and replaces the messages list while active.
 * The user can minimise back to PiP via the Minimize button in the action bar.
 * No channel header is shown; a chat toggle button sits in the top-right corner.
 */
export function VoiceRoomView(props: VoiceRoomViewProps) {
  const state = useState();
  const { t } = useLingui();

  // Generate the dark variant of the current theme's colour variables so that
  // all child components (toolbar buttons, overlays, etc.) render with a dark
  // palette regardless of the global light/dark mode setting.
  const darkVars = createMemo(() =>
    createMaterialColourVariables(
      { ...state.theme.activeTheme, darkMode: true },
      "--md-sys-color-",
    ),
  );

  return (
    <RoomContainer style={darkVars()}>
      <ChatToggle>
        <IconButton
          size="sm"
          variant="tonal"
          onPress={() => props.onSwitchToMessages()}
          use:floating={{
            tooltip: {
              placement: "bottom",
              content: t`View messages`,
            },
          }}
        >
          <Symbol>chat_bubble</Symbol>
        </IconButton>
      </ChatToggle>
      <VoiceCallCardActiveRoom onMinimize={props.onMinimize} />
    </RoomContainer>
  );
}

const RoomContainer = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: 0,
    width: "auto",
    background: "black",
    position: "relative",
    // Counteract the parent main container's paddingInline so the black
    // background extends edge-to-edge against the sidebars.
    marginInline: "calc(-1 * var(--gap-md))",
  },
});

/** Floating toggle button positioned at the top-right of the voice room */
const ChatToggle = styled("div", {
  base: {
    position: "absolute",
    top: "var(--gap-md)",
    right: "var(--gap-md)",
    zIndex: 10,
  },
});
