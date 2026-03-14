import { Key } from "@solid-primitives/keyed";
import {
  createEffect,
  createMemo,
  createSignal,
  Match,
  on,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import {
  isTrackReference,
  TrackLoop,
  TrackReference,
  TrackReferenceOrPlaceholder,
  useEnsureParticipant,
  useIsMuted,
  useIsSpeaking,
  useMaybeTrackRefContext,
  useTrackRefContext,
  useTracks,
  VideoTrack,
} from "solid-livekit-components";

import { getTrackReferenceId } from "@livekit/components-core";
import { Track } from "livekit-client";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { UserContextMenu } from "@revolt/app";
import { ContextMenu, ContextMenuButton } from "@revolt/app/menus/ContextMenu";
import { useUser } from "@revolt/markdown/users";
import { InRoom } from "@revolt/rtc";
import { useState } from "@revolt/state";
import { Avatar, Button, Slider, Text } from "@revolt/ui/components/design";
import { OverflowingText } from "@revolt/ui/components/utils";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { VoiceStatefulUserIcons } from "../VoiceStatefulUserIcons";

import { useScreenShareWatch } from "./VoiceCallCard";
import { VoiceCallCardActions } from "./VoiceCallCardActions";
import { VoiceCallCardStatus } from "./VoiceCallCardStatus";

// ── Main component ────────────────────────────────────────────────────────────

interface VoiceCallCardActiveRoomProps {
  /** When provided, a Minimize button is shown in the action bar */
  onMinimize?: () => void;
}

/**
 * Call card (active)
 *
 * Screen share watch state (watchedIds, focusedId, etc.) is owned by the
 * top-level VoiceCallCardContext and consumed here via useScreenShareWatch().
 */
export function VoiceCallCardActiveRoom(props: VoiceCallCardActiveRoomProps) {
  return (
    <View>
      <Call>
        <InRoom>
          <Participants />
        </InRoom>
      </Call>

      <VoiceCallCardStatus />
      <VoiceCallCardActions size="sm" onMinimize={props.onMinimize} />
    </View>
  );
}

const View = styled("div", {
  base: {
    minHeight: 0,
    height: "100%",
    width: "100%",

    gap: "var(--gap-md)",
    padding: "var(--gap-md)",

    display: "flex",
    flexDirection: "column",

    // Subtle coloured glow emanating from behind the bottom toolbar
    backgroundImage:
      "radial-gradient(ellipse 60% 80px at 50% 100%, color-mix(in srgb, var(--md-sys-color-primary) 25%, transparent) 0%, transparent 100%)",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "bottom center",
    backgroundSize: "100% 160px",
  },
});

const Call = styled("div", {
  base: {
    flexGrow: 1,
    minHeight: 0,
    overflowY: "auto",
  },
});

// ── Participants layout ───────────────────────────────────────────────────────

function Participants() {
  const ctx = useScreenShareWatch()!;

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  // Separate screen share tracks from camera/placeholder tracks
  const screenShareTracks = createMemo(() =>
    tracks().filter((t) => t.source === Track.Source.ScreenShare),
  );

  const otherTracks = createMemo(() =>
    tracks().filter((t) => t.source !== Track.Source.ScreenShare),
  );

  // Auto-unwatch when a screen share track disappears
  createEffect(
    on(
      () => new Set(screenShareTracks().map((t) => getTrackReferenceId(t))),
      (currentIds) => {
        const watched = ctx.watchedIds();
        for (const id of watched) {
          if (!currentIds.has(id)) {
            ctx.unwatchStream(id);
          }
        }
      },
    ),
  );

  // Find the focused track reference
  const focusedTrack = createMemo(() => {
    const fid = ctx.focusedId();
    if (!fid) return null;
    return (
      screenShareTracks().find((t) => getTrackReferenceId(t) === fid) ?? null
    );
  });

  // Non-focused screen share tracks (for the grid or thumbnail strip)
  const nonFocusedScreenShares = createMemo(() => {
    const fid = ctx.focusedId();
    return screenShareTracks().filter((t) => getTrackReferenceId(t) !== fid);
  });

  return (
    <Show
      when={focusedTrack()}
      fallback={
        // Mode A: no focused stream — normal grid
        <Grid>
          <TrackLoop tracks={tracks}>{() => <ParticipantTile />}</TrackLoop>
        </Grid>
      }
    >
      {(focused) => (
        // Mode B: a stream is focused — focused layout.
        // The focused tile is keyed by its track ID so that switching focus
        // remounts the VideoTrack (needed because VideoTrack destructures
        // props and loses reactivity on trackRef changes).
        <FocusedLayout>
          <FocusedStreamArea>
            <Key each={[focused()]} by={(item) => getTrackReferenceId(item)}>
              {(trackRef) => (
                <ScreenshareTile trackRef={trackRef()} isFocused />
              )}
            </Key>
          </FocusedStreamArea>
          <ThumbnailStrip>
            <Key
              each={nonFocusedScreenShares()}
              by={(item) => getTrackReferenceId(item)}
            >
              {(trackRef) => (
                <ScreenshareTile trackRef={trackRef()} isThumbnail />
              )}
            </Key>
            <Key each={otherTracks()} by={(item) => getTrackReferenceId(item)}>
              {(trackRef) => <UserTile trackRef={trackRef()} isThumbnail />}
            </Key>
          </ThumbnailStrip>
        </FocusedLayout>
      )}
    </Show>
  );
}

const Grid = styled("div", {
  base: {
    display: "grid",
    gap: "var(--gap-md)",
    padding: "var(--gap-md)",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  },
});

const FocusedLayout = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    gap: "var(--gap-md)",
    padding: "var(--gap-md)",
  },
});

