import {
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from "solid-js";

import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";
import { decodeTime, ulid } from "ulid";

import { DraftMessages, Messages } from "@revolt/app";
import { useClient } from "@revolt/client";
import { Keybind, KeybindAction, createKeybind } from "@revolt/keybinds";
import { useNavigate, useSmartParams } from "@revolt/routing";
import { useState } from "@revolt/state";
import { LAYOUT_SECTIONS } from "@revolt/state/stores/Layout";
import {
  BelowFloatingHeader,
  Header,
  NewMessages,
  Text,
  TypingIndicator,
  main,
} from "@revolt/ui";
import {
  VoiceChannelCallCardMount,
  VoiceViewMode,
} from "@revolt/ui/components/features/voice/callCard/VoiceCallCard";

import { ChannelHeader } from "../ChannelHeader";
import { ChannelPageProps } from "../ChannelPage";

import { useVoice } from "@revolt/rtc";
import { VoiceCallCardPreview } from "@revolt/ui/components/features/voice/callCard/VoiceCallCardPreview";
import { MessageComposition } from "./Composition";
import { MemberSidebar } from "./MemberSidebar";
import { TextSearchSidebar } from "./TextSearchSidebar";

/**
 * State of the channel sidebar
 */
export type SidebarState =
  | {
      state: "search";
      query: string;
    }
  | {
      state: "pins";
    }
  | {
      state: "default";
    };

/**
 * Channel component
 */
export function TextChannel(props: ChannelPageProps) {
  const state = useState();
  const client = useClient();
  const voice = useVoice();

  // Last unread message id
  const [lastId, setLastId] = createSignal<string>();

  // Read highlighted message id from parameters
  const params = useSmartParams();
  const navigate = useNavigate();

  /**
   * Message id to be highlighted
   * @returns Message Id
   */
  const highlightMessageId = () => params().messageId;

  const canConnect = () =>
    props.channel.isVoice && props.channel.havePermission("Connect");

  /**
   * View mode for voice channels:
   * - "messages": show message list (default when clicking a voice channel)
   * - "voiceroom": show the full-space voice room (after joining the call)
   */
  const [viewMode, setViewMode] = createSignal<VoiceViewMode>("messages");

  // Reset viewMode to messages when switching channels
  createEffect(
    on(
      () => props.channel.id,
      () => setViewMode("messages"),
    ),
  );

  /** Whether the user is currently in a voice call on THIS channel */
  const isInCallHere = () => voice.channel()?.id === props.channel.id;

  /**
   * Messages are shown when:
   * - It's a non-voice channel (always), OR
   * - It's a voice channel and viewMode is "messages"
   */
  const showMessages = () => !canConnect() || viewMode() === "messages";

  /**
   * The channel header is hidden when the voice room is shown full-space,
   * because VoiceRoomView has its own chat toggle in the top-right corner.
   */
  const showHeader = () => !canConnect() || viewMode() !== "voiceroom";

  // Get a reference to the message box's load latest function
  let jumpToBottomRef: ((nearby?: string) => void) | undefined;

  // Get a reference to the message list's "end status"
  let atEndRef: (() => boolean) | undefined;

  // Store last unread message id
  createEffect(
    on(
      () => props.channel.id,
      (id) =>
        setLastId(
          props.channel.unread
            ? (client().channelUnreads.get(id)?.lastMessageId as string)
            : undefined,
        ),
    ),
  );

  // Mark channel as read whenever it is marked as unread
  createEffect(
    on(
      // must be at the end of the conversation
      () => props.channel.unread && (atEndRef ? atEndRef() : true),
      (unread) => {
        if (unread) {
          if (document.hasFocus()) {
            // acknowledge the message
            props.channel.ack();
          } else {
            // otherwise mark this location as the last read location
            if (!lastId()) {
              // (taking away one second from the seed)
              setLastId(ulid(decodeTime(props.channel.lastMessageId!) - 1));
            }
          }
        }
      },
    ),
  );

  // Mark as read on re-focus
  function onFocus() {
    if (props.channel.unread && (atEndRef ? atEndRef() : true)) {
      props.channel.ack();
    }
  }

  document.addEventListener("focus", onFocus);
  onCleanup(() => document.removeEventListener("focus", onFocus));

  // Register ack/jump latest
  createKeybind(KeybindAction.CHAT_JUMP_END, () => {
    // Mark channel as read if not already
    if (props.channel.unread) {
      props.channel.ack();
    }

    // Clear the last unread id
    if (lastId()) {
      setLastId(undefined);
    }

    // Scroll to the bottom
    jumpToBottomRef?.();
  });

  // Sidebar scroll target
  let sidebarScrollTargetElement!: HTMLDivElement;

  // Sidebar state
  const [sidebarState, setSidebarState] = createSignal<SidebarState>({
    state: "default",
  });

  // todo: in the future maybe persist per ID?
  createEffect(
    on(
      () => props.channel.id,
      () => setSidebarState({ state: "default" }),
    ),
  );

  // Close the member sidebar when entering the voice room view
  createEffect(
    on(
      () => canConnect() && viewMode() === "voiceroom",
      (isVoiceRoom) => {
        if (isVoiceRoom) {
          setSidebarState({ state: "default" });
          state.layout.setSectionState(
            LAYOUT_SECTIONS.MEMBER_SIDEBAR,
            false,
            true,
          );
        }
      },
    ),
  );

  return (
    <>
      {/* Header: hidden when the voice room view is active (it has its own toggle) */}
      <Show when={showHeader()}>
        <Header bottomBorder topBorder>
          <ChannelHeader
            channel={props.channel}
            sidebarState={sidebarState}
            setSidebarState={setSidebarState}
          />
        </Header>
      </Show>
      <Content>
        <main class={main()}>
          {/*
           * VoiceChannelCallCardMount: only renders the full-space VoiceRoomView
           * when viewMode is "voiceroom" and the user is in a call on this channel.
           * Auto-switching logic (join -> voiceroom, disconnect -> messages) is
           * handled inside the mount component.
           */}
          <Show when={canConnect()}>
            <VoiceChannelCallCardMount
              channel={props.channel}
              viewMode={viewMode}
              setViewMode={setViewMode}
            />
          </Show>

          {/* Messages area: shown for text channels always, and for voice channels in messages view */}
          <Show when={showMessages()}>
            <MessagesArea
              style={{
                "--overlay-top-height":
                  canConnect() && !isInCallHere() ? "72px" : "0px",
                "--overlay-bottom-height": "80px",
              }}
            >
              {/*
               * Compact "Join voice channel" preview card shown at the top of
               * the message area when viewing a voice channel but not in a call.
               * Absolutely positioned to float over the message list.
               */}
              <Show when={canConnect() && !isInCallHere()}>
                <TopOverlay>
                  <VoiceCallCardPreview channel={props.channel} compact />
                </TopOverlay>
              </Show>

              <BelowFloatingHeader>
                <div>
                  <NewMessages
                    lastId={lastId}
                    jumpBack={() => navigate(lastId()!)}
                    dismiss={() => setLastId()}
                  />
                </div>
              </BelowFloatingHeader>

              <Messages
                channel={props.channel}
                lastReadId={lastId}
                pendingMessages={(pendingProps) => (
                  <DraftMessages
                    channel={props.channel}
                    tail={pendingProps.tail}
                    sentIds={pendingProps.ids}
                  />
                )}
                typingIndicator={
                  <TypingIndicator
                    users={props.channel.typing}
                    ownId={client().user!.id}
                  />
                }
                highlightedMessageId={highlightMessageId}
                clearHighlightedMessage={() => navigate(".")}
                atEndRef={(ref) => (atEndRef = ref)}
                jumpToBottomRef={(ref) => (jumpToBottomRef = ref)}
              />

              <BottomOverlay>
                <MessageComposition
                  channel={props.channel}
                  onMessageSend={() => jumpToBottomRef?.()}
                />
              </BottomOverlay>
            </MessagesArea>
          </Show>
        </main>
        <Show
          when={
            (state.layout.getSectionState(
              LAYOUT_SECTIONS.MEMBER_SIDEBAR,
              true,
            ) &&
              props.channel.type !== "SavedMessages") ||
            sidebarState().state !== "default"
          }
        >
          <div
            ref={sidebarScrollTargetElement}
            use:scrollable={{
              direction: "y",
              showOnHover: true,
              class: sidebar(),
            }}
            style={{
              width: sidebarState().state !== "default" ? "360px" : "",
            }}
          >
            <Switch
              fallback={
                <MemberSidebar
                  channel={props.channel}
                  scrollTargetElement={sidebarScrollTargetElement}
                />
              }
            >
              <Match when={sidebarState().state === "search"}>
                <WideSidebarContainer>
                  <SidebarTitle>
                    <Text class="label" size="large">
                      Search Results
                    </Text>
                  </SidebarTitle>
                  <TextSearchSidebar
                    channel={props.channel}
                    query={{
                      query: (sidebarState() as { query: string }).query,
                    }}
                  />
                </WideSidebarContainer>
              </Match>
              <Match when={sidebarState().state === "pins"}>
                <WideSidebarContainer>
                  <SidebarTitle>
                    <Text class="label" size="large">
                      Pinned Messages
                    </Text>
                  </SidebarTitle>
                  <TextSearchSidebar
                    channel={props.channel}
                    query={{ pinned: true, sort: "Latest" }}
                  />
                </WideSidebarContainer>
              </Match>
            </Switch>

            <Show when={sidebarState().state !== "default"}>
              <Keybind
                keybind={KeybindAction.CLOSE_SIDEBAR}
                onPressed={() => setSidebarState({ state: "default" })}
              />
            </Show>
          </div>
        </Show>
      </Content>
    </>
  );
}

/**
 * Main content row layout
 */
const Content = styled("div", {
  base: {
    display: "flex",
    flexDirection: "row",
    flexGrow: 1,
    minWidth: 0,
    minHeight: 0,
  },
});

/**
 * Relative wrapper for the messages area.
 * All overlays (top voice banner, bottom composition) are absolutely
 * positioned within this container so they float over the scrollable
 * message list.
 *
 * CSS custom properties:
 *  --overlay-top-height:    height of the top floating banner
 *  --overlay-bottom-height: height of the bottom floating input
 */
const MessagesArea = styled("div", {
  base: {
    position: "relative",
    flexGrow: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
});

/**
 * Absolutely positioned overlay at the top of the messages area.
 * Houses the compact "Join voice channel" preview card.
 * Transparent container — the frosted effect lives on the child elements.
 */
const TopOverlay = styled("div", {
  base: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    padding: "var(--gap-md)",
    pointerEvents: "none",

    "& > *": {
      pointerEvents: "auto",
    },
  },
});

/**
 * Absolutely positioned overlay at the bottom of the messages area.
 * Houses the message composition (input + send button).
 * Transparent container — the frosted effect lives on the child elements.
 */
const BottomOverlay = styled("div", {
  base: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    pointerEvents: "none",

    "& > *": {
      pointerEvents: "auto",
    },
  },
});

/**
 * Base styles
 */
const sidebar = cva({
  base: {
    flexShrink: 0,
    width: "var(--layout-width-channel-sidebar)",
    // margin: "var(--gap-md)",
    borderLeft:
      "1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 50%, transparent)",
    // color: "var(--colours-sidebar-channels-foreground)",
    // background: "var(--colours-sidebar-channels-background)",
  },
});

/**
 * Container styles
 */
const WideSidebarContainer = styled("div", {
  base: {
    paddingRight: "var(--gap-md)",
    width: "360px",
  },
});

/**
 * Sidebar title
 */
const SidebarTitle = styled("div", {
  base: {
    padding: "var(--gap-md)",
    color: "var(--md-sys-color-on-surface)",
  },
});
