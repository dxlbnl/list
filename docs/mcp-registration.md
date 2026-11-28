# Register List in ChatGPT, Claude and Gemini

All three platforms use the same remote MCP server at
`https://list.dexterlabs.nl/mcp`. The OAuth issuer is
`https://list.dexterlabs.nl`. Use this canonical host directly, including
`/mcp` on the server URL.

## Configure the List side

1. Create a separate OAuth client ID and random secret for each platform and
   environment in the server-only Vercel variable `LIST_OAUTH_CLIENTS`. Keep
   the existing registrations when updating the JSON array. Use the structure
   in [the environment example](../.env.example).
2. Obtain the exact redirect URI or URIs from the relevant platform. Add all
   displayed URIs to that client's `redirectUris`. Deploy the new configuration
   before completing consent.
3. Request `lists:read`, `proposals:create` and `offline_access` for reading
   lists, creating proposals and refreshing the connection. Select the same
   token-endpoint authentication method in List and in the client. Production
   OAuth discovery currently advertises `client_secret_basic`.
4. Enter the client secret in the platform's connection settings. Keep it out
   of the repository, plugin ZIP and chat. The administrator or publisher
   configures the client once for a distributed plugin. Each member then
   authorizes their own List account.

Production OAuth discovery is served at
`/.well-known/oauth-authorization-server` and
`/.well-known/oauth-protected-resource/mcp`. A POST to `/mcp` without
credentials should return HTTP 401 with an OAuth challenge. See
[the List OAuth configuration](../wiki/knowledge/architecture/ai-proposals.md)
for configuration details.

## ChatGPT

### Test a custom connection

1. Open **Plugins → + → Add custom MCP server** in ChatGPT web. Use a Business
   or Enterprise/Edu workspace with permission to create custom MCP servers.
2. Name the connection **List**, enter the MCP URL and choose OAuth with a
   registered client. Use the redirect URI displayed for this connection.
3. Enter the registered client ID and secret, acknowledge the warning and
   select **Create as a plugin**. Sign in to List and approve the scopes.
4. Review the discovered tools. Install or enable List, then select it in a
   chat. For internal distribution, an authorized workspace owner or admin
   can publish the custom connection for the workspace.

[Custom MCP setup](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)

### Register for the public directory

1. In the [OpenAI Plugins portal](https://platform.openai.com/plugins), choose
   **Upload new or existing plugin** under the intended organization and use a
   verified publisher identity. Upload a ZIP with a root `plugin.json` and
   `mcp.json` pointing at List. Use OAuth client registration mode `provided`
   and declare the client ID, authentication method and scopes. Enter the
   secret in the portal.
2. Open **MCPs → Connect**, complete the domain verification challenge shown
   in the portal, register the exact OAuth callback in List, and complete
   consent and the tool scan.
3. Add genuine privacy and support URLs and complete the review details. Use a
   dedicated reviewer account with sample lists. OpenAI requires a way for
   reviewers to sign in directly without mailbox access or magic links. Normal
   List sign-in uses magic links, so this reviewer flow still needs to be
   provided. Include the test cases and a walkthrough.
4. Submit for review and publish after approval. Users can then discover List
   in the directory, install it and connect their own List account.

[Package format](https://developers.openai.com/plugins/build/plugins) ·
[Submission and review](https://developers.openai.com/plugins/deploy/submission)

## Claude

### Add to an account or organization

1. In Claude web, open **Customize → Connectors**, then **+ → Add custom
   connector** for personal setup. An eligible Team or Enterprise owner can
   use **Organization settings → Connectors → Add → Custom → Web** to offer
   the connector to members.
2. Enter the display name **List** and the remote MCP URL. Choose an OAuth
   sign-in option and **Use your own OAuth client** in the advanced settings,
   where offered.
3. Enter the Claude-specific client ID and secret. The documented redirect URI
   for this mode is `https://claude.ai/api/mcp/auth_callback`. Register the
   exact URI shown if the interface supplies one.
4. Select **Add**, then **Connect** and approve access in List. In an
   organization, members connect individually once the owner adds List.

[Claude remote connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)

For public installation, submit the remote connector through Claude's developer
portal, provide the endpoint and review materials, and track approval there.
Use the remote connector submission flow for List.
[Claude directory submission](https://claude.com/resources/articles/build-plugins-for-claude)

## Google Gemini

### Test in Developer Mode

1. On an eligible Gemini web account, open **Settings → Gemini Apps Developer
   Mode**. In **Choose an app**, select **+ Create new**.
2. Enter the MCP URL. Open **Additional settings → Show more** and enter the
   Google-specific OAuth client ID and secret. Use manual client registration
   in the Authentication tab if Gemini asks for the client registration mode.
3. Review the confirmation, connect, name the app **List**, and check that
   its actions appear. Complete the List sign-in and consent flow.
4. Inspect **Tool schemas** and **Event Log** while testing the tools. After a
   tool change, use **Sync schema** to refresh the tool definitions.

[Gemini Developer Mode](https://developers.google.com/connected-apps/mcp/dev-mode/usage)

### Register a shared connected app

1. Request developer access to [Google Connected Console](https://connected.google.com/)
   if needed. Create a connected app, enter the display details and MCP URL,
   and use the console's domain verification flow.
2. Configure OAuth using the Google-specific registered client. Copy all exact
   app-specific redirect URIs Google displays into the List client allowlist.
3. Discover the tools, configure availability, and add preview testers. Verify
   consent and proposal review from an eligible tester account before submitting
   for Google's review and publication.

[Google Connected Console guide](https://developers.google.com/connected-apps/gpc/perform-the-steps)

## Verify each connection

- Find a test list and ask the client to read its context.
- Ask for a new item. Confirm a proposal appears in List and that the item
  only becomes a list item after approval.
- Verify a second account sees its own and invited lists. Disconnect the
  connection in **List → Settings → AI connections** and verify it needs a
  fresh authorization before accessing lists again.