const FocusedStreamArea = styled("div", {
  base: {
    flexGrow: 1,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
});

const ThumbnailStrip = styled("div", {
  base: {
    flexShrink: 0,
    height: "140px",
    display: "flex",
    flexDirection: "row",
    gap: "var(--gap-md)",
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: "var(--gap-sm)",
  },
});

// ── Individual participant tile ───────────────────────────────────────────────

function ParticipantTile() {
  const track = useTrackRefContext();

  return (
    <Switch fallback={<UserTile />}>
      <Match when={track.source === Track.Source.ScreenShare}>
        <ScreenshareTile />
      </Match>
    </Switch>
  );
}

// ── UserTile ──────────────────────────────────────────────────────────────────

function UserTile(props: {
  trackRef?: TrackReferenceOrPlaceholder;
  isThumbnail?: boolean;
}) {
  // Use provided trackRef or fall back to context
  const contextTrack = useMaybeTrackRefContext();
  const track = () => props.trackRef ?? contextTrack;

  const participant = props.trackRef?.participant ?? useEnsureParticipant();

  const isMuted = useIsMuted({
    participant,
    source: Track.Source.Microphone,
  });

  const isVideoMuted = useIsMuted({
    participant,
    source: Track.Source.Camera,
  });

  const isSpeaking = useIsSpeaking(participant);

  const user = useUser(participant.identity);

  let videoRef: HTMLDivElement | undefined;

  function toggleFullscreen() {
    const t = track();
    if (!videoRef || !isTrackReference(t) || isVideoMuted()) return;
    if (!document.fullscreenElement) {
      videoRef.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  createEffect(() => {
    if (isVideoMuted() && document.fullscreenElement) {
      document.exitFullscreen();
    }
  });

  return (
    <div
      ref={videoRef}
      class={tile({
        speaking: isSpeaking(),
        thumbnail: props.isThumbnail,
      })}
      onClick={toggleFullscreen}
      style={{
        cursor: "pointer",
        background: cardColorFor(participant.identity),
        color: "white",
      }}
      use:floating={{
        userCard: {
          user: user().user!,
          member: user().member,
        },
        contextMenu: () => (
          <UserContextMenu user={user().user!} member={user().member} inVoice />
        ),
      }}
    >
      <Switch
        fallback={
          <AvatarOnly>
            <Avatar
              src={user().avatar}
              fallback={user().username}
              size={props.isThumbnail ? 32 : 48}
              interactive={false}
            />
          </AvatarOnly>
        }
      >
        <Match when={isTrackReference(track()) && !isVideoMuted()}>
          <VideoTrack
            style={{
              "grid-area": "1/1",
              "object-fit": "contain",
              width: "100%",
              height: "100%",
            }}
            trackRef={track() as TrackReference}
            manageSubscription={true}
          />
        </Match>
      </Switch>

      <Overlay>
        <OverlayInner>
          <OverflowingText>{user().username}</OverflowingText>
          <VoiceStatefulUserIcons
            userId={participant.identity}
            muted={isMuted()}
          />
          <Show when={isTrackReference(track()) && !isVideoMuted()}>
            <Symbol size={18}>fullscreen</Symbol>
          </Show>
        </OverlayInner>
      </Overlay>
    </div>
  );
}

const AvatarOnly = styled("div", {
  base: {
    gridArea: "1/1",
    display: "grid",
    placeItems: "center",
  },
});

// ── ScreenshareTile ───────────────────────────────────────────────────────────

function ScreenshareTile(props: {
  trackRef?: TrackReferenceOrPlaceholder;
  isFocused?: boolean;
  isThumbnail?: boolean;
}) {
  const contextTrack = useMaybeTrackRefContext();
  const track = () => props.trackRef ?? contextTrack;

  // Derive participant reactively from the track reference.
  // When used inside TrackLoop (grid mode), contextTrack provides the participant.
  // When used with explicit trackRef (focused/thumbnail mode), props provides it.
  const participant = () => track()?.participant;

  const userId = createMemo(() => participant()?.identity ?? "");
  const userInfo = useUser(userId);
  const ctx = useScreenShareWatch()!;

  const trackId = createMemo(() => {
    const t = track();
    return t ? getTrackReferenceId(t) : "";
  });

  const isWatched = createMemo(() => ctx.watchedIds().has(trackId()));
  const isFocusedHere = () => props.isFocused === true;

  const isMuted = createMemo(() => {
    const p = participant();
    if (!p) return true;
    return p
      .getTrackPublications()
      .every(
        (pub) => pub.source !== Track.Source.ScreenShareAudio || pub.isMuted,
      );
  });

  let videoRef: HTMLDivElement | undefined;

  // Track the source video's native aspect ratio so the focused tile can
  // size itself to match the stream rather than stretching to fill.
  const [aspectRatio, setAspectRatio] = createSignal<string | undefined>();

  createEffect(() => {
    if (!isFocusedHere() || !isWatched() || !videoRef) return;
    const video = videoRef.querySelector("video");
    if (!video) return;

    const updateAR = () => {
      if (video.videoWidth && video.videoHeight) {
        setAspectRatio(`${video.videoWidth}/${video.videoHeight}`);
      }
    };

    video.addEventListener("resize", updateAR);
    updateAR(); // check if dimensions are already available
    onCleanup(() => video.removeEventListener("resize", updateAR));
  });

  function handleClick() {
    const id = trackId();
    if (isFocusedHere()) {
      // Clicking the focused (big) stream unfocuses it back to a thumbnail
      ctx.focusStream(null);
      return;
    }
    // Clicking a non-focused tile: auto-watch if needed, then focus it
    if (!isWatched()) {
      ctx.watchStream(id);
    }
    ctx.focusStream(id);
  }

  function handleWatchClick(e: MouseEvent) {
    e.stopPropagation();
    ctx.watchStream(trackId());
  }

  function handleUnwatchClick(e: MouseEvent) {
    e.stopPropagation();
    ctx.unwatchStream(trackId());
  }

  function requestFullscreen(e: MouseEvent) {
    e.stopPropagation();
    if (!videoRef) return;
    if (!document.fullscreenElement) {
      videoRef.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  return (
    <div
      ref={videoRef}
      class={
        tile({
          focused: isFocusedHere(),
          thumbnail: props.isThumbnail,
        }) + " group"
      }
      onClick={handleClick}
      style={{
        cursor:
          isWatched() || props.isThumbnail || isFocusedHere()
            ? "pointer"
            : "default",
        ...(isFocusedHere() && aspectRatio()
          ? { "aspect-ratio": aspectRatio() }
          : {}),
      }}
      use:floating={{
        contextMenu: () => <ScreenShareContextMenu userId={userId()} />,
      }}
    >
      <Show
        when={isWatched()}
        fallback={
          // Unwatched state: show avatar + "Watch Stream" button
          <UnwatchedContent>
            <Avatar
              src={userInfo().avatar}
              fallback={userInfo().username}
              size={props.isThumbnail ? 24 : 40}
              interactive={false}
            />
            <UnwatchedLabel>
              <OverflowingText>{userInfo().username}'s screen</OverflowingText>
            </UnwatchedLabel>
            <Button
              size="sm"
              variant="filled"
              onPress={() => ctx.watchStream(trackId())}
            >
              <Symbol size={16}>visibility</Symbol>
              Watch Stream
            </Button>
          </UnwatchedContent>
        }
      >
        {/* Watched state: show the video */}
        <Show when={isTrackReference(track())}>
          <VideoTrack
            style={{
              "grid-area": "1/1",
              "object-fit": "contain",
              width: "100%",
              height: "100%",
            }}
            trackRef={track() as TrackReference}
            manageSubscription={true}
          />
        </Show>

        <Overlay showOnHover>
          <OverlayInner>
            <OverflowingText>{userInfo().username}</OverflowingText>
            <OverlayActions>
              <Show when={isMuted()}>
                <Symbol size={18}>no_sound</Symbol>
              </Show>
              <Show when={isFocusedHere()}>
                <OverlayIconButton
                  onClick={handleUnwatchClick}
                  title="Stop Watching"
                >
                  <Symbol size={18}>visibility_off</Symbol>
                </OverlayIconButton>
                <OverlayIconButton
                  onClick={requestFullscreen}
                  title="Fullscreen"
                >
                  <Symbol size={18}>fullscreen</Symbol>
                </OverlayIconButton>
              </Show>
              <Show when={!isFocusedHere() && isWatched()}>
                <Symbol size={18}>open_in_full</Symbol>
              </Show>
            </OverlayActions>
          </OverlayInner>
        </Overlay>
      </Show>
    </div>
  );
}

/**
 * Context menu shown on right-click of a screen share tile.
 * Contains a volume slider for the screen share audio.
 */
function ScreenShareContextMenu(props: { userId: string }) {
  const state = useState();

  return (
    <ContextMenu>
      <ContextMenuButton
        onMouseDown={(e: MouseEvent) => e.stopImmediatePropagation()}
        onClick={(e: MouseEvent) => e.stopImmediatePropagation()}
      >
        <Text class="label">Stream Volume</Text>
        <Slider
          min={0}
          max={3}
          step={0.1}
          value={state.voice.getUserScreenShareVolume(props.userId)}
          onInput={(event: { currentTarget: { value: number } }) =>
            state.voice.setUserScreenShareVolume(
              props.userId,
              event.currentTarget.value,
            )
          }
          labelFormatter={(label: number) => (label * 100).toFixed(0) + "%"}
        />
      </ContextMenuButton>
    </ContextMenu>
  );
}

// ── Color palette for user card backgrounds ──────────────────────────────────

const CARD_COLORS = [
  "#2D5A7B", // deep blue
  "#6B3A6B", // plum
  "#2B6E4F", // forest green
  "#7B4A3D", // burnt sienna
  "#4A4A8A", // muted indigo
  "#6B5B3E", // dark gold
  "#3D6B6B", // teal
  "#8B4560", // berry
  "#4E6B3A", // olive
  "#5A4A7B", // deep purple
  "#7B5E3A", // bronze
  "#3A5E6B", // slate blue
];

/** Deterministic card colour for a given user identity string. */
function cardColorFor(identity: string): string {
  let hash = 0;
  for (let i = 0; i < identity.length; i++) {
    hash = ((hash << 5) - hash + identity.charCodeAt(i)) | 0;
  }
  return CARD_COLORS[Math.abs(hash) % CARD_COLORS.length];
}

// ── Styled components ─────────────────────────────────────────────────────────

const tile = cva({
  base: {
    display: "grid",
    aspectRatio: "16/9",
    transition: ".3s ease all",
    borderRadius: "var(--borderRadius-lg)",

    color: "var(--md-sys-color-on-surface)",
    background: "#0002",

    overflow: "hidden",
    outlineWidth: "3px",
    outlineStyle: "solid",
    outlineOffset: "-3px",
    outlineColor: "transparent",
  },
  variants: {
    speaking: {
      true: {
        outlineColor: "var(--md-sys-color-primary)",
      },
    },
    focused: {
      true: {
        maxWidth: "100%",
        maxHeight: "100%",
      },
    },
    thumbnail: {
      true: {
        height: "100%",
        width: "auto",
        aspectRatio: "16/9",
        flexShrink: 0,
      },
    },
  },
});

const Overlay = styled("div", {
  base: {
    minWidth: 0,
    gridArea: "1/1",

    padding: "var(--gap-md) var(--gap-lg)",

    opacity: 1,
    display: "flex",
    alignItems: "end",
    flexDirection: "row",

    transition: "var(--transitions-fast) all",
    transitionTimingFunction: "ease",
  },
  variants: {
    showOnHover: {
      true: {
        opacity: 0,

        _groupHover: {
          opacity: 1,
        },
      },
      false: {
        opacity: 1,
      },
    },
  },
  defaultVariants: {
    showOnHover: false,
  },
});

const OverlayInner = styled("div", {
  base: {
    minWidth: 0,
    width: "100%",

    display: "flex",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",

    _first: {
      flexGrow: 1,
    },
  },
});

const OverlayActions = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    flexShrink: 0,
  },
});

const OverlayIconButton = styled("button", {
  base: {
    all: "unset",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px",
    borderRadius: "var(--borderRadius-md)",
    transition: "background 0.15s ease",

    _hover: {
      background: "rgba(255, 255, 255, 0.2)",
    },
  },
});

const UnwatchedContent = styled("div", {
  base: {
    gridArea: "1/1",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--gap-md)",
    padding: "var(--gap-lg)",
  },
});

const UnwatchedLabel = styled("div", {
  base: {
    fontSize: "0.85rem",
    opacity: 0.8,
    textAlign: "center",
  },
});
