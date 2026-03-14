import { BiRegularBlock } from "solid-icons/bi";
import { Accessor, JSX, Match, Show, Switch, onMount } from "solid-js";

import { Trans } from "@lingui-solid/solid/macro";
import { styled } from "styled-system/jsx";

import { Row } from "@revolt/ui";
import { AutoCompleteSearchSpace } from "@revolt/ui/components/utils/autoComplete";

import { TextEditor2 } from "../../texteditor/TextEditor2";

interface Props {
  /**
   * Initial content
   */
  initialValue: readonly [string];

  /**
   * Node replacement
   */
  nodeReplacement?: readonly [string | "_focus"];

  /**
   * Text content
   */
  content: string;

  /**
   * Handle event to send message
   */
  onSendMessage: () => void;

  /**
   * Handle event when user is typing
   */
  onTyping: () => void;

  /**
   * Handle event when user wants to edit the last message in chat
   */
  onEditLastMessage: () => void;

  /**
   * Update text content
   * @param v New content
   */
  setContent: (v: string) => void;

  /**
   * Actions to the left of the message box
   */
  actionsStart: JSX.Element;

  /**
   * Actions to the right of the message box
   */
  actionsEnd: JSX.Element;

  /**
   * Elements appended after the message box row
   */
  actionsAppend: JSX.Element;

  /**
   * Whether there are elements appended after the message box row
   */
  hasActionsAppend: boolean;

  /**
   * Placeholder in message box
   */
  placeholder: string;

  /**
   * Whether sending messages is allowed
   */
  sendingAllowed: boolean;

  /**
   * Auto complete config
   */
  autoCompleteSearchSpace?: Accessor<AutoCompleteSearchSpace>;

  /**
   * Update the current draft selection
   *
   * @deprecated have to hook into ProseMirror instance now!
   */
  updateDraftSelection?: (start: number, end: number) => void;
}

/**
 * Message box container
 */
const Base = styled("div", {
  base: {
    flexGrow: 1,

    paddingInlineEnd: "var(--gap-md)",
    paddingBlock: "var(--gap-sm)",
    borderRadius: "var(--borderRadius-xl)",
    border:"1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 40%, transparent)",

    display: "flex",
    background:
      "color-mix(in srgb, var(--md-sys-color-surface-container-high) 60%, transparent)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    color: "var(--md-sys-color-on-surface)",
  },
  variants: {
    hasActionsAppend: {
      true: {
        borderEndRadius: "var(--borderRadius-xl)",
      },
      false: {
        borderEndRadius: "var(--borderRadius-xl)",
      },
    },
  },
  defaultVariants: {
    hasActionsAppend: false,
  },
});

const Parent = styled("div", {
  base: {
    flexGrow: 1,
    flexShrink: 0,

    display: "flex",
    gap: "var(--gap-md)",
    padding: "var(--gap-sm) 0 var(--gap-md) 0",
    maxHeight: "var(--layout-height-message-box)",
  },
});

/**
 * Blocked message
 */
const Blocked = styled(Row, {
  base: {
    flexGrow: 1,
    fontSize: "14px",
    userSelect: "none",
    padding: "var(--gap-md)",
  },
});

/**
 * Specific-width icon container
 */
export const InlineIcon = styled("div", {
  base: {
    flexShrink: 0,
    display: "flex",
    alignItems: "end",
    justifyContent: "center",
  },
  variants: {
    size: {
      short: {
        width: "14px",
      },
      normal: {
        width: "42px",
      },
      wide: {
        width: "62px",
      },
    },
  },
});

/**
 * Message box
 */
export function MessageBox(props: Props) {
  // props.updateDraftSelection?.(
  //   event.currentTarget.selectionStart,
  //   event.currentTarget.selectionEnd,
  // );

  /**
   * Set initial draft selection
   */
  onMount(() =>
    props.updateDraftSelection?.(props.content.length, props.content.length),
  );

  return (
    <Parent>
      <Base hasActionsAppend={props.hasActionsAppend}>
        <Switch fallback={props.actionsStart}>
          <Match when={!props.sendingAllowed}>
            <InlineIcon size="wide">
              <Blocked>
                <BiRegularBlock size={24} />
              </Blocked>
            </InlineIcon>
          </Match>
        </Switch>
        <Switch
          fallback={
            <>
              <TextEditor2
                placeholder={props.placeholder}
                initialValue={props.initialValue}
                nodeReplacement={props.nodeReplacement}
                onChange={props.setContent}
                onComplete={props.onSendMessage}
                onTyping={props.onTyping}
                onPreviousContext={props.onEditLastMessage}
                autoCompleteSearchSpace={props.autoCompleteSearchSpace}
              />
              <Show when={props.sendingAllowed}>{props.actionsEnd}</Show>
            </>
          }
        >
          <Match when={!props.sendingAllowed}>
            <Blocked align>
              <Trans>
                You don't have permission to send messages in this channel.
              </Trans>
            </Blocked>
          </Match>
        </Switch>
      </Base>
      <Show when={props.sendingAllowed}>
        <AppendContainer>{props.actionsAppend}</AppendContainer>
      </Show>
    </Parent>
  );
}

MessageBox.InlineIcon = InlineIcon;

/**
 * Container for appended actions (e.g. send button), pinned to bottom.
 * Applies frosted acrylic glass to the button so it matches the message box.
 */
const AppendContainer = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-end",
    paddingBottom: "var(--gap-sm)",

    "& button": {
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      background:
        "color-mix(in srgb, var(--md-sys-color-primary) 60%, transparent)",
    },
  },
});
