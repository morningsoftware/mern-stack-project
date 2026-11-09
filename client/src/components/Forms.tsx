import type { ReactNode } from "react";

export function ErrorNote({ error }: { error: string }) {
  if (!error) return null;
  return (
    <p className="error" role="alert">
      {error}
    </p>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="row">
      {label}
      {children}
    </label>
  );
}
