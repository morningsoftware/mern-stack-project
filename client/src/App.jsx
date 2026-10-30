import { useEffect, useState } from "react";
import { api, getToken, setToken } from "./api.js";

const USER_ROLES = ["developer", "artist", "playtester"];
const MEMBER_ROLES = ["owner", "developer", "artist"];
const PROJECT_STATUSES = ["active", "completed", "archived"];
const MILESTONE_STATUSES = ["todo", "in_progress", "completed"];
const TASK_STATUSES = ["todo", "in_progress", "done"];
const PRIORITIES = ["low", "medium", "high"];
const BUG_SEVERITIES = ["low", "medium", "high"];
const BUG_STATUSES = ["open", "in_progress", "resolved"];

function ErrorNote({ error }) {
  if (!error) return null;
  return (
    <p className="error" role="alert">
      {error}
    </p>
  );
}

function Field({ label, children }) {
  return (
    <label className="row">
      {label}
      {children}
    </label>
  );
}

function AuthScreen({ onReady }) {
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    email: "",
    displayName: "",
    role: "developer",
    password: "",
  });

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { username: form.username, password: form.password }
          : form;
      const result = await api(path, { method: "POST", body: JSON.stringify(body) });
      setToken(result.token);
      onReady(result.user);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="wrap">
      <h1>MERN Stack Project</h1>
      <p>Sign in to manage teams, projects, tasks, bugs, and playtest feedback.</p>
      <div className="panel">
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button type="button" className={mode === "login" ? "" : "secondary"} onClick={() => setMode("login")}>
            Sign in
          </button>
          <button type="button" className={mode === "register" ? "" : "secondary"} onClick={() => setMode("register")}>
            Create account
          </button>
        </div>
        <ErrorNote error={error} />
        <form className="stack" onSubmit={submit}>
          <Field label="Username">
            <input name="username" value={form.username} onChange={update} autoComplete="username" required />
          </Field>
          {mode === "register" && (
            <>
              <Field label="Email">
                <input name="email" type="email" value={form.email} onChange={update} autoComplete="email" required />
              </Field>
              <Field label="Display name">
                <input name="displayName" value={form.displayName} onChange={update} required />
              </Field>
              <Field label="Role">
                <select name="role" value={form.role} onChange={update}>
                  {USER_ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <Field label="Password">
            <input name="password" type="password" value={form.password} onChange={update} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
          </Field>
          <button type="submit">{mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
      </div>
    </main>
  );
}

function TeamsScreen({ user, onOpenTeam, onSignOut }) {
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function load() {
    setTeams(await api("/api/teams"));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function createTeam(event) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/teams", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      });
      setName("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <h1>Teams</h1>
          <p className="meta">Signed in as {user.displayName} ({user.role})</p>
        </div>
        <button type="button" className="secondary" onClick={onSignOut}>Sign out</button>
      </header>
      <ErrorNote error={error} />
      <section className="panel">
        <h2>Create a team</h2>
        <form className="stack" onSubmit={createTeam}>
          <Field label="Name">
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          <button type="submit">Create team</button>
        </form>
      </section>
      <section className="panel">
        <h2>Your studio</h2>
        {teams.length === 0 ? <p>No teams yet.</p> : (
          <ul className="list">
            {teams.map((team) => (
              <li key={team._id}>
                <span>
                  <strong>{team.name}</strong>
                  <span className="meta"> — {team.description || "No description"}</span>
                </span>
                <button type="button" className="secondary" onClick={() => onOpenTeam(team)}>Open</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function TeamScreen({ team, onBack, onOpenProject }) {
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [memberForm, setMemberForm] = useState({ userId: "", role: "developer" });
  const [projectForm, setProjectForm] = useState({ name: "", description: "" });

  async function load() {
    const [nextMembers, nextProjects, nextUsers] = await Promise.all([
      api(`/api/teams/${team._id}/members`),
      api(`/api/projects?teamId=${team._id}`),
      api("/api/users"),
    ]);
    setMembers(nextMembers);
    setProjects(nextProjects);
    setUsers(nextUsers);
    if (!memberForm.userId && nextUsers[0]) {
      setMemberForm((current) => ({ ...current, userId: nextUsers[0]._id }));
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [team._id]);

  const nameFor = (id) => users.find((user) => user._id === id)?.displayName || id;

  async function addMember(event) {
    event.preventDefault();
    setError("");
    try {
      await api(`/api/teams/${team._id}/members`, {
        method: "POST",
        body: JSON.stringify(memberForm),
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createProject(event) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/projects", {
        method: "POST",
        body: JSON.stringify({ ...projectForm, teamId: team._id }),
      });
      setProjectForm({ name: "", description: "" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <button type="button" className="secondary" onClick={onBack}>Back to teams</button>
          <h1>{team.name}</h1>
          <p>{team.description || "No description"}</p>
        </div>
      </header>
      <ErrorNote error={error} />
      <div className="grid">
        <section className="panel">
          <h2>Members</h2>
          <ul className="list">
            {members.map((member) => (
              <li key={member._id}>
                <span>{nameFor(member.userId)}</span>
                <span className="meta">{member.role}</span>
              </li>
            ))}
          </ul>
          <form className="stack" onSubmit={addMember}>
            <Field label="User">
              <select value={memberForm.userId} onChange={(event) => setMemberForm({ ...memberForm, userId: event.target.value })}>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>{user.displayName} ({user.username})</option>
                ))}
              </select>
            </Field>
            <Field label="Member role">
              <select value={memberForm.role} onChange={(event) => setMemberForm({ ...memberForm, role: event.target.value })}>
                {MEMBER_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </Field>
            <button type="submit">Add member</button>
          </form>
        </section>
        <section className="panel">
          <h2>Projects</h2>
          {projects.length === 0 ? <p>No projects yet.</p> : (
            <ul className="list">
              {projects.map((project) => (
                <li key={project._id}>
                  <span>{project.name} <span className="meta">({project.status})</span></span>
                  <button type="button" className="secondary" onClick={() => onOpenProject(project)}>Open</button>
                </li>
              ))}
            </ul>
          )}
          <form className="stack" onSubmit={createProject}>
            <Field label="Project name">
              <input value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} required />
            </Field>
            <Field label="Project description">
              <textarea value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} />
            </Field>
            <button type="submit">Create project</button>
          </form>
        </section>
      </div>
    </main>
  );
}

function ProjectScreen({ project, onBack }) {
  const [users, setUsers] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [bugs, setBugs] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [error, setError] = useState("");
  const [milestone, setMilestone] = useState({ name: "", description: "", dueDate: "", status: "todo" });
  const [task, setTask] = useState({ title: "", description: "", milestoneId: "", assigneeId: "", status: "todo", priority: "medium" });
  const [bug, setBug] = useState({ title: "", description: "", severity: "medium", status: "open" });
  const [note, setNote] = useState({ rating: "4", comments: "" });

  async function load() {
    const [nextUsers, nextMilestones, nextTasks, nextBugs, nextFeedback] = await Promise.all([
      api("/api/users"),
      api(`/api/milestones?projectId=${project._id}`),
      api(`/api/tasks?projectId=${project._id}`),
      api(`/api/bug-reports?projectId=${project._id}`),
      api(`/api/playtest-feedback?projectId=${project._id}`),
    ]);
    setUsers(nextUsers);
    setMilestones(nextMilestones);
    setTasks(nextTasks);
    setBugs(nextBugs);
    setFeedback(nextFeedback);
    setTask((current) => ({
      ...current,
      milestoneId: current.milestoneId || nextMilestones[0]?._id || "",
      assigneeId: current.assigneeId || nextUsers[0]?._id || "",
    }));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [project._id]);

  const nameFor = (id) => users.find((user) => user._id === id)?.displayName || "Unknown user";

  async function submit(path, body, reset) {
    setError("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      reset();
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function patch(path, body) {
    setError("");
    try {
      await api(path, { method: "PATCH", body: JSON.stringify(body) });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <button type="button" className="secondary" onClick={onBack}>Back to team</button>
          <h1>{project.name}</h1>
          <p>{project.description || "No description"} <span className="meta">Status: {project.status}</span></p>
        </div>
        <Field label="Project status">
          <select value={project.status} onChange={(event) => patch(`/api/projects/${project._id}`, { status: event.target.value }).then(() => { project.status = event.target.value; })}>
            {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </Field>
      </header>
      <ErrorNote error={error} />
      <div className="grid">
        <section className="panel">
          <h2>Milestones</h2>
          <ul className="list">
            {milestones.map((item) => (
              <li key={item._id}>
                <span>{item.name}</span>
                <select aria-label={`Status for ${item.name}`} value={item.status} onChange={(event) => patch(`/api/milestones/${item._id}`, { status: event.target.value })}>
                  {MILESTONE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </li>
            ))}
          </ul>
          {milestones.length === 0 && <p>No milestones yet.</p>}
          <form className="stack" onSubmit={(event) => {
            event.preventDefault();
            submit("/api/milestones", { ...milestone, projectId: project._id, dueDate: milestone.dueDate || null }, () => setMilestone({ name: "", description: "", dueDate: "", status: "todo" }));
          }}>
            <Field label="Milestone name"><input value={milestone.name} onChange={(event) => setMilestone({ ...milestone, name: event.target.value })} required /></Field>
            <Field label="Due date"><input type="date" value={milestone.dueDate} onChange={(event) => setMilestone({ ...milestone, dueDate: event.target.value })} /></Field>
            <button type="submit">Add milestone</button>
          </form>
        </section>
        <section className="panel">
          <h2>Tasks</h2>
          <ul className="list">
            {tasks.map((item) => (
              <li key={item._id}>
                <span>{item.title} <span className="meta">{item.priority}, {nameFor(item.assigneeId)}</span></span>
                <select aria-label={`Status for ${item.title}`} value={item.status} onChange={(event) => patch(`/api/tasks/${item._id}`, { status: event.target.value })}>
                  {TASK_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </li>
            ))}
          </ul>
          {tasks.length === 0 && <p>No tasks yet.</p>}
          <form className="stack" onSubmit={(event) => {
            event.preventDefault();
            submit("/api/tasks", { ...task, projectId: project._id }, () => setTask({ ...task, title: "", description: "" }));
          }}>
            <Field label="Task title"><input value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })} required /></Field>
            <Field label="Milestone">
              <select value={task.milestoneId} onChange={(event) => setTask({ ...task, milestoneId: event.target.value })} required>
                <option value="">Select a milestone</option>
                {milestones.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="Assignee">
              <select value={task.assigneeId} onChange={(event) => setTask({ ...task, assigneeId: event.target.value })} required>
                {users.map((user) => <option key={user._id} value={user._id}>{user.displayName}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select value={task.priority} onChange={(event) => setTask({ ...task, priority: event.target.value })}>
                {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </Field>
            <button type="submit">Add task</button>
          </form>
        </section>
        <section className="panel">
          <h2>Bug reports</h2>
          <ul className="list">
            {bugs.map((item) => (
              <li key={item._id}>
                <span>{item.title} <span className="meta">{item.severity}</span></span>
                <select aria-label={`Status for ${item.title}`} value={item.status} onChange={(event) => patch(`/api/bug-reports/${item._id}`, { status: event.target.value })}>
                  {BUG_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </li>
            ))}
          </ul>
          {bugs.length === 0 && <p>No bug reports yet.</p>}
          <form className="stack" onSubmit={(event) => {
            event.preventDefault();
            submit("/api/bug-reports", { ...bug, projectId: project._id }, () => setBug({ title: "", description: "", severity: "medium", status: "open" }));
          }}>
            <Field label="Bug title"><input value={bug.title} onChange={(event) => setBug({ ...bug, title: event.target.value })} required /></Field>
            <Field label="Description"><textarea value={bug.description} onChange={(event) => setBug({ ...bug, description: event.target.value })} /></Field>
            <Field label="Severity">
              <select value={bug.severity} onChange={(event) => setBug({ ...bug, severity: event.target.value })}>
                {BUG_SEVERITIES.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
              </select>
            </Field>
            <button type="submit">Report bug</button>
          </form>
        </section>
        <section className="panel">
          <h2>Playtest feedback</h2>
          <ul className="list">
            {feedback.map((item) => (
              <li key={item._id}>
                <span>{nameFor(item.userId)}: {item.comments || "No comments"}</span>
                <span className="meta">Rating {item.rating} of 5</span>
              </li>
            ))}
          </ul>
          {feedback.length === 0 && <p>No feedback yet.</p>}
          <form className="stack" onSubmit={(event) => {
            event.preventDefault();
            submit("/api/playtest-feedback", { projectId: project._id, rating: Number(note.rating), comments: note.comments }, () => setNote({ rating: "4", comments: "" }));
          }}>
            <Field label="Rating">
              <select value={note.rating} onChange={(event) => setNote({ ...note, rating: event.target.value })}>
                {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
              </select>
            </Field>
            <Field label="Comments"><textarea value={note.comments} onChange={(event) => setNote({ ...note, comments: event.target.value })} /></Field>
            <button type="submit">Add feedback</button>
          </form>
        </section>
      </div>
    </main>
  );
}

export function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [team, setTeam] = useState(null);
  const [project, setProject] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setReady(true);
      return;
    }
    api("/api/auth/me")
      .then((result) => setUser(result.user))
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  if (!ready) return <main className="wrap"><p>Loading…</p></main>;
  if (!user) return <AuthScreen onReady={setUser} />;
  if (project) {
    return (
      <ProjectScreen
        project={project}
        onBack={() => setProject(null)}
      />
    );
  }
  if (team) {
    return (
      <TeamScreen
        team={team}
        onBack={() => setTeam(null)}
        onOpenProject={setProject}
      />
    );
  }
  return (
    <TeamsScreen
      user={user}
      onOpenTeam={setTeam}
      onSignOut={() => {
        setToken(null);
        setUser(null);
        setTeam(null);
        setProject(null);
      }}
    />
  );
}
