function formatToday() {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    weekday: "long"
  }).format(new Date());
}

export function AppSignature() {
  const today = formatToday();

  return (
    <footer className="app-signature">
      <span>
        Today is <time dateTime={new Date().toISOString().slice(0, 10)}>{today}</time>
      </span>
      <span aria-hidden="true">·</span>
      <strong>Cloud Storage Distributor</strong>
    </footer>
  );
}
