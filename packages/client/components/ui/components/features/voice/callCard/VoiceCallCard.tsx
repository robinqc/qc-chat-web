import {
  Accessor,
  JSX,
  Show,
  batch,
  createContext,
  createEffect,
  createSignal,
  on,
  onCleanup,
  useContext,
} from "solid-js";

import { Portal } from "solid-js/web";

import { Channel } from "stoat.js";
import { css } from "styled-system/css";

import { InRoom, useVoice } from "@revolt/rtc";

import { VoiceCallCardPiP } from "./VoiceCallCardPiP";
import { VoiceCallCardPreview } from "./VoiceCallCardPreview";
import { VoiceRoomView } from "./VoiceRoomView";

/**
 * Voice layout state:
 * - "pip": minimised card floating in a screen corner (draggable)
 * - "expanded": full-space in-flow view occupying the chat area
 */
type VoiceLayoutState =
  | {
      type: "pip";
      corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    }
  | {
      type: "expanded";
      channel: Channel;
    };

/** Payload passed by VoiceChannelCallCardMount when the user is on the voice channel */
type ExpandPayload = { channel: Channel };

/** Context value: update layout state + minimise action */
type CallCardContextValue = {
  /** Called by VoiceChannelCallCardMount to expand (or clear) the room view */
  updateState: (payload?: ExpandPayload) => void;
  /** Explicitly minimise the room to PiP */
  minimize: () => void;
  /** Whether the room is currently minimised by the user */
  minimized: Accessor<boolean>;
};

const callCardContext = createContext<CallCardContextValue>(null!);

/**
 * Returns whether the voice room is currently in expanded (full-space) mode
 * for the given channel.
 *
 * When true, the channel's messages + composition should be hidden since the
 * voice room is occupying the full chat area.
 */
export function useVoiceExpanded(
  channelId: () => string | undefined,
): Accessor<boolean> {
  const ctx = useContext(callCardContext);
  if (!ctx) return () => false;

  const voice = useVoice();
  return () => {
    const activeId = voice.channel()?.id;
    // Expanded only when: there is an active call on *this* channel AND not minimised
    return !!activeId && activeId === channelId() && !ctx.minimized();
  };
}

/**
 * Provides voice layout state to the entire app.
 * Renders the PiP floating card via a Portal when in pip mode.
 */
