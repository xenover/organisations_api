# Contributing

Use the Node 24 version in `.nvmrc`, install with `npm ci`, and follow the
[README setup](README.md#quick-start). Keep changes focused on the linked issue.
The original business API is recursive POST plus name/page GET; documentation or
maintenance work should preserve those contracts and SQLite behavior.

## Development checks

Before opening or updating a PR:

```sh
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run test:coverage
npm audit --audit-level=high
```

Use `npm run format` and `npm run lint:fix` when automatic fixes are appropriate.
The tests use temporary databases and close their own resources; do not point
them at development data or add `--exit` to hide open handles. For a behavior
change, verify its observable result and relevant failure paths. For docs/config
changes, check the commands, links, and configuration they describe.
`npm run test:watch` and `npm run test:debug` are documented in the
[command guide](README.md#commands-and-verification).

Local hooks run lint-staged on staged files; they do not replace the full CI
checks. Formatting uses two spaces, LF, double quotes, semicolons, and trailing
commas. TypeScript uses strict NodeNext resolution; local imports name the `.js`
extension so emitted files run directly in Node. Preserve the historical
migration filename and existing migration records.

## Review and merge

Implement each modernization issue in its own branch and PR, link its issue, and
explain the behavior change and validation. The maintainer reviews, requests fixes
or approves, and merges before work moves to the next approved issue/phase.
Whole phases may use a stack with one issue per PR. Each child targets the branch
below it so its diff contains only that layer.

Use [GitHub's native stack workflow](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-stacked-pull-requests)
and verify the stack map appears. Branch dependencies alone do not register a
native stack. Existing PR chains can be linked using GitHub's recommendation
banner. Review from the bottom upward; GitHub rebases/retargets remaining layers
when a lower native stack layer merges. When changing a parent layer, update its
descendants and recheck their diffs and CI before asking for another review.

Merge with the existing repository workflow after `Quality checks (Node 24)`
passes and review comments are addressed. A sole maintainer may review and merge
their own PRs; an additional mandatory reviewer is not required. Do not merge
dependency updates automatically or change repository merge/protection settings
as part of an unrelated change. The stack's next phase starts only when requested.

## Documentation

Keep the README as the entry point and Swagger as the detailed API reference.
Update route comments/OpenAPI schemas when an approved endpoint contract changes.
[Architecture](docs/architecture.md), [operations](docs/operations.md), and
[logging](docs/logging.md) describe the implementation without a parallel API
catalogue. Use harmless request examples and keep environment files, database
contents, and real secret values out of commits and review comments.
