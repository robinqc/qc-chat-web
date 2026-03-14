import { styled } from "styled-system/jsx";

/**
 * Common styles for sidebar
 */
export const SidebarBase = styled("div", {
  base: {
    display: "flex",
    flexShrink: 0,
    flexDirection: "column",
    overflow: "hidden",
    borderTopLeftRadius: "var(--borderRadius-md)",
    // margin: "var(--gap-md) var(--gap-md) var(--gap-md) 0",
    width: "var(--layout-width-channel-sidebar)",

    fill: "var(--md-sys-color-on-surface)",
    color: "var(--md-sys-color-on-surface)",
    background: "var(--md-sys-color-surface-container-low)",
    borderLeft:
      "1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 50%, transparent)",
    borderTop:
      "1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 50%, transparent)",
    "& a": {
      textDecoration: "none",
    },
  },
});
