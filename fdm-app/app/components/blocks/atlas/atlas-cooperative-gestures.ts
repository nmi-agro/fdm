/**
 * Settings for small maps that sit inside a scrolling page: scrolling the page over the map does
 * not zoom it; the map zooms with Ctrl (or Cmd) and scroll, and pans with two fingers on touch
 * screens. Spread these props on an `Atlas`.
 */
export const COOPERATIVE_GESTURES_PROPS = {
  cooperativeGestures: true,
  locale: {
    "CooperativeGesturesHandler.WindowsHelpText": "Gebruik Ctrl + scrollen om in te zoomen",
    "CooperativeGesturesHandler.MacHelpText": "Gebruik ⌘ + scrollen om in te zoomen",
    "CooperativeGesturesHandler.MobileHelpText": "Gebruik twee vingers om de kaart te verplaatsen",
  },
} as const