export function VoiceCallCardContext(props: { children: JSX.Element }) {
  const voice = useVoice();

  const [state, setState] = createSignal<VoiceLayoutState>({
    type: "pip",
    corner: "bottom-right",
  });

  /** Explicit user-initiated minimise flag */
  const [minimized, setMinimized] = createSignal(false);

  // ── PiP drag state ─────────────────────────────────────────────────────────
  const [moving, setMoving] = createSignal<boolean>();
  const [offset, setOffset] = createSignal({ x: 0, y: 0 });

  /** Compute inline style for the floating PiP container */
  function pipPosition() {
    const s = state();
    if (s.type !== "pip") return {};

    return {
      "--width": "280px",
      "--height": "158px",
      "--padding-x": "16px",
      "--padding-y": "96px",
      transform: `translate(${
        s.corner === "top-left" || s.corner === "bottom-left"
          ? "calc(var(--padding-x) + var(--offset-x))"
          : "calc(100vw - var(--padding-x) - var(--width) + var(--offset-x))"
      }, ${
        s.corner === "top-left" || s.corner === "top-right"
          ? "calc(var(--padding-y) + var(--offset-y))"
          : "calc(100vh - var(--padding-y) - var(--height) + var(--offset-y))"
      })`,
      width: "var(--width)",
      height: "var(--height)",
    };
  }

  // Attach drag listeners while the PiP is being dragged
  createEffect(
    on(moving, (isMoving) => {
      if (isMoving) {
        const controller = new AbortController();

        document.addEventListener(
          "mousemove",
          (event) => {
            if (state().type !== "pip") return controller.abort();
            setOffset((pos) => ({
              x: pos.x + event.movementX,
              y: pos.y + event.movementY,
            }));
          },
          { signal: controller.signal },
        );

        document.addEventListener(
          "mouseup",
          (event) => {
            batch(() => {
              setMoving(false);
              const left = event.clientX < window.outerWidth / 2;
              const top = event.clientY < window.outerHeight / 2;
              setState({
                type: "pip",
                corner: left
                  ? top
                    ? "top-left"
                    : "bottom-left"
                  : top
                    ? "top-right"
                    : "bottom-right",
              });
            });
          },
          { signal: controller.signal },
        );

        onCleanup(() => controller.abort());
      }
    }),
  );

  // ── State transitions ───────────────────────────────────────────────────────

  function updateState(payload?: ExpandPayload) {
    if (payload && !minimized()) {
      setState({ type: "expanded", channel: payload.channel });
    } else {
      setState({ type: "pip", corner: "bottom-right" });
    }
  }

  function minimize() {
    setMinimized(true);
    setState({ type: "pip", corner: "bottom-right" });
  }

  function updateStateWithTransition(payload?: ExpandPayload) {
    if (!document.startViewTransition) {
      updateState(payload);
      return;
    }
    document.startViewTransition(() => updateState(payload));
  }

  /** Exposed to VoiceChannelCallCardMount — also resets minimized when the
   *  user navigates back to the voice channel while in PiP. */
  function handleMountUpdate(payload?: ExpandPayload) {
    if (payload) {
      // User navigated to the voice channel: lift the explicit minimise
      setMinimized(false);
    }
    updateStateWithTransition(payload);
  }

  const contextValue: CallCardContextValue = {
    updateState: handleMountUpdate,
    minimize,
    minimized,
  };

  return (
    <callCardContext.Provider value={contextValue}>
      {props.children}

      {/* PiP card — only rendered when in pip mode and a call is active */}
      <Show when={state().type === "pip"}>
        <Portal ref={document.getElementById("floating")! as HTMLDivElement}>
          <div
            style={{
              position: "fixed",
              "z-index": 10,
              "transition-duration": moving() ? ".2s" : voice.room() && ".3s",
              "transition-property": "all",
              "transition-timing-function": moving()
                ? "cubic-bezier(0, 1.67, 0.85, 0.8)"
                : "cubic-bezier(1, 0, 0, 1)",
              ...pipPosition(),
              "pointer-events": "none",
              cursor: moving() ? "grabbing" : "grab",
              "--offset-x": `${moving() ? offset().x : 0}px`,
              "--offset-y": `${moving() ? offset().y : 0}px`,
            }}
            onMouseDown={() => {
              batch(() => {
                setMoving(true);
                setOffset({ x: 0, y: 0 });
              });
            }}
          >
            <InRoom>
              <VoiceCallCardPiP />
            </InRoom>
          </div>
        </Portal>
      </Show>
    </callCardContext.Provider>
  );
}

/**
 * Placed inside TextChannel for voice-capable channels.
 * - When the user is on this channel and not minimised: renders the full-space
 *   VoiceRoomView in normal document flow.
 * - Otherwise (no active call, or call active in a different channel): renders
 *   VoiceCallCardPreview so the user can join or switch to this channel's call.
 * - On cleanup (navigating away): reverts to PiP.
 */
export function VoiceChannelCallCardMount(props: { channel: Channel }) {
  const voice = useVoice();
  const { updateState, minimize, minimized } = useContext(callCardContext)!;

  const isActiveChannel = () => voice.channel()?.id === props.channel.id;

  // Sync layout state whenever the active voice channel or this channel changes
  createEffect(() => {
    const activeChannel = voice.channel();
    const isHere = !activeChannel || activeChannel.id === props.channel.id;

    if (isHere) {
      updateState({ channel: props.channel });
    } else {
      updateState();
    }
  });

  onCleanup(() => updateState());

  return (
    <Show
      when={isActiveChannel() && !minimized()}
      fallback={
        // Shown when: not in this call (no call at all, or call is elsewhere).
        // VoiceCallCardPreview handles both "Join" and "Switch" labels itself.
        <div class={css({ padding: "var(--gap-md)", height: "100%" })}>
          <VoiceCallCardPreview channel={props.channel} />
        </div>
      }
    >
      <VoiceRoomView onMinimize={minimize} />
    </Show>
  );
}
