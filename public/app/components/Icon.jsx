const paths = {
  archive: (
    <>
      <path d="M4 7.2h16" />
      <path d="M5.4 4h13.2l1.3 3.2v12.2a.6.6 0 0 1-.6.6H4.7a.6.6 0 0 1-.6-.6V7.2L5.4 4Z" />
      <path d="M9.5 11h5" />
    </>
  ),
  azure: (
    <>
      <path d="m5 18 5.2-14h4.1L9.1 18H5Z" />
      <path d="m11.1 18 3.1-8.2L20 18h-8.9Z" />
    </>
  ),
  box: (
    <>
      <path d="m4.2 8 7.8-4 7.8 4-7.8 4-7.8-4Z" />
      <path d="m4.2 8 7.8 4v8l-7.8-4V8Z" />
      <path d="m19.8 8-7.8 4v8l7.8-4V8Z" />
    </>
  ),
  check: <path d="m5 12.5 4.2 4.2L19 7" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.2 2" />
    </>
  ),
  close: (
    <>
      <path d="m7 7 10 10" />
      <path d="M17 7 7 17" />
    </>
  ),
  document: (
    <>
      <path d="M7 3.5h6l4 4V20H7V3.5Z" />
      <path d="M13 3.5v4h4" />
      <path d="M9.5 12h5M9.5 15h5" />
    </>
  ),
  folder: (
    <path d="M3.5 6.5h6l1.8 2H20a1 1 0 0 1 1 1v8.2a1.3 1.3 0 0 1-1.3 1.3H4.3A1.3 1.3 0 0 1 3 17.7V7.5a1 1 0 0 1 .5-1Z" />
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m4.5 17 4.3-4.3 3.1 3.1 2.3-2.3 5.3 5.3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8.5 10V7.5a3.5 3.5 0 1 1 7 0V10" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4 4" />
    </>
  ),
  send: (
    <>
      <path d="m3.5 11.5 16-7-5.8 15-2.6-6.1-7.6-1.9Z" />
      <path d="m11.1 13.4 8.4-8.9" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.2 19 6v5.3c0 4.2-2.8 7.8-7 9.5-4.2-1.7-7-5.3-7-9.5V6l7-2.8Z" />
      <path d="m8.8 12 2.2 2.2 4.4-4.5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V5" />
      <path d="m7.5 9.5 4.5-4.5 4.5 4.5" />
      <path d="M5 14.5v4.2A1.3 1.3 0 0 0 6.3 20h11.4a1.3 1.3 0 0 0 1.3-1.3v-4.2" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4 21 20H3L12 4Z" />
      <path d="M12 9v5M12 17.2v.1" />
    </>
  )
};

export function Icon({ name, size = 20, strokeWidth = 1.8, ...props }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
