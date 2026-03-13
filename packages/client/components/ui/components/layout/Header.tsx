import { styled } from "styled-system/jsx";

export interface Props {
  readonly topBorder?: boolean;
  readonly bottomBorder?: boolean;
}

/**
 * Header component
 */
export const Header = styled("div", {
  base: {
    gap: "10px",
    flex: "0 auto",
    display: "flex",
    flexShrink: 0,
    paddingTop: "0",
    paddingBottom: "0",
    paddingLeft: "10px",
    alignItems: "center",
    fontWeight: 600,
    userSelect: "none",
    overflow: "hidden",
    height: "48px",

    color: "var(--md-sys-color-on-surface)",
    fill: "var(--md-sys-color-on-surface)",
    backgroundSize: "cover !important",
    backgroundPosition: "center !important",
    "& svg": {
      flexShrink: 0,
    },
  },
  variants: {
    image: {
      true: {
        color: "white",
        fill: "white",

        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        alignItems: "flex-end",
        justifyContent: "stretch",
        textShadow: "0px 0px 1px var(--md-sys-color-shadow)",
        height: "120px",

        "& > div": {
          flexGrow: 1,
          padding: "6px 14px",
          background:
            "var(--server-banner-gradient, linear-gradient(0deg, black, transparent))",
        },
      },
      false: {},
    },
    transparent: {
      true: {
        width: "calc(100% - var(--gap-md))",
        zIndex: "10",
      },
      false: {},
    },
    bottomBorder: {
      true: {
        borderBottom:
          "1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 50%, transparent)",
      },
      false: {},
    },
    topBorder: {
      true: {
        borderTop:
          "1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 50%, transparent)",
      },
      false: {},
    },
  },
  defaultVariants: {
    image: false,
    transparent: false,
  },
});

/**
 * Position an element below a floating header
 *
 * Ensure you place a div inside to make the positioning work
 */
export const BelowFloatingHeader = styled("div", {
  base: {
    position: "relative",
    zIndex: "10",

    // i guess this works, probably refactor this later
    "& > div > div": {
      width: "100%",
      position: "absolute",
      top: "var(--gap-md)",
    },
  },
});
