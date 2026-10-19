# Agent Guidelines

This file is the source of truth for how work is done in this repository. Every
contributor (human or AI) must follow it. When a rule here conflicts with a
local habit or another document, this file wins unless a maintainer explicitly
says otherwise.

- `AGENTS.md` (this file): workflow, Git conventions, and coding standards.
- [`DESIGN.md`](./DESIGN.md): the project's design specification and visual
  language.

## Project

MERN Stack Project (Group 9). The stack is MongoDB, Express, React, and Node.js.
See [`README.md`](./README.md) for setup instructions.

## Git Workflow

### `main` is protected

- **Never push directly to `main`.** This applies to everyone, including
  maintainers and agents. There are no exceptions for "small" or "urgent"
  changes.
- All changes reach `main` through a pull request (PR).
- Do not force-push, rewrite, or delete `main`.
- If you find yourself on `main` with uncommitted work, create a branch before
  committing:
  ```sh
  git switch -c <type>/<short-description>
  ```

### Branching

Create one branch per logical change, branched from an up-to-date `main`.

Branch naming: `<type>/<short-kebab-case-description>`, using the same `type`
values as commit messages.

```text
feat/user-authentication
fix/login-redirect-loop
docs/api-endpoint-reference
refactor/extract-auth-middleware
chore/upgrade-dependencies
```

- Keep branches short-lived and scoped to a single change.
- Optionally include an issue number when one exists: `feat/42-user-auth`.
- Rebase or merge `main` into your branch to stay current. Resolve conflicts on
  your branch, never on `main`.
- Delete the branch after its PR is merged.
- Force-pushing your own feature branch is acceptable when needed (prefer
  `git push --force-with-lease`). Never force-push a branch someone else is
  actively working on.

### Pull Requests

- Every PR must have a clear title and description explaining **what** changed
  and **why**.
- Use a Conventional Commit formatted PR title (see below), since it may become
  the squash-merge commit message.
- Keep PRs small and reviewable. Split unrelated work into separate PRs.
- A PR is ready to merge only when it builds, passes tests and linting, and has
  the required review approval.
- Do not merge your own PR without approval unless a maintainer explicitly
  authorizes it.
- Prefer **squash merging** so each PR produces one clean commit on `main`.
- Do not bypass CI, branch protection, or required reviews.

## Commit Messages

Commits follow the [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
specification. This enables readable history and automated changelogs.

### Format

```text
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

- `type` and `scope` are lowercase.
- The description follows a colon and a single space.
- Use the imperative, present tense ("add", not "added" or "adds").
- Do not capitalize the first letter or end the description with a period.
- Keep the subject line at or under 72 characters.
- Separate the subject from the body with one blank line; separate footers from
  the body with one blank line.

### Types

| Type       | Use for                                                        |
| ---------- | -------------------------------------------------------------- |
| `feat`     | A new user-facing feature                                      |
| `fix`      | A bug fix                                                      |
| `docs`     | Documentation only                                             |
| `style`    | Formatting/whitespace with no behavior change                  |
| `refactor` | Code restructuring with no behavior change                    |
| `perf`     | Performance improvement                                        |
| `test`     | Adding or fixing tests                                         |
| `build`    | Build system or dependency changes                             |
| `ci`       | CI/CD configuration changes                                    |
| `chore`    | Maintenance that does not fit the types above                  |
| `revert`   | Reverting a previous commit                                    |

### Scopes

Scopes are optional and name the affected area, such as `auth`, `api`, `ui`,
`db`, or `deps`. Keep them short and consistent.

### Breaking changes

Mark a breaking change with `!` after the type/scope **and** a
`BREAKING CHANGE:` footer describing the impact and migration path.

```text
feat(api)!: require authentication on all user routes

BREAKING CHANGE: unauthenticated requests now return 401. Clients must send a
bearer token.
```

### Examples

```text
feat(auth): add JWT refresh token rotation
fix(ui): prevent duplicate form submissions
docs(readme): document local database setup
refactor(api): extract validation into middleware
chore(deps): upgrade mongoose to 8.x
```

### Commit hygiene

- Make atomic commits: one logical change per commit.
- Do not commit commented-out code, secrets, credentials, `.env` files, build
  artifacts, or `node_modules`.
- Never commit directly on `main`.
- Reference issues in footers when applicable, e.g. `Refs: #42` or
  `Closes: #42`.

## Programming Best Practices

- **Read before writing.** Follow the existing structure, naming, and patterns
  of the codebase. Do not introduce a second way of doing something that
  already has a convention.
- **Keep changes focused.** Do not mix refactors, formatting, and behavior
  changes in one PR. Avoid unrelated drive-by edits.
- **Write readable code.** Prefer clear names over comments. Comment only
  non-obvious intent, trade-offs, or constraints.
- **Handle errors explicitly.** Validate inputs at boundaries, fail loudly and
  clearly, and never swallow errors silently.
- **Never leak secrets.** Use environment variables and keep credentials out of
  source control. Do not log sensitive data.
- **Test behavior.** Add or update tests for changed behavior. Bug fixes should
  include a regression test. Tests must be deterministic and independent.
- **Keep dependencies intentional.** Avoid adding a package for something the
  standard library or an existing dependency already handles.
- **Stay consistent across the stack.** Validate on the server even when the
  client validates; never trust client input.
- **Prefer small, composable functions and modules.** Avoid premature
  abstraction and avoid duplicating logic.
- **Leave things better.** If you touch code that is broken or unclear, fix it
  within the scope of your change. Do not expand scope silently.
- **Do not break the build.** Run the relevant build, lint, and test commands
  before opening a PR.
- **Update documentation.** If behavior, setup, or APIs change, update the
  relevant docs in the same PR.

## Design Specification

Visual and interaction decisions are documented in
[`DESIGN.md`](./DESIGN.md). That file is authoritative for anything
user-facing: color, typography, spacing, layout, components, iconography,
motion, and voice/tone.

- **Read `DESIGN.md` before any UI, styling, or user-facing copy work.**
  `AGENTS.md` is loaded automatically by agents; `DESIGN.md` is not, which is
  why this section exists. Treat reading it as a required first step.
- If `DESIGN.md` does not yet define something, do **not** silently invent a
  new design language. Use the closest existing pattern, keep the change
  minimal, and note the gap in the PR description.
- When a real design decision is made, record it in `DESIGN.md` (including the
  rationale) in the same PR that applies it. Design changes without a
  corresponding `DESIGN.md` update are incomplete.
- If a requested change conflicts with `DESIGN.md`, raise the conflict instead
  of unilaterally overriding the specification.

> `DESIGN.md` defines the
> structure and placeholders; fill them in as decisions are made.

## Agent Checklist

Before starting:

1. Confirm you are not on `main`; create a branch if needed.
2. Read the surrounding code and, for user-facing work, `DESIGN.md`.

Before opening a PR:

1. Run build, lint, and tests.
2. Review your diff for secrets, debug code, and unrelated changes.
3. Confirm commits and the PR title follow Conventional Commits.
4. Update `DESIGN.md` and other docs if the change requires it.
