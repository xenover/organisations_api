# Repository maintenance

## Reviewed dependency updates

`.github/dependabot.yml` checks npm, the Docker base image, and GitHub Actions
weekly after the configuration reaches the default branch. npm minor/patch
updates share a group; other npm majors are separate reviewable PRs. Version
update PR limits are three for npm, one for Docker, and three for Actions.
There is no automatic merge workflow. Security updates follow GitHub's separate
security-update settings and are not limited by these version-update PR limits.

Node support stays on major 24. Dependabot ignores major updates for `@types/node`
and the `node` image. When reviewing a Node 24 image update, synchronize `.nvmrc`
and both Docker `FROM` pins manually: Dependabot does not update `.nvmrc`.
Keep `package.json`'s Node engine and Node types consistent with that policy.
Review compatibility between TypeScript and typescript-eslint when updating them;
keep Actions pinned to commit SHAs with matching version comments.

Run the [existing CI checks](../README.md#continuous-integration), inspect the
lockfile and release notes, and address the high/critical audit result before
merging. For a Docker update, build and verify migration, readiness, persistence,
and stopping using the [local container workflow](operations.md#docker-setup).
Use the existing maintainer review process; neither an extra mandatory reviewer
nor a new merge/protection policy is required by this configuration.

## Local files and repository information

Git, Prettier, and Docker ignore custom SQLite databases and their journal/WAL
files, local logs, and the root `data/` directory. Build output and coverage stay
ignored. Git and Docker exclude local `.env` variants while preserving the
tracked `.env.example`. Store custom database files outside source directories.
The existing EditorConfig and Prettier settings already agree on two-space
indentation, LF, and final newlines; EditorConfig remains unchanged.

The README is the documentation entry point; Swagger is the API reference.
If filling in GitHub's optional About fields, a suitable description is
"Local Node.js 24 / TypeScript / Express API for organisation relationships with SQLite."
Useful topics are `nodejs`, `typescript`, `express`, `sqlite`, and `rest-api`.
Leave the website field empty unless an actual site exists. These optional
metadata changes do not require changing repository administration policies.

The [ISC license](../LICENSE) matches the license already declared in
`package.json`; the container includes the same notice. The original author and
2020 project date are retained. For vulnerability reporting, use the routes in
[SECURITY.md](../SECURITY.md).
