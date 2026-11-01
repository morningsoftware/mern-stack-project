import { useEffect, useRef, useState } from "react";
import { api, screenshotBlob } from "../../api.js";
import { Field, ErrorNote } from "../../components/Forms.jsx";
import { useUnsavedChanges } from "../../navigation/UnsavedChanges.jsx";

function ScreenshotImage({ path }) {
  const [src, setSrc] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let url;
    screenshotBlob(path, controller.signal)
      .then((blob) => {
        if (!controller.signal.aborted) {
          url = URL.createObjectURL(blob);
          setSrc(url);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  return error ? (
    <p role="alert">{error}</p>
  ) : src ? (
    <a href={src} target="_blank" rel="noopener noreferrer">
      <img
        src={src}
        alt="Attached bug screenshot; open to inspect full size"
        loading="lazy"
      />
    </a>
  ) : (
    <p role="status">Loading screenshot…</p>
  );
}
export function BugScreenshots({
  bugId,
  disabled,
  onBusyChange,
  onDraftChange,
}) {
  const [images, setImages] = useState(null),
    [file, setFile] = useState(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [attempt, setAttempt] = useState(0);
  const input = useRef(null),
    lock = useRef(false);
  const path = `/api/bug-reports/${bugId}/screenshots`;
  useUnsavedChanges(Boolean(file), pending);
  useEffect(() => {
    onDraftChange(Boolean(file));
  }, [file, onDraftChange]);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    api(path, { signal: controller.signal })
      .then((rows) => {
        if (!controller.signal.aborted) setImages(rows);
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err.status === 403
              ? "Screenshots are available to the reporter and team members."
              : err.message,
          );
      });
    return () => controller.abort();
  }, [path, attempt]);
  async function run(action) {
    if (lock.current || disabled) return;
    lock.current = true;
    setPending(true);
    onBusyChange(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      lock.current = false;
      setPending(false);
      onBusyChange(false);
    }
  }
  return (
    <section className="task-discussion" aria-labelledby="screenshots-title">
      <h3 id="screenshots-title">Screenshots</h3>
      <p className="meta">
        Up to three images, 2 MB each. PNG, JPEG, or WebP. Visible to the
        reporter and team.
      </p>
      <ErrorNote error={error} />
      {images === null ? (
        <button
          type="button"
          className="secondary"
          onClick={() => setAttempt((old) => old + 1)}
        >
          Retry screenshots
        </button>
      ) : (
        <>
          <ul className="screenshot-list">
            {images.map((image) => (
              <li key={image._id}>
                <ScreenshotImage path={`${path}/${image._id}`} />
                <button
                  type="button"
                  className="text-button"
                  disabled={pending || disabled}
                  onClick={() => {
                    if (window.confirm("Remove this screenshot?"))
                      run(async () => {
                        await api(`${path}/${image._id}`, { method: "DELETE" });
                        setImages((old) =>
                          old.filter((item) => item._id !== image._id),
                        );
                      });
                  }}
                >
                  Remove screenshot
                </button>
              </li>
            ))}
          </ul>
          {!images.length && <p className="meta">No screenshots attached.</p>}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!file) return;
              run(async () => {
                const image = await api(path, {
                  method: "POST",
                  headers: { "Content-Type": file.type },
                  body: file,
                });
                setImages((old) => [...old, image]);
                setFile(null);
                input.current.value = "";
              });
            }}
          >
            <fieldset
              className="stack"
              disabled={disabled || pending || images.length >= 3}
            >
              <Field label="Bug screenshot">
                <input
                  ref={input}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const candidate = event.target.files[0];
                    if (
                      candidate &&
                      (!["image/png", "image/jpeg", "image/webp"].includes(
                        candidate.type,
                      ) ||
                        candidate.size > 2 * 1024 * 1024)
                    ) {
                      setError("Choose a PNG, JPEG, or WebP image up to 2 MB.");
                      event.target.value = "";
                      setFile(null);
                    } else {
                      setError("");
                      setFile(candidate || null);
                    }
                  }}
                />
              </Field>
              <button type="submit" disabled={!file}>
                {pending ? "Uploading…" : "Attach screenshot"}
              </button>
            </fieldset>
          </form>
        </>
      )}
    </section>
  );
}
