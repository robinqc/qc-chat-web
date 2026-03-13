import { Show } from "solid-js";

import { useLingui } from "@lingui-solid/solid/macro";
import { styled } from "styled-system/jsx";

import { CONFIGURATION } from "@revolt/common";
import { useVoice } from "@revolt/rtc";
import { Button, IconButton } from "@revolt/ui/components/design";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

interface VoiceCallCardActionsProps {
  size: "xs" | "sm";
  /**
   * When provided (full-room mode), a Minimize button is shown that collapses
   * the room to PiP without leaving the call.
   */
  onMinimize?: () => void;
}

export function VoiceCallCardActions(props: VoiceCallCardActionsProps) {
  const voice = useVoice();
  const { t } = useLingui();

  function isVideoEnabled() {
    return CONFIGURATION.ENABLE_VIDEO;
  }

  return (
    <Actions>
      <Show when={props.size === "xs"}>
        <a href={voice.channel()?.path}>
          <IconButton variant="standard" size={props.size}>
            <Symbol>arrow_top_left</Symbol>
          </IconButton>
        </a>
      </Show>
      <Show when={props.size === "sm" && props.onMinimize}>
        <IconButton
          size={props.size}
          variant="standard"
          onPress={() => props.onMinimize?.()}
          use:floating={{
            tooltip: {
              placement: "top",
              content: t`Minimise`,
            },
          }}
        >
          <Symbol>picture_in_picture_alt</Symbol>
        </IconButton>
      </Show>
      <IconButton
        size={props.size}
        variant={voice.microphone() ? "filled" : "tonal"}
        onPress={() => voice.toggleMute()}
        use:floating={{
          tooltip: voice.speakingPermission
            ? undefined
            : {
                placement: "top",
                content: t`Missing permission`,
              },
        }}
        isDisabled={!voice.speakingPermission}
      >
        <Show when={voice.microphone()} fallback={<Symbol>mic_off</Symbol>}>
          <Symbol>mic</Symbol>
        </Show>
      </IconButton>
      <IconButton
        size={props.size}
        variant={voice.deafen() || !voice.listenPermission ? "tonal" : "filled"}
        onPress={() => voice.toggleDeafen()}
        use:floating={{
          tooltip: voice.listenPermission
            ? undefined
            : {
                placement: "top",
                content: t`Missing permission`,
              },
        }}
        isDisabled={!voice.listenPermission}
      >
        <Show
          when={voice.deafen() || !voice.listenPermission}
          fallback={<Symbol>headset</Symbol>}
        >
          <Symbol>headset_off</Symbol>
        </Show>
      </IconButton>
      <IconButton
        size={props.size}
        variant={isVideoEnabled() && voice.video() ? "filled" : "tonal"}
        onPress={() => {
          if (isVideoEnabled()) voice.toggleCamera();
        }}
        use:floating={{
          tooltip: {
            placement: "top",
            content: isVideoEnabled()
              ? voice.video()
                ? "Stop Camera"
                : "Start Camera"
              : "Coming soon! 👀",
          },
        }}
        isDisabled={!isVideoEnabled()}
      >
        <Symbol>camera_video</Symbol>
      </IconButton>
      <IconButton
        size={props.size}
        variant={isVideoEnabled() && voice.screenshare() ? "filled" : "tonal"}
        onPress={() => {
          if (isVideoEnabled()) voice.toggleScreenshare();
        }}
        use:floating={{
          tooltip: {
            placement: "top",
            content: isVideoEnabled()
              ? voice.screenshare()
                ? "Stop Sharing"
                : "Share Screen"
              : "Coming soon! 👀",
          },
        }}
        isDisabled={!isVideoEnabled()}
      >
        <Show
          when={!isVideoEnabled() || voice.screenshare()}
          fallback={<Symbol>stop_screen_share</Symbol>}
        >
          <Symbol>screen_share</Symbol>
        </Show>
      </IconButton>
      <Button
        size={props.size}
        variant="_error"
        onPress={() => voice.disconnect()}
      >
        <Symbol>call_end</Symbol>
      </Button>
    </Actions>
  );
}

const Actions = styled("div", {
  base: {
    flexShrink: 0,
    gap: "var(--gap-md)",
    padding: "var(--gap-md)",

    display: "flex",
    width: "fit-content",
    justifyContent: "center",
    alignSelf: "center",

    borderRadius: "var(--borderRadius-full)",
    background: "var(--md-sys-color-surface-container)",
  },
});
