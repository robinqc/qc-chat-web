import { For, Show } from "solid-js";

import { Trans, useLingui } from "@lingui-solid/solid/macro";
import { Channel } from "stoat.js";
import { styled } from "styled-system/jsx";

import { useUsers } from "@revolt/markdown/users";
import { useVoice } from "@revolt/rtc";
import { Avatar, Ripple, Text } from "@revolt/ui/components/design";
import { Row } from "@revolt/ui/components/layout";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

interface VoiceCallCardPreviewProps {
  channel: Channel;
  /**
   * When true, renders as a compact card suitable for floating above the
   * message list instead of filling the entire content area.
   */
  compact?: boolean;
}

/**
 * Call card (preview)
 */
export function VoiceCallCardPreview(props: VoiceCallCardPreviewProps) {
  const voice = useVoice();
  const { t } = useLingui();

  const ids = () => [...props.channel.voiceParticipants.keys()];
  const users = useUsers(ids);

  function subtext() {
    const names = users()
      .map((user) => user?.username)
      .filter((x) => x);

    return names.length ? t`With ${names.join(", ")}` : t`Start the call`;
  }

  return (
    <Preview
      compact={props.compact}
      onClick={() => voice.connect(props.channel)}
    >
      <Ripple />
      <Row>
        <For each={users()} fallback={<Symbol size={24}>voice_chat</Symbol>}>
          {(user) => (
            <Avatar size={24} src={user?.avatar} fallback={user?.username} />
          )}
        </For>
      </Row>
      <Text class="title" size="large">
        <Show
          when={voice.state() === "READY"}
          fallback={<Trans>Switch to this voice channel</Trans>}
        >
          <Trans>Join the voice channel</Trans>
        </Show>
      </Text>
      <Text class="body">{subtext()}</Text>
    </Preview>
  );
}

const Preview = styled("div", {
  base: {
    position: "relative", // <Ripple />
    borderRadius: "var(--borderRadius-lg)",

    height: "100%",
    justifyContent: "center",

    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-sm)",
    padding: "var(--gap-lg)",

    color: "var(--md-sys-color-on-surface)",

    cursor: "pointer",
  },
  variants: {
    compact: {
      true: {
        height: "auto",
        padding: "var(--gap-md)",
        background:
          "color-mix(in srgb, var(--md-sys-color-surface-container) 60%, transparent)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border:
          "1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 50%, transparent)",
        flexDirection: "row",
        alignItems: "center",
        gap: "var(--gap-md)",
        flexShrink: 0,
      },
    },
  },
});
