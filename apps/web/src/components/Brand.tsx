export function TownMark() {
  return <svg aria-hidden="true" viewBox="0 0 40 40" fill="none">
    <path d="M5 18 15 10l10 8v17H5V18Z" fill="currentColor" />
    <path d="m23 9 7-5 7 5v26H23V9Z" fill="currentColor" opacity=".55" />
    <path d="M13 25h5v10h-5V25Z" fill="var(--paper)" />
    <path d="M28 13h4m-4 7h4m-4 7h4" stroke="var(--paper)" strokeWidth="3" />
  </svg>;
}

export function Brand() {
  return <a className="brand" href={window.location.pathname} aria-label="Пупульта Town — главная">
    <span className="brand-mark"><TownMark /></span>
    <h1>Пупульта <span>Town</span></h1>
  </a>;
}
