---
title: AI connections and list proposals
type: mechanism
status: accepted
tags: [ai, mcp, oauth, proposals, groups]
---

## Connect and review

List exposes one remote MCP endpoint at `/mcp`. Add it in a chat app as an OAuth connector and authorize the requested access in List. An existing List browser session can approve immediately. If List asks you to sign in, open the email in the same browser to resume. The connection is scoped to your List account and uses your current membership, including shared lists. Open **Settings → AI connections** to disconnect. Pending proposals remain reviewable afterward.

On a list, one proposal card contains the proposed additions grouped using the list’s current group names. The empty group is displayed as **GENERAL**. Accepting a card inserts its items through normal sync. Rejecting it leaves the list unchanged. If a group used by a proposal has since disappeared, select an existing group or GENERAL for the affected items. Proposals expire after seven days. The list refreshes open proposals every 15 seconds while online.

## Tool contract

| Tool | Scope | Result |
| --- | --- | --- |
| `list_my_lists` | `lists:read` | Member lists as ID and name, with `nextCursor` when there is another page. |
| `get_list_context` | `lists:read` | List name, current group names and up to 100 items, including checked items. Pass `nextCursor` until it is null. |
| `propose_items` | `proposals:create` | A proposal ID, item count, status and expiry. Up to 50 additions per call and 100 pending proposals per list. |

Agents should resolve an ambiguous list name, read all relevant context pages, skip open duplicates unless asked for more, and reuse group names exactly. If placement is unclear, ask where the items belong. For GENERAL pass an empty string. An unknown group returns `GROUP_NOT_FOUND` with the valid options. A stable optional `requestId` makes an identical retry return the existing proposal. Proposing items has no effect on existing items. Only a List member reviewing the card can accept or reject it.

The endpoint uses stateless Streamable HTTP with the MCP SDK’s 2025 compatibility. Results include structured data and its JSON text representation so clients that read only text receive the same content. OAuth discovery is available at `/.well-known/oauth-protected-resource/mcp`, `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`. Clients use a bearer header. OAuth uses authorization code with S256 PKCE, 5-minute codes, 15-minute access tokens and rotating 30-day refresh tokens for clients granted `offline_access`. List stores credential hashes and validates the canonical resource and current account connection.

## Configure each environment

Set `LIST_OAUTH_ISSUER` to the canonical HTTPS origin, `LIST_MCP_RESOURCE` to that origin plus `/mcp`, and `LIST_OAUTH_CLIENTS` to a private JSON array as shown in `.env.example`. Use a separate ID and random secret per chat platform and environment. Register the exact HTTPS callback URLs supplied by the chat app. Select `client_secret_basic` or `client_secret_post` according to the client’s token authentication. Give the client the scopes it uses. To keep a connection across conversations, include `offline_access` in the authorization request or use the registered defaults.

The test host should use the shared preview database and its own OAuth clients. Chat services must be able to reach its discovery, MCP and OAuth routes over HTTPS. Vercel Deployment Protection on those routes will show a Vercel login before List can return the OAuth challenge. Configure edge rate controls for public MCP, authorize and token requests as appropriate for the environment.

| Chat app | Setup | Verification |
| --- | --- | --- |
| ChatGPT | In a workspace with custom MCP and write tools, add List with OAuth and the registered client ID and secret. Complete OAuth, scan the tools and select List in a chat. | Run list discovery, context, propose, accept and disconnect in a compatible web workspace. [Custom MCP](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt) · [OAuth](https://developers.openai.com/plugins/build/auth) |
| Claude | On the web, add a remote custom connector and use your own registered OAuth client. Select the connector in chat. | Verify connection and revocation from both List and Claude. [Custom connectors](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities) |
| Gemini | In an eligible Gemini account, add the server from Connected Apps and use its advanced OAuth registration settings. Use Developer Mode during setup. | Verify text tool results and a write confirmation. Eligibility and regional availability are determined by Google. [Connected Apps](https://support.google.com/gemini/answer/17209137) · [OAuth](https://developers.google.com/connected-apps/mcp/oauth) |

Custom connectors can be tested before any directory publication. Public distribution uses each platform’s registration and review workflow, with the same List endpoint. [OpenAI submission](https://developers.openai.com/plugins/deploy/submission) · [Google registration](https://developers.google.com/connected-apps/gpc/perform-the-steps)

## Automatic migrations and release

Vercel runs `pnpm db:migrate && pnpm build` for Production. Preview runs `pnpm build` and uses its configured `DATABASE_URL`. Prepare a compatible schema separately before testing a preview that depends on a new migration. The repository also sets the install command to `pnpm install --frozen-lockfile`. GitHub Actions runs the test suite with a local database.

The migration runner uses Drizzle’s checked-in SQL and journal. It takes a transaction-scoped PostgreSQL advisory lock before reading the migration history, then applies pending SQL and records its history in the same transaction. This serializes concurrent production migration runs. A failed migration stops the production build.

For the MCP release, `0003` adds the OAuth tables and `0004` removes the legacy AI links table and proposal credential columns. Both run during the build. The previously deployed AI link API can stop working between migration completion and activation of the new build. Existing proposal rows remain reviewable on the new deployment. Verify the deployment once it is active, including OAuth discovery, consent, proposal review and disconnect.
