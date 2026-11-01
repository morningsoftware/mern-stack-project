export function ErrorNote({ error }) {
  if (!error) return null;
  return (
    <p className="error" role="alert">
      {error}
    </p>
  );
}

export function Field({ label, children }) {
  return (
    <label className="row">
      {label}
      {children}
    </label>
  );
}
