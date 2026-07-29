# Cloud Storage Distributor

A React and Node.js app for uploading files to Box or an Azure DevOps Git
repository from one browser interface. Cloud credentials remain on the server.

## Features

- Provider dropdown for Box and Azure Repos.
- Drag-and-drop, file previews, progress, and upload status.
- Original stored filenames with internal content hashes and duplicate detection.
- Direct and chunked Box uploads.
- Versioned Azure uploads sent directly to the remote repository API.
- Live Box and Azure file management with streamed downloads and Box deletion.
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
`media/audio/`, or `media/video/`.

## Data flow

1. React sends the selected file as multipart data to
   `POST /api/storage/:provider/files`.
2. Azure request data stays in memory. Box uses temporary disk staging so its
   account-sized and chunked uploads do not consume equivalent server memory.
3. The provider factory selects Box or Azure.
4. The provider validates the original filename, type, and provider limit.
5. Box uploads directly or in chunks. Azure creates a remote Git commit through
   the Azure DevOps Pushes REST API using base64-encoded request content.
6. Azure never writes browser uploads to `AzureDataRepo`. Box request staging
   is deleted on success or failure.

The Manage Files page calls `GET /api/storage/:provider/files`. Box is read
through its folder API, while Azure is read from the configured remote branch
through the Azure DevOps Items REST API. Selecting a row exposes its download
action. The server verifies the current cloud item, then streams it to the
browser without exposing provider credentials or writing another local copy.
For Box, the selected-row delete action verifies the configured parent folder,
waits for Box to confirm deletion, and refreshes the cloud listing. Box
enterprise settings determine whether deletion moves the item to trash or
removes it permanently.

Browser-safe UI code is under `public/`. Credentials, validation, processing,
API routes, and provider integrations are under `src/`.

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
AZURE_DEVOPS_PAT=
```

The PAT needs code read/write access. `AZURE_GIT_PUSH=true` enables browser
writes. Web uploads go straight to the configured remote and do not use a local
Git working tree, which keeps uploaded data out of the GitHub code repository.

`AZURE_DATA_REPO_DIR=../AzureDataRepo` is optional and used only by the CLI
connectivity tests. The web provider is created with local-repository access
disabled and is not given this configured path.

Optional local settings:

```dotenv
HOST=127.0.0.1
PORT=3000
UPLOAD_TEMP_DIR=
```

`UPLOAD_TEMP_DIR` applies to disk-backed providers such as Box, not Azure
browser uploads.

## Run

Requires Node.js 22.12 or newer.

```shell
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The React development server proxies API calls to
the Node server on port 3000. Use `/manageFiles.html` to manage cloud files and
`/dashboard.html` for the dashboard placeholder.

Production:

```shell
npm run build
npm start
```

## Checks

```shell
npm run check:syntax
npm run test:unit
npm run test:integration
npm run build
```

`npm test` runs both test suites. `.github/workflows/ci.yml` performs these
checks on every push and pull request and retains the built `dist` artifact for
seven days. Cloud operations are mocked; the separate CLI storage integration
test uses a disposable local repository, so CI does not require provider
secrets.

## API

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health |
| `GET` | `/api/storage/providers` | Provider capabilities and current limits |
| `GET` | `/api/storage/:provider/files` | List the provider's latest cloud files |
| `GET` | `/api/storage/:provider/files/:fileId/download` | Stream the selected current cloud file |
| `DELETE` | `/api/storage/:provider/files/:fileId` | Delete a supported provider file |
| `POST` | `/api/storage/box/files` | Upload one multipart `file` to Box |
| `POST` | `/api/storage/azure/files` | Upload one multipart `file` to Azure Repos |

New uploads return `201`; detected duplicates return `200`.
