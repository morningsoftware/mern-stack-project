import { useUnsavedChanges } from "../navigation/UnsavedChanges.jsx";
import { useState } from "react";
import { ErrorNote, Field } from "../components/Forms.jsx";
import { useWorkspaceData } from "../hooks/useWorkspaceData.js";

export function TeamsScreen({ onOpenTeam }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data, loading, error, pending, mutate } = useWorkspaceData([
    "/api/teams",
  ]);
  const teams = data?.[0] || [];
  useUnsavedChanges(Boolean(name || description), pending);

  async function createTeam(event) {
    event.preventDefault();
    await mutate("/api/teams", { name, description }, () => {
      setName("");
      setDescription("");
    });
  }

  return (
    <div>
      <header className="top">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Teams</h1>
          <p className="meta">Choose a studio or start a new team.</p>
        </div>
      </header>
      <ErrorNote error={error} />
      {loading && (
        <p role="status" className="loading">
          Loading teams…
        </p>
      )}
      <div className="team-layout" hidden={loading}>
        <section className="panel create-panel">
          <p className="eyebrow">New studio</p>
          <h2>Create a team</h2>
          <form onSubmit={createTeam}>
            <fieldset className="stack" disabled={loading || pending}>
              <Field label="Name">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>
              <button type="submit">
                {pending ? "Creating team…" : "Create team"}
              </button>
            </fieldset>
          </form>
        </section>
        <section className="panel teams-list">
          <h2>Development teams</h2>
          {!loading && !error && teams.length === 0 ? (
            <p>Create a team to start planning your first game.</p>
          ) : (
            <ul className="list">
              {teams.map((team) => (
                <li key={team._id}>
                  <span>
                    <strong>{team.name}</strong>
                    <span className="meta">
                      {" "}
                      — {team.description || "No description"}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onOpenTeam(team)}
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
