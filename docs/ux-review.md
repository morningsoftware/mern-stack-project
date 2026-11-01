# Checkpoint UX review

This review is based on the components, CSS, and automated DOM interactions.
It does not claim a visual browser audit, device testing, or a Lighthouse score.

## Improvements in this change

| Finding                                             | Change                                                                  | Benefit                                           |
| --------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------- |
| Task creation is below the full board               | New task action in the board header opens and focuses the existing form | Easier to find without scanning past work         |
| Task creation has no description field              | Added description using the existing API contract                       | Avoids opening details immediately after creation |
| Successful mutations have little confirmation       | Added live save/create confirmation                                     | Confirms the request completed                    |
| A refresh failure can look like a failed save       | Show that the write succeeded and the workspace needs a reload          | Reduces accidental duplicate submissions          |
| Task decisions are separated from task context      | Discussion inside task details                                          | Keeps notes beside the work they concern          |
| Long detail forms require scrolling back to actions | Sticky save/cancel row within the edit form                             | Keeps editing controls easier to reach            |

The current paper/forest/rust system remains appropriate for the indie studio
workspace. Consistent density, useful empty states, visible action labels, and
real task content will improve its character more than additional decoration.

## Recommended next passes

1. **Creation flow:** task creation requires a milestone. Offer a direct route to
   creating the first milestone rather than leaving a required empty selector.
2. **People selection:** old task endpoints accept any existing user. Coordinate
   team-only assignment and authorization with the API developer before narrowing
   the UI; filtering the client alone would not enforce membership.
3. **Navigation:** add project/view URLs so refresh and browser Back preserve
   location and teammates can share work links. This is a separate routing change.
4. **Forms:** add consistent unsaved-edit protection across all drawers, project
   navigation, and sign-out. Current failed saves retain drafts; closing a drawer
   still discards its unsaved fields and comment text.
5. **Mobile:** design the separate mobile application around My work, Report bug,
   and Review feedback. The responsive web dashboard remains the full workspace.
6. **Visual acceptance:** inspect 390px, 768px, and 1440px widths in a real browser;
   verify keyboard focus, native modal behavior, long content, and Lighthouse
   performance/accessibility targets. These checks are pending.

Uploads/screenshots, notifications, and activity history still need separate
product and API decisions. Task discussion comments are not an audit log and
should not be labeled as one.
