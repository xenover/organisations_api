# Repository maintenance

## Reviewed dependency updates

This demonstration app is revisited roughly once a year. Routine Dependabot
version-update PRs are disabled for npm, the Docker base image, and GitHub Actions
by setting `open-pull-requests-limit: 0` in `.github/dependabot.yml`. The required
weekly schedules remain in the configuration but do not generate version-update
PRs with this limit.

Keep Dependabot alerts and Dependabot security updates enabled in the repository's
Settings > Advanced Security. Security-update PRs follow those separate settings
and are not disabled by the version-update PR limit. There is no automatic merge
workflow; review security fixes when they arrive.

When returning to the project, aim to review dependencies manually once a year:
check supported versions, release notes, and compatibility, then update packages,
the Docker base image, and GitHub Actions as needed.

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
