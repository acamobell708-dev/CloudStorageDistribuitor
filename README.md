# Cloud Storage Distributor

A React and Node.js application for storing, finding, viewing, downloading, and
versioning files across multiple cloud providers from one workspace.

The first browser workflow is now implemented: choose almost any file up to
50 MB and send it to the Box folder configured on the server. Images, PDFs,
Word documents, Excel workbooks, text files, archives, audio, video, and other
file types all use the same upload path. Box credentials and access tokens never
enter the browser.

## Current browser experience

- Responsive React upload workspace with drag-and-drop and file selection.
- Image thumbnails and metadata for other file types.
- Browser-to-server upload progress and clear Box handoff states.
- Server-side Box Client Credentials Grant authentication.
- SHA-256 file naming and duplicate detection before upload.
- Safe support for arbitrary non-empty files up to a configurable 50 MB limit.
- A provider factory and shared storage base class ready for more providers.
- Production build serving from the Node server.

Azure DevOps Repos is still available through the connectivity CLI. Its browser
upload adapter is the next provider to add to the shared storage interface.

## Project structure

```text
public/                         Browser-safe React source
  app/
    api/                        Browser API clients
    components/                 Reusable React components
    App.jsx
    main.jsx
  index.html
  styles.css

src/                            Trusted server code
  config/                       Environment loading and limits
  controllers/                  HTTP request coordination
  errors/                       Safe application error types
  middleware/                   API error handling
  routes/                       Express routes and multipart parsing
  scripts/                      Cross-platform development/CI utilities
  services/
    storage/
      box/                      Box auth, API, and storage implementation
      StorageProvider.js        Base class for future providers
      StorageProviderFactory.js Provider registry
  app.js                        Express application composition
  server.js                     Server entry point

tests/
  unit/                         Isolated service and helper tests
  integration/                  HTTP API and middleware tests
.github/workflows/ci.yml        Push/PR verification and build delivery
PlatformConnectivityTests/      Live Azure and Box CLI harness
```

The browser calls `POST /api/storage/:provider/files`. The controller passes the
in-memory file to `FileUploadService`, which selects the provider through
`StorageProviderFactory`. `BoxStorageProvider` extends the common
`StorageProvider` contract, so an Azure browser implementation can be registered
without changing the controller or upload UI.

## Requirements

- Node.js 22.12 or newer.
- A Box Platform Application configured for Server Authentication with Client
  Credentials Grant.
- The Box application authorized in the enterprise Admin Console.
- Upload access to the folder set in `BOX_FOLDER_ID`.

## Configure Box

Copy `.env.example` to `.env` and fill in the server-only Box values:

```dotenv
BOX_CLIENT_ID=
BOX_CLIENT_SECRET=
BOX_ENTERPRISE_ID=
BOX_FOLDER_ID=
```

`BOX_CLIENT_SECRET` is deliberately read only by `src`. Do not move any Box
credential into `public`, a Vite variable, or browser code.

The complete local web settings are:

```dotenv
HOST=127.0.0.1
PORT=3000
MAX_UPLOAD_SIZE_MB=50
```

The direct upload route is capped at 50 MB because larger Box uploads should use
the chunked upload API. `MAX_UPLOAD_SIZE_MB` may be lowered but not raised above
50 until chunked uploads are implemented.

## Run locally

Install dependencies:

```shell
npm install
```

Start the React development server and watched Node server together:

```shell
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` requests to the Node server on
port 3000.

## Test and build

Check the syntax of the server, CLI, and test JavaScript:

```shell
npm run check:syntax
```

Run the isolated unit tests:

```shell
npm run test:unit
```

Run the HTTP integration tests:

```shell
npm run test:integration
```

Run both test suites:

```shell
npm test
```

Create the optimized React build:

```shell
npm run build
```

The Vite build also parses and validates the React JSX and browser modules.

Start the production Node server, which serves the built app from `dist`:

```shell
npm start
```

## GitHub CI/CD

`.github/workflows/ci.yml` runs on every push and pull request. It installs the
exact dependency versions from `package-lock.json`, checks server/test syntax,
runs unit and integration tests separately, and creates the production React
build. The tested `dist` directory is retained as a downloadable workflow
artifact for seven days.

No Box secrets are required by this workflow because provider calls are mocked
in unit tests and integration tests inject an in-memory test provider. Live Box
connectivity remains an explicit local operation rather than running against
real cloud data on every push.

## Web API

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Confirm that the Node service is running |
| `GET` | `/api/storage/providers` | List browser-ready storage providers |
| `POST` | `/api/storage/box/files` | Upload one multipart `file` to Box |

Successful new uploads return `201`. If the SHA-256 content hash already exists
in the configured Box folder, no second copy is created and the existing file
is returned with `200`.

## Connectivity CLI

The original live connectivity harness remains available:

```shell
npm run test:connectivity
```

It provides these operations:

- Azure: upload one supported image, upload a recursive image folder, or remove
  images introduced by the latest Azure data commit.
- Box: upload one or more files, list file IDs, download files, and move selected
  files to Box Trash.

The Box CLI adapter now calls the same `src/services/storage/box` implementation
as the web API, avoiding separate authentication and CRUD implementations.

## Storage roadmap

| Provider | Current state | Best use |
| :--- | :--- | :--- |
| Box | Browser upload and CLI CRUD | General files and media |
| Azure DevOps Repos | Image-oriented CLI operations | Versioned documents and code |
| GitLab | Planned | Secondary source backup |
| Koofr | Planned | General file storage |

Next useful increments are a Box file browser/download page, persisted transfer
activity, Azure's `StorageProvider` adapter, and chunked Box uploads above 50 MB.
