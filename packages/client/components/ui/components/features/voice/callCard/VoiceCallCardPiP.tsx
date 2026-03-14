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
import { useState } from "@revolt/state";
import { Avatar } from "@revolt/ui/components/design";
import { Row } from "@revolt/ui/components/layout";
import { Symbol } from "@revolt/ui/components/utils/Symbol";
import { createMaterialColourVariables } from "@revolt/ui/themes";

import { useScreenShareWatch, useVoiceExpand } from "./VoiceCallCard";
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
  const state = useState();
  const watchCtx = useScreenShareWatch();
  const expand = useVoiceExpand();

  // Force dark palette on the PiP card regardless of global theme mode
  const darkVars = createMemo(() =>
    createMaterialColourVariables(
      { ...state.theme.activeTheme, darkMode: true },
      "--md-sys-color-",
    ),
  );

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
    <MiniCard style={darkVars()}>
      <ChannelLink
        href={voice.channel()?.path}
        draggable={false}
        onClick={() => expand()}
      >
        <Show
          when={focusedTrack()}
          fallback={
            // No focused stream: normal avatar row + status
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
      <ActionsOverlay data-pip-actions>
        <VoiceCallCardActions size="xs" />
      </ActionsOverlay>
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
 * Clickable link area covering the entire PiP card.
 * Navigating to the voice channel re-expands the room from PiP.
 */
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
    // Fill the entire card
    position: "absolute",
    inset: 0,
    overflow: "hidden",
  },
});

/**
 * Container for the focused stream video in PiP mode.
 * Fills the entire card area via the absolutely-positioned ChannelLink parent.
 */
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
    background: "black",

    // Hide toolbar by default, show on hover
    "& > [data-pip-actions]": {
      opacity: 0,
      transition: "opacity 0.2s ease",
    },
    "&:hover > [data-pip-actions]": {
      opacity: 1,
    },
  },
});

/**
 * Fallback content shown when no focused video stream is available.
 * Centers avatar row + status within the card.
 */
const FallbackContent = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--gap-md)",
    width: "100%",
    height: "100%",

    // Subtle coloured glow at the bottom, matching the expanded room view
    backgroundImage:
      "radial-gradient(ellipse 70% 60px at 50% 100%, color-mix(in srgb, var(--md-sys-color-primary) 25%, transparent) 0%, transparent 100%)",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "bottom center",
    backgroundSize: "100% 100px",
  },
});

/**
 * Toolbar overlay positioned at the bottom of the PiP card.
 * Fades in on hover via MiniCard's CSS rules.
 */
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
    pointerEvents: "all",
  },
});
