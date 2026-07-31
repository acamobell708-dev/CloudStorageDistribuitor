# Cloud Storage Distributor

A React and Node.js app for uploading files to Box or an Azure DevOps Git
repository from one browser interface. Cloud credentials remain on the server.

> **Main TODO — Cloudflare R2 provider:** Add Cloudflare R2 as the next
> storage provider. R2 is S3-compatible object storage, so it will join Box
> and Azure Repos behind the existing provider factory and shared browser flow.

## Features

- Provider dropdown for Box and Azure Repos.
- Drag-and-drop, file previews, progress, and upload status.
- Original stored filenames with internal content hashes and duplicate detection.
- Direct and chunked Box uploads.
- Versioned Azure uploads sent directly to the remote repository API.
- Live Box and Azure folder browsing with streamed downloads and recursive
  file or folder deletion.
- Current-folder search with predictive suggestions, media filters, and
  size, name, or modified-date sorting.
- Owner-authorized Azure history purge for exceptional permanent deletion.
- Interactive provider-capacity bars grouped by file type.
- Dashboard upload scatter chart with per-user/day details and a paginated
  shared upload, download, and deletion trail.
- Predefined member accounts, in-memory sessions, and read-only guest access.
- Shared provider base class and factory for adding future storage services.

## Upload support

| Provider | Maximum file size | Supported files | Upload method |
| :--- | :--- | :--- | :--- |
| Box | Configured account currently reports **2 GB** | Any non-empty file | Direct through 50 MB; chunked above 50 MB |
| Azure Repos | **100 MB** | Documents, source code, images, audio, and video | Remote commit through the Azure Pushes REST API |

The Box limit is read from the authenticated account at runtime, so it adjusts
when the Box plan changes. `BOX_MAX_UPLOAD_SIZE_MB` is only a startup fallback.

Azure document support includes PDF, Word, Excel, PowerPoint, OpenDocument,
text, CSV, Markdown, JSON, and XML formats. Common web, scripting, and compiled
language source files are also accepted, including HTML, CSS, JavaScript,
TypeScript, Python, Java, C/C++, C#, Go, Rust, PHP, Ruby, Swift, SQL, and shell
scripts. Files are stored under `documents/`, `source/`, `images/`,
`media/audio/`, `media/video/`, or the managed `folders/` tree.

## Data flow

1. React sends the selected file, file batch, or folder manifest as multipart
   data to
   `POST /api/storage/:provider/files`.
2. Browser uploads use temporary disk staging so multi-file and folder
   transfers do not consume equivalent server memory.
3. The provider factory selects Box or Azure.
4. The provider validates the original filename, type, and provider limit.
5. Box creates any required folders and uploads directly or in chunks. Azure
   creates one remote Git commit for the batch through the Azure DevOps Pushes
   REST API using base64-encoded request content.
6. Azure never writes browser uploads to `AzureDataRepo`. Temporary request
   staging is deleted on success or failure.

The Manage Files page calls `GET /api/storage/:provider/files`. Box is read
through its folder API, while Azure is read from the configured remote branch
through the Azure DevOps Items REST API. Selecting a row exposes its download
action. The server verifies the current cloud item, then streams it to the
browser without exposing provider credentials or writing another local copy.
Preview uses the same authenticated provider lookup through a separate inline
route. It supports browser-decodable images and audio, captures one still frame
for browser-decodable video, renders PDFs one page at a time for up to 50 pages,
and limits text or source previews to 256 KiB. Images are limited to 15 MiB,
PDFs to 25 MiB, audio to 50 MiB, and video stills to 100 MiB. Office documents,
archives, unknown binaries, unsupported codecs, and files without the metadata
needed to apply those safeguards remain download-only.
The normal delete action verifies the current cloud item before deleting it.
Box enterprise settings determine whether its deletion uses trash. Azure
creates a deletion commit, so earlier Git versions remain available.

Azure also exposes an owner-only permanent deletion when its purge settings are
configured. It creates an isolated temporary mirror, removes the selected path
from every reachable commit, force-pushes only if the branch has not changed,
freshly clones the cloud repository to verify the result, and deletes the
temporary mirror. For safety, the repository must contain only its configured
branch with no tags or other refs. Azure may retain unreachable internal
objects until its own maintenance completes.

Browser-safe UI code is under `public/`. Credentials, validation, processing,
API routes, and provider integrations are under `src/`.

## Dashboard activity

The Dashboard includes a 14-day upload chart with one point per member per day
and a shared upload, download, and deletion history. It records successful
storage actions only, retains the latest 500 events, and serves history in
pages of 10 items.

Activity is intentionally in memory to keep the hosted application within its
current lightweight, scale-to-zero design: it resets when the Container App
scales to zero, restarts, or deploys a new revision. When that local history
is empty, the Dashboard repopulates the latest 14 days of upload, download,
and deletion events from the configured Box account's event stream for items
within the configured Box folder. It also rebuilds Azure Repos uploads and
deletions from recent Git commits; Git does not expose browser-download events,
and a commit without author details is shown as **Unknown user**. This is still
a dashboard convenience feature, not a permanent audit record; Box event
retention and permissions apply, while permanently purged Azure Git history
cannot be reconstructed. No additional Azure resource, dependency, or
environment variable is required.

## Access

`login.html` is the application entry point. The three supplied accounts are
defined server-side using salted password hashes: Adam is the owner, while
Wilson and Andrew are members. All can use normal storage actions; only the
owner can permanently rewrite Azure history.

Guest sessions can view Home and Dashboard. Storage uploads, listings,
downloads, deletions, and the Manage Files page are blocked by server
middleware as well as the UI. Sessions are held in server memory for eight
hours by default, so restarting the server signs everyone out without needing
a user database. Five failed logins temporarily limit further attempts from
that client.

