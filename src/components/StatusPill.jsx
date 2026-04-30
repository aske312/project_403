export default function StatusPill({ state, label }) {
  return (
    <span className={`service-pill ${state}`}>
      <span aria-hidden="true" />
      {label}
    </span>
  );
}
