import { Key } from "@solid-primitives/keyed";
import { createMemo, Show } from "solid-js";
import {
  isTrackReference,
  TrackLoop,
  TrackReference,
  useEnsureParticipant,
  useIsMuted,
  useIsSpeaking,
  useTracks,
  VideoTrack,
} from "solid-livekit-components";

import { getTrackReferenceId } from "@livekit/components-core";
import { Track } from "livekit-client";
import { styled } from "styled-system/jsx";

import { useUser } from "@revolt/markdown/users";
import { useVoice } from "@revolt/rtc";
import { Avatar } from "@revolt/ui/components/design";
import { Row } from "@revolt/ui/components/layout";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { useScreenShareWatch } from "./VoiceCallCard";
import { VoiceCallCardActions } from "./VoiceCallCardActions";
import { VoiceCallCardStatus } from "./VoiceCallCardStatus";

/**
 * Compact Picture-in-Picture voice card shown in a screen corner when the room
 * is minimised or the user has navigated away from the voice channel.
 *
 * When a screen share stream is focused, the PiP card shows the live video
 * filling the entire card (Discord-style). Otherwise it shows the participant
 * avatar row + status.
 *
 * Clicking the card navigates back to the voice channel, which triggers
 * VoiceChannelCallCardMount to lift the minimised flag and restore the full
 * expanded view.
 */
export function VoiceCallCardPiP() {
  const voice = useVoice();
  const watchCtx = useScreenShareWatch();

  const micTracks = useTracks(
    [{ source: Track.Source.Microphone, withPlaceholder: true }],
    { onlySubscribed: false },
  );

  const screenShareTracks = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: false },
  );

  // Find the focused screen share track reference
  const focusedTrack = createMemo(() => {
    const fid = watchCtx?.focusedId();
    if (!fid) return null;
    return (
      screenShareTracks().find((t) => getTrackReferenceId(t) === fid) ?? null
    );
  });

  return (
    <MiniCard>
      <ChannelLink href={voice.channel()?.path}>
        <Show
          when={focusedTrack()}
          fallback={
            // No focused stream: normal avatar row + status
            <>
              <Row>
                <TrackLoop tracks={micTracks}>
                  {() => <ConnectedUser />}
                </TrackLoop>
              </Row>
              <VoiceCallCardStatus />
            </>
          }
        >
          {(focused) => (
            // Focused stream: fill the card with live video
            // Use <Key> to force remount when the focused track changes
            // (workaround for VideoTrack destructuring reactivity issue)
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
 * Clickable link area covering the participant row + status (or the video).
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
    overflow: "hidden",
    width: "100%",
  },
});

/**
 * Container for the focused stream video in PiP mode.
 * Fills the available space above the action bar.
 */
const PiPVideoContainer = styled("div", {
  base: {
    width: "100%",
    flexGrow: 1,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: "var(--borderRadius-md)",
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
