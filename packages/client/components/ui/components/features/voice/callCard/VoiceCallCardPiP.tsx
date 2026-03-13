import { Show } from "solid-js";
import {
  TrackLoop,
  useEnsureParticipant,
  useIsMuted,
  useIsSpeaking,
  useTracks,
} from "solid-livekit-components";

import { Track } from "livekit-client";
import { styled } from "styled-system/jsx";

import { useUser } from "@revolt/markdown/users";
import { useVoice } from "@revolt/rtc";
import { Avatar } from "@revolt/ui/components/design";
import { Row } from "@revolt/ui/components/layout";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { VoiceCallCardActions } from "./VoiceCallCardActions";
import { VoiceCallCardStatus } from "./VoiceCallCardStatus";

/**
 * Compact Picture-in-Picture voice card shown in a screen corner when the room
 * is minimised or the user has navigated away from the voice channel.
 *
 * Clicking the card navigates back to the voice channel, which triggers
 * VoiceChannelCallCardMount to lift the minimised flag and restore the full
 * expanded view.
 */
export function VoiceCallCardPiP() {
  const voice = useVoice();

  const tracks = useTracks(
    [{ source: Track.Source.Microphone, withPlaceholder: true }],
    { onlySubscribed: false },
  );

  return (
    <MiniCard>
      {/*
       * Clicking the avatar area navigates to the voice channel, which causes
       * VoiceChannelCallCardMount to mount and call updateState({ channel }),
       * resetting minimized and expanding back to full view.
       */}
      <ChannelLink href={voice.channel()?.path}>
        <Row>
          <TrackLoop tracks={tracks}>{() => <ConnectedUser />}</TrackLoop>
        </Row>
        <VoiceCallCardStatus />
      </ChannelLink>
      <VoiceCallCardActions size="xs" />
    </MiniCard>
  );
}

function ConnectedUser() {
  const participant = useEnsureParticipant();

  const isMuted = useIsMuted({
    participant,
    source: Track.Source.Microphone,
  });

  const isSpeaking = useIsSpeaking(participant);
  const user = useUser(participant.identity);

  return (
    <UserIcon speaking={isSpeaking()}>
      <Avatar size={24} src={user().avatar} fallback={user().username} />
      <Show when={isMuted()}>
        <Symbol>mic_off</Symbol>
      </Show>
    </UserIcon>
  );
}

const UserIcon = styled("div", {
  base: {
    display: "grid",
    width: "24px",
    height: "24px",

    "& *": {
      gridArea: "1/1",
    },
  },
  variants: {
    speaking: {
      true: {
        "& svg": {
          outlineOffset: "1px",
          outline: "2px solid var(--md-sys-color-primary)",
          borderRadius: "var(--borderRadius-circle)",
        },
      },
    },
  },
});

/**
 * Clickable link area covering the participant row + status.
 * Navigating to the voice channel re-expands the room from PiP.
 */
const ChannelLink = styled("a", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "var(--gap-md)",
    cursor: "pointer",
    pointerEvents: "all",
    textDecoration: "none",
    color: "inherit",
    flexGrow: 1,
  },
});

const MiniCard = styled("div", {
  base: {
    userSelect: "none",

    pointerEvents: "all",
    width: "100%",
    height: "100%",

    display: "flex",
    alignItems: "center",
    flexDirection: "column",
    justifyContent: "center",

    gap: "var(--gap-md)",
    padding: "var(--gap-md)",

    borderRadius: "var(--borderRadius-lg)",
    background: "var(--md-sys-color-secondary-container)",
  },
});
