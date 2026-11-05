import { useUnsavedChanges } from "../navigation/UnsavedChanges.jsx";
import { useState } from "react";
import { api } from "../api.js";
import { ErrorNote, Field } from "../components/Forms.jsx";
import { GithubRepositoryField } from "../features/github/GithubRepositoryField.jsx";
import { useWorkspaceData } from "../hooks/useWorkspaceData.js";
import { MEMBER_ROLES } from "../constants.js";

export function TeamScreen({ team, onOpenProject, currentUserId }) {
  const { data, loading, error, pending, mutate } = useWorkspaceData([
    `/api/teams/${team._id}/members`,
    `/api/projects?teamId=${team._id}`,
    "/api/users",
  ]);
  const [members = [], projects = [], users = []] = data || [];
  const [memberForm, setMemberForm] = useState({
    userId: "",
    role: "developer",
  });
  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
    githubRepository: "",
  });
  useUnsavedChanges(
    Boolean(
      projectForm.name ||
      projectForm.description ||
      projectForm.githubRepository ||
      memberForm.userId ||
      memberForm.role !== "developer",
    ),
    pending,
  );
  const canManage =
    team.createdBy === currentUserId ||
    members.some(
      (member) => member.userId === currentUserId && member.role === "owner",
    );
  const availableUsers = users.filter(
    (user) => !members.some((member) => member.userId === user._id),
  );
  const selectedUserId = availableUsers.some(
    (user) => user._id === memberForm.userId,
  )
    ? memberForm.userId
    : availableUsers[0]?._id || "";
  const nameFor = (id) =>
    users.find((user) => user._id === id)?.displayName || id;

  async function addMember(event) {
    event.preventDefault();
    await mutate(
      `/api/teams/${team._id}/members`,
      { ...memberForm, userId: selectedUserId },
      () => setMemberForm({ userId: "", role: "developer" }),
    );
  }

  async function createProject(event) {
    event.preventDefault();
    const body = {
      name: projectForm.name,
      description: projectForm.description,
      teamId: team._id,
    };
    if (projectForm.githubRepository) {
      body.githubRepository = projectForm.githubRepository;
    }
    await mutate("/api/projects", body, () =>
      setProjectForm({ name: "", description: "", githubRepository: "" }),
    );
  }

  return (
    <div>
      <header className="top">
        <div>
          <p className="eyebrow">Team</p>
          <h1>{team.name}</h1>
          <p>{team.description || "No description"}</p>
        </div>
      </header>
      <ErrorNote error={error} />
      {loading && (
        <p role="status" className="loading">
          Loading team workspace…
        </p>
      )}
      <div className="grid">
        <section className="panel">
          <p className="eyebrow">People</p>
          <h2>Members</h2>
          <ul className="list">
            {members.map((member) => (
              <li key={member._id}>
                <span>{nameFor(member.userId)}</span>
                <span className="meta">{member.role}</span>
              </li>
            ))}
          </ul>
          {canManage ? (
            <form onSubmit={addMember}>
              <fieldset
                className="stack"
                disabled={loading || pending || !availableUsers.length}
              >
                <Field label="User">
                  <select
                    value={selectedUserId}
                    onChange={(event) =>
                      setMemberForm({
                        ...memberForm,
                        userId: event.target.value,
                      })
                    }
                  >
                    {availableUsers.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.displayName} ({user.username})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Member role">
                  <select
                    value={memberForm.role}
                    onChange={(event) =>
                      setMemberForm({ ...memberForm, role: event.target.value })
                    }
                  >
                    {MEMBER_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </Field>
                <button type="submit">
                  {pending ? "Saving…" : "Add member"}
                </button>
              </fieldset>
            </form>
          ) : (
            <p className="meta">Team owners manage membership.</p>
          )}
        </section>
        <section className="panel">
          <p className="eyebrow">Development</p>
          <h2>Projects</h2>
          {!loading && !error && projects.length === 0 ? (
            <p>Create a project to plan milestones and assign tasks.</p>
          ) : (
            <ul className="list">
              {projects.map((project) => (
                <li key={project._id}>
                  <span>
                    {project.name}{" "}
                    <span className="meta">
                      ({project.status}
                      {project.githubRepository
                        ? ` · ${project.githubRepository}`
                        : ""}
                      )
                    </span>
                  </span>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onOpenProject(project)}
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={createProject}>
            <fieldset className="stack" disabled={loading || pending}>
              <Field label="Project name">
                <input
                  value={projectForm.name}
                  onChange={(event) =>
                    setProjectForm({ ...projectForm, name: event.target.value })
                  }
                  required
                />
              </Field>
              <GithubRepositoryField
                value={projectForm.githubRepository}
                disabled={loading || pending}
                onChange={(githubRepository) =>
                  setProjectForm({ ...projectForm, githubRepository })
                }
              />
              <Field label="Project description">
                <textarea
                  value={projectForm.description}
                  onChange={(event) =>
                    setProjectForm({
                      ...projectForm,
                      description: event.target.value,
                    })
                  }
                />
              </Field>
              <button type="submit">
                {pending ? "Saving…" : "Create project"}
              </button>
            </fieldset>
          </form>
        </section>
      </div>
    </div>
  );
}
