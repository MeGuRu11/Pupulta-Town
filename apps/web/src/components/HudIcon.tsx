const paths = {
  city: "M3 20V9l4-3 4 3v11M11 20V4h8v16M2 20h20M5.5 11.5h3M5.5 14.5h3M14 7h2m-2 4h2m-2 4h2",
  tasks: "M8 5H5v16h14V5h-3M9 3h6v4H9zM8 11l1 1 2-2m2 1h3m-8 5 1 1 2-2m2 1h3",
  events: "M4 4h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2zM17 8h4v10a2 2 0 0 1-2 2M7 8h7m-7 4h7m-7 4h4",
  members: "M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm-6 8v-2a6 6 0 0 1 12 0v2zm13-8a3.3 3.3 0 1 0-.5-6.5M18 14a5 5 0 0 1 3 4.6V20h-3",
  objects: "m3 8 9-5 9 5v9l-9 5-9-5zm0 0 9 5 9-5m-9 5v9M7.5 5.5l9 5",
  personal: "M3 4.5c3.2-1 6.2-.4 9 1.6 2.8-2 5.8-2.6 9-1.6v14c-3.2-1-6.2-.4-9 1.6-2.8-2-5.8-2.6-9-1.6zm9 1.6v14M6 9l3 1m6 0 3-1",
  add: "M12 4v16M4 12h16",
  account: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9v-1a8 6 0 0 1 16 0v1z",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9-5v5l3.5 2.5",
  check: "M3 12l6 6L21 6",
  home: "m2.5 11 9.5-8 9.5 8M5 10v10h14V10m-9 10v-6h4v6",
  close: "m6 6 12 12M18 6 6 18",
  compass: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-6-3-1.5 4.5L9 15l1.5-4.5z",
} as const;

export type HudIconName = keyof typeof paths;

export function HudIcon({ name }: { name: HudIconName }) {
  return <svg className={`hud-icon hud-icon-${name}`} aria-hidden="true" focusable="false"
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65"
    strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[name]} />
  </svg>;
}
