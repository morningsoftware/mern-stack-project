import type { Build, BugDraft } from "../../types";
import { Field } from "../../components/Forms";

export function emptyBugDraft(): BugDraft {
  return {
    title: "",
    description: "",
    severity: "medium",
    status: "open",
    buildId: "",
    reproductionSteps: "",
    expectedResult: "",
    actualResult: "",
    environment: "",
    sourceFeedbackId: "",
  };
}

interface BugDetailsValue {
  buildId?: string | null;
  environment?: string;
  reproductionSteps?: string;
  expectedResult?: string;
  actualResult?: string;
}

export function BugDetailsFields({
  value,
  builds,
  onChange,
}: {
  value: BugDetailsValue;
  builds: Build[];
  onChange: <K extends keyof BugDraft>(key: K, value: BugDraft[K]) => void;
}) {
  return (
    <>
      <Field label="Bug build">
        <select
          value={value.buildId || ""}
          onChange={(event) => onChange("buildId", event.target.value)}
        >
          <option value="">Not tied to a build</option>
          {value.buildId &&
            !builds.some((build) => build._id === value.buildId) && (
              <option value={value.buildId}>Previously linked build</option>
            )}
          {builds.map((build) => (
            <option key={build._id} value={build._id}>
              {build.version} · {build.platform}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Environment">
        <input
          value={value.environment || ""}
          onChange={(event) => onChange("environment", event.target.value)}
          placeholder="Windows 11, keyboard / macOS, controller…"
        />
      </Field>
      <Field label="Steps to reproduce">
        <textarea
          rows={4}
          value={value.reproductionSteps || ""}
          onChange={(event) =>
            onChange("reproductionSteps", event.target.value)
          }
          placeholder="1. Start a new game…"
        />
      </Field>
      <Field label="Expected result">
        <textarea
          rows={3}
          value={value.expectedResult || ""}
          onChange={(event) => onChange("expectedResult", event.target.value)}
        />
      </Field>
      <Field label="Actual result">
        <textarea
          rows={3}
          value={value.actualResult || ""}
          onChange={(event) => onChange("actualResult", event.target.value)}
        />
      </Field>
    </>
  );
}
