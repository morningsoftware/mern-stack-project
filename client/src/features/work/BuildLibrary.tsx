import { useState } from "react";
import { Field } from "../../components/Forms";
import { BUILD_PLATFORMS } from "../../constants";
import type { BuildPlatform } from "../../constants";
import type { Build, PlaytestFeedback } from "../../types";

export interface BuildForm {
  version: string;
  platform: BuildPlatform;
  downloadUrl: string;
  releaseNotes: string;
}

const emptyForm: BuildForm = {
  version: "",
  platform: "windows",
  downloadUrl: "",
  releaseNotes: "",
};

export function BuildLibrary({
  builds,
  feedback,
  pending,
  onPublish,
  onUpdate,
  onFeedback,
}: {
  builds: Build[];
  feedback: PlaytestFeedback[];
  pending: boolean;
  onPublish: (body: BuildForm, reset: () => void) => void;
  onUpdate: (id: string, body: BuildForm, reset: () => void) => void;
  onFeedback: (buildId: string) => void;
}) {
  const [form, setForm] = useState<BuildForm>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const update = <K extends keyof BuildForm>(key: K, value: BuildForm[K]) =>
    setForm((old) => ({ ...old, [key]: value }));
  const reset = (): void => {
    setForm(emptyForm);
    setEditing(null);
  };
  return (
    <section className="build-library" aria-labelledby="builds-title">
      <div className="section-heading">
        <div>
          <h2 id="builds-title">Playable builds</h2>
          <p className="meta">
            Versioned links and release notes for your playtesters.
          </p>
        </div>
        <span className="count">{builds.length}</span>
      </div>
      <div className="build-layout">
        <div className="build-list">
          {builds.length === 0 && (
            <div className="empty-state">
              <h3>No builds published</h3>
              <p>
                Add a version and its download link when your game is ready to
                test.
              </p>
            </div>
          )}
          {builds.map((build) => (
            <article key={build._id} className="build-entry">
              <header>
                <h3>{build.version}</h3>
                <span className="badge">{build.platform}</span>
              </header>
              <p className="release-notes">
                {build.releaseNotes || "No release notes provided."}
              </p>
              <small className="meta">
                {feedback.filter((entry) => entry.buildId === build._id).length}{" "}
                feedback entries
              </small>
              <div className="build-actions">
                {safeLink(build.downloadUrl) ? (
                  <a
                    className="button-link"
                    href={build.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open build ↗
                  </a>
                ) : (
                  <span className="meta">Download link unavailable</span>
                )}
                <button
                  type="button"
                  className="secondary"
                  disabled={pending}
                  onClick={() => onFeedback(build._id)}
                >
                  Give feedback
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={pending}
                  onClick={() => {
                    setEditing(build._id);
                    setForm({
                      version: build.version,
                      platform: build.platform,
                      downloadUrl: build.downloadUrl,
                      releaseNotes: build.releaseNotes || "",
                    });
                  }}
                >
                  Edit build
                </button>
              </div>
            </article>
          ))}
        </div>
        <section className="panel">
          <h3>{editing ? "Edit build" : "Publish a build link"}</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (editing) onUpdate(editing, form, reset);
              else onPublish(form, reset);
            }}
          >
            <fieldset disabled={pending} className="stack">
              <Field label="Build version">
                <input
                  value={form.version}
                  onChange={(event) => update("version", event.target.value)}
                  placeholder="0.2.0 — prototype"
                  maxLength={80}
                  required
                />
              </Field>
              <Field label="Platform">
                <select
                  value={form.platform}
                  onChange={(event) =>
                    update("platform", event.target.value as BuildPlatform)
                  }
                >
                  {BUILD_PLATFORMS.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Download URL">
                <input
                  type="url"
                  pattern="https://.*"
                  value={form.downloadUrl}
                  onChange={(event) =>
                    update("downloadUrl", event.target.value)
                  }
                  placeholder="https://…"
                  required
                />
              </Field>
              <Field label="Release notes">
                <textarea
                  rows={5}
                  value={form.releaseNotes}
                  onChange={(event) =>
                    update("releaseNotes", event.target.value)
                  }
                />
              </Field>
              <button type="submit">
                {pending
                  ? "Saving…"
                  : editing
                    ? "Save build"
                    : "Publish build link"}
              </button>
              {editing && (
                <button type="button" className="secondary" onClick={reset}>
                  Cancel edit
                </button>
              )}
            </fieldset>
          </form>
        </section>
      </div>
    </section>
  );
}

function safeLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
