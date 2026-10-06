# Local logging and troubleshooting

The shared Pino logger writes newline-delimited JSON to stdout. Every server
record includes `level` (numeric), `time` (Unix milliseconds), `pid`, `hostname`
(the server host), and `msg`. No pretty-printing or external monitoring service
is required. Knex's migration CLI prints its own text before the container starts
the server; those lines are not Pino records.

`LOG_LEVEL` selects the minimum severity: trace 10, debug 20, info 30, warn 40,
error 50, fatal 60. `silent` disables output. Local development defaults to
debug, tests to silent, and the Docker image to info. At info you see completions
and errors; debug additionally shows request receipt.

| Message              | Level                       | Additional fields                                             |
| -------------------- | --------------------------- | ------------------------------------------------------------- |
| `Server started up`  | info                        | `port` (the actual listening port, including when `PORT=0`)   |
| `Request received`   | debug                       | `requestId`, `method`, `path`                                 |
| `Request completed`  | info                        | `requestId`, `method`, `path`, `statusCode`, `responseTimeMs` |
| `Request aborted`    | warn                        | `requestId`, `method`, `path`                                 |
| `Request failed`     | warn for 4xx, error for 5xx | `requestId`, `method`, `path`, `statusCode`, `code`, `err`    |
| `Shutdown started`   | info                        | `signal`, `timeoutMs`                                         |
| `Shutdown completed` | info                        | `signal`                                                      |
| `Shutdown timed out` | error                       | `signal`                                                      |
| `Shutdown failed`    | error                       | `signal`, `err`                                               |

The middleware generates a UUID and returns it as `X-Request-ID`. Incoming IDs
are not trusted or reused. Allowed CORS origins can read this response header.
The receipt, failure (if any), and completion share that UUID. A failed request
normally has both a failure record and a completion record with the HTTP status;
a disconnected response instead has an abort record without a completed record.
`responseTimeMs` measures elapsed time from middleware entry to response finish.

For example, make an invalid request and copy the response's `X-Request-ID`:

```sh
curl -i -H 'Content-Type: application/json' \
  --data '{"org_name":""}' http://localhost:3000/organisations
```

Capture local output with `npm start > /tmp/organisations.log 2>&1`. With optional
`jq` installed, inspect correlated records (replace the placeholder UUID):

```sh
jq -R --arg id 'copy-the-response-request-id' \
  'fromjson? | select(.requestId == $id)' /tmp/organisations.log
docker compose logs --no-log-prefix api | \
  jq -R 'fromjson? | select(.msg == "Shutdown completed")'
```

`fromjson?` skips npm/migration text. `docker compose logs -f api` is sufficient
without jq. Raise `LOG_LEVEL` to debug for request receipt; recreate the Compose
container after changing `.env.container`, or restart the local process after
changing `.env`.

Request records contain the path without query values. They omit bodies,
request headers (including Authorization), client IP addresses, and the full
environment/configuration. Expected body-parser errors are logged using the
same safe message as the client response: their original errors can contain raw
bodies and JSON excerpts in both messages and stacks. Unexpected failures retain
the original `err` diagnostics and stack for troubleshooting; clients receive
the safe generic error response. Runtime configuration/secret injection adds no
environment dump or secret field to these records.

If `/health` succeeds but `/ready` returns 503, check the mounted SQLite path,
directory permissions, and pending migrations. Readiness logs its 503 completion
without exposing SQL or database paths in the response. A shutdown timeout means
the request drain or database cleanup exceeded `SHUTDOWN_TIMEOUT_MS`; the process
forces connections closed and exits 1. A cleanup failure also exits 1. Successful
shutdown drains HTTP requests, closes Knex, logs completion, and exits naturally.

The logging review uses the existing correlation/abort tests, signal/drain/timeout
tests, and focused parser/runtime-output checks. It adds no metrics endpoint,
log aggregation service, or production monitoring dependency.