## Configuration

Copy `.env.example` to `.env`. Never commit `.env` or expose its values through
Vite/browser variables.

### Box

```dotenv
BOX_CLIENT_ID=
BOX_CLIENT_SECRET=
BOX_ENTERPRISE_ID=
BOX_FOLDER_ID=
BOX_MAX_UPLOAD_SIZE_MB=250
```

The Box Platform application must use Client Credentials Grant, be authorized
by the enterprise, and have read/write access to `BOX_FOLDER_ID`.

### Azure Repos

```dotenv
AZURE_GIT_REMOTE=https://your-organization@dev.azure.com/your-organization/your-project/_git/your-repository
AZURE_GIT_BRANCH=main
AZURE_GIT_PUSH=true
AZURE_STORAGE_CAPACITY_GB=250
AZURE_AUTH_MODE=pat
AZURE_DEVOPS_PAT=
AZURE_MANAGED_IDENTITY_CLIENT_ID=
AZURE_PURGE_AUTH_MODE=pat
AZURE_PURGE_PAT=
AZURE_PURGE_MANAGED_IDENTITY_CLIENT_ID=
```

`AZURE_GIT_PUSH=true` enables browser writes. Web uploads go straight to the
configured remote and do not use a local Git working tree, which keeps uploaded
data out of the GitHub code repository.

The Available Storage page reads Box quota and account usage directly from Box.
Azure Repos does not expose an equivalent remaining-capacity field, so
`AZURE_STORAGE_CAPACITY_GB` controls the comparison limit and defaults to 250
GB. Azure file-type totals represent the configured branch's current files,
not repository history or Git object overhead.

For local development, keep both authorization modes as `pat`.
`AZURE_PURGE_PAT` is optional and otherwise defaults to `AZURE_DEVOPS_PAT`.
The normal identity needs repository read and contribute permissions; the purge
identity additionally needs **Force push (rewrite history)**.

For Azure Container Apps, set `AZURE_AUTH_MODE=managed-identity` and
`AZURE_PURGE_AUTH_MODE=managed-identity`. Enable a system-assigned identity and
leave both client-ID values empty, or enter the client ID of a user-assigned
identity. Add that identity to the Azure DevOps organization and grant its
repository permissions. The server then requests short-lived Azure DevOps
tokens at operation time, so no PAT needs to be stored or renewed. A separate
user-assigned purge identity provides stronger permission separation.

The server permits purge requests only for the predefined owner account.
Deploy behind HTTPS.

`AZURE_DATA_REPO_DIR=../AzureDataRepo` is optional and used only by the CLI
connectivity tests. The web provider is created with local-repository access
disabled and is not given this configured path. Permanent deletion uses only a
short-lived operating-system temporary mirror and cleans it up on success or
failure.

Optional local settings:

```dotenv
HOST=127.0.0.1
PORT=3000
AUTH_SESSION_HOURS=8
AUTH_SECURE_COOKIE=false
UPLOAD_TEMP_DIR=
```

`UPLOAD_TEMP_DIR` applies to Box and Azure browser uploads. Leave it blank to
use the operating system temporary directory. Set `AUTH_SECURE_COOKIE=true`
when serving through HTTPS.

## Run

Requires Node.js 22.12 or newer. Permanent Azure deletion also requires Git on
the server.

```shell
npm install
npm run dev
```

Open `http://127.0.0.1:5173/login.html`. The React development server proxies
API calls to the Node server on port 3000. Authenticated members can use
`/manageFiles.html`; all signed-in roles can use `/dashboard.html`.

Production:

```shell
npm run build
npm start
```

## Azure deployment

The repository includes a production Docker image, Bicep infrastructure, and a
GitHub OIDC deployment workflow for Azure Container Apps. The deployment uses
managed identity for Azure DevOps, HTTPS ingress, health probes, scale-to-zero,
and a single-replica ceiling for the current in-memory session model.

Follow the detailed [Azure Container Apps deployment guide](docs/AZURE_CONTAINER_APPS.md).

## Checks

```shell
npm run check:syntax
npm run test:unit
npm run test:integration
npm run build
```

`npm test` runs both test suites. `.github/workflows/ci.yml` performs these
checks, builds the production container, validates the Bicep template, and
retains the built `dist` artifact for seven days. Cloud operations are mocked;
the separate CLI storage integration test uses a disposable local repository,
so CI does not require provider secrets.

## API

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health |
| `GET` | `/api/auth/session` | Read the current login session |
| `POST` | `/api/auth/login` | Start a predefined-user session |
| `POST` | `/api/auth/guest` | Start a restricted guest session |
| `POST` | `/api/auth/logout` | Revoke the current session |
| `GET` | `/api/activity` | Read 14-day upload points and paginated shared activity (members only; resets after app restart) |
| `GET` | `/api/storage/providers` | Provider capabilities and current limits |
| `GET` | `/api/storage/:provider/files` | List the provider's latest cloud files |
| `GET` | `/api/storage/:provider/files/:fileId/download` | Stream the selected current cloud file |
| `DELETE` | `/api/storage/:provider/files/:fileId` | Delete a supported provider file; Azure retains Git history |
| `DELETE` | `/api/storage/azure/files/:fileId/history` | Owner-authorized removal from current and reachable Azure history |
| `POST` | `/api/storage/box/files` | Upload one multipart `file` to Box |
| `POST` | `/api/storage/azure/files` | Upload one multipart `file` to Azure Repos |

New uploads return `201`; detected duplicates return `200`.
