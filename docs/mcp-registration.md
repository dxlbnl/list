# Register List in ChatGPT, Claude and Gemini

All three platforms use the same remote MCP server at
`https://list.dexterlabs.nl/mcp`. The OAuth issuer is
`https://list.dexterlabs.nl`. Use this canonical host directly, including
`/mcp` on the server URL.

For public ChatGPT distribution, start with [Build the upload ZIP](#build-the-upload-zip).

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

### Build the upload ZIP

The repository includes two templates. [`plugin.json`](mcp/chatgpt/plugin.json)
describes the public listing and points to the icon. [`mcp.json`](mcp/chatgpt/mcp.json)
configures the production MCP endpoint and OAuth. OpenAI's portal reads the
advanced OAuth settings from `mcp.json`. Keep `extensions["com.openai"].auth`
in that file for upload. The generic Agent Plugins 1.0.0 MCP schema is stricter
than OpenAI’s documented extension format, so a generic schema validator may
flag that field. Use the OpenAI portal to validate the full submission.

1. From the repository root, prepare a working directory:

   ```sh
   package_dir="$(mktemp -d)"
   mkdir -p "$package_dir/assets"
   cp docs/mcp/chatgpt/plugin.json docs/mcp/chatgpt/mcp.json "$package_dir/"
   cp static/apple-touch-icon.png "$package_dir/assets/list.png"
   printf 'Edit the manifests in %s\n' "$package_dir"
   ```

2. In that directory, edit both files:

   | File | Values to fill in |
   | --- | --- |
   | `plugin.json` | Replace the three `replace-me.invalid` URLs with public HTTPS pages for List support, privacy and terms. Confirm the developer name matches your verified publishing identity. |
   | `mcp.json` | Replace `REPLACE_WITH_LIST_OAUTH_CLIENT_ID` with the client ID for this public plugin in `LIST_OAUTH_CLIENTS`. The template already uses the production endpoint, its current `client_secret_basic` method, and List's three scopes. Use OAuth discovery for the authorization and token endpoints. |

   The client secret goes in the OpenAI portal during connection setup. The
   client ID is the public value that belongs in the ZIP.

3. In the same terminal, create a fresh ZIP and list the contents:

   ```sh
   if grep -qE 'replace-me[.]invalid|REPLACE_WITH_LIST_OAUTH_CLIENT_ID' \
       "$package_dir/plugin.json" "$package_dir/mcp.json"; then
     printf '%s\n' 'Fill in the remaining manifest placeholders before packaging.'
   else
     (cd "$package_dir" && zip list-chatgpt.zip plugin.json mcp.json assets/list.png)
     unzip -l "$package_dir/list-chatgpt.zip"
     printf 'Upload %s/list-chatgpt.zip\n' "$package_dir"
   fi
   ```

   The ZIP should list `plugin.json`, `mcp.json` and `assets/list.png` at
   those exact paths. Use a fresh working directory for each build.

[OpenAI package format](https://developers.openai.com/plugins/build/plugins)

### Submit to the public directory

1. In the [OpenAI Plugins portal](https://platform.openai.com/plugins), select
   **Upload new or existing plugin**, choose a verified publisher identity and
   upload the ZIP.
2. Open **MCPs → Connect**, complete the domain verification challenge shown
   in the portal, and register the exact callback URI for this public plugin
   in List. Once the List OAuth change is deployed, enter the secret in the
   portal and finish consent and the tool scan.
3. Complete the review details with five positive and three negative test
   cases and a walkthrough video. Provide a dedicated reviewer account with
   sample lists. OpenAI requires direct reviewer sign-in without mailbox
   access or magic links. Normal List sign-in uses magic links, so the
   reviewer sign-in flow still needs to be provided.
4. Submit for review and publish after approval. Users can then discover List
   in the directory, install it and connect their own List account.

[OpenAI submission and review](https://developers.openai.com/plugins/deploy/submission)

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
