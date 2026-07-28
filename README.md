# Cloud Storage Distributor

A React and Node.js app for uploading files to Box or an Azure DevOps Git
repository from one browser interface. Cloud credentials remain on the server.

## Features

- Provider dropdown for Box and Azure Repos.
- Drag-and-drop, file previews, progress, and upload status.
- SHA-256 names and duplicate detection.
- Direct and chunked Box uploads.
- Versioned Azure document, source code, and media uploads in a separate data
  repository.
- Shared provider base class and factory for adding future storage services.

## Upload support

| Provider | Maximum file size | Supported files | Upload method |
| :--- | :--- | :--- | :--- |
| Box | Configured account currently reports **2 GB** | Any non-empty file | Direct through 50 MB; chunked above 50 MB |
| Azure Repos | **100 MB** | Documents, source code, images, audio, and video | Standard Git commit and push |

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
2. Express stages it in an operating-system temporary directory.
3. The provider factory selects Box or Azure.
4. The provider validates the original filename, type, and provider limit.
5. Box uploads the file directly or in chunks. Azure copies it to the isolated
   data repository, commits it, and pushes it.
6. The temporary request file is deleted on success or failure.

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
by the enterprise, and have upload access to `BOX_FOLDER_ID`.

### Azure Repos

```dotenv
AZURE_GIT_REMOTE=https://your-organization@dev.azure.com/your-organization/your-project/_git/your-repository
AZURE_GIT_BRANCH=main
AZURE_DATA_REPO_DIR=../AzureDataRepo
AZURE_GIT_PUSH=true
AZURE_DEVOPS_PAT=
```

The PAT needs code read/write access. `AZURE_DATA_REPO_DIR` must be a separate
Git working directory; the server refuses to use the application repository.
This keeps uploaded data out of the GitHub code repository.

Optional local settings:

```dotenv
HOST=127.0.0.1
PORT=3000
UPLOAD_TEMP_DIR=
```

## Run

Requires Node.js 22.12 or newer.

```shell
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The React development server proxies API calls to
the Node server on port 3000.

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
seven days. Cloud operations are mocked or use temporary local repositories, so
CI does not require provider secrets.

## API

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health |
| `GET` | `/api/storage/providers` | Provider capabilities and current limits |
| `POST` | `/api/storage/box/files` | Upload one multipart `file` to Box |
| `POST` | `/api/storage/azure/files` | Upload one multipart `file` to Azure Repos |

New uploads return `201`; detected duplicates return `200`.
