---
title: Isomorphic logger + flush
type: pattern
status: accepted
tags: [logging, logger, axiom, serverless, flush, vercel]
---
Server and client both log through the shared isomorphic `logger` from `$lib/logger` — never `console.log` (binding — [the-rules](../project/the-rules.md)). Levels are `debug` (suppressed in production), `info`, `warn`, `error`; `error(msg, data, err)` extracts an `Error`'s message (plus stack in dev). Use `logger.child({ module })` for modules that emit many entries. In the browser it styles console output; on the server it emits structured JSON and ships to Axiom via a registered transport. Server endpoints MUST `await logger.flush()` before returning.

**Why:** Vercel serverless functions freeze the instant the handler returns, dropping any buffered logs — `flush()` forces the Axiom transport to send first. One isomorphic logger means identical call sites work on both sides with environment-appropriate output (styled console in dev/browser, JSON for log aggregation in prod).
