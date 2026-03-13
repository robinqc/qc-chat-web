import { styled } from "styled-system/jsx";

import { VoiceCallCardActiveRoom } from "./VoiceCallCardActiveRoom";

interface VoiceRoomViewProps {
  /** Called when the user clicks the Minimize button */
  onMinimize: () => void;
}

/**
 * Full-space voice room view rendered in normal document flow.
 * Occupies the entire chat area and replaces the messages list while active.
 * The user can minimise back to PiP via the Minimize button in the action bar.
 */
export function VoiceRoomView(props: VoiceRoomViewProps) {
  return (
    <RoomContainer>
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
    width: "100%",
    background: "var(--md-sys-color-surface-container-lowest)",
  },
});
