# Project Overview

A React-based web application that allows users to seamlessly store, view, download, and search their data online across multiple storage providers.

## TODO

1. Decide which platform will host the application.
2. Replace the current Azure PAT, which expires after 90 days, with a managed
   identity if the application is hosted on Azure, or an appropriate service
   principal if another hosting platform is selected.

## Key Features & Requirements

* **Storage Selection:** Choose your preferred storage provider and location.
* **Direct Uploads:** Upload files directly through the web UI.
* **In-App Media Viewing:** View supported files and media natively in the browser.
* **Direct Downloads:** Download stored files directly from the platform.
* **Global Search:** Easily search and locate your data across connected providers.

---

## Tech Stack

* **Frontend:** React (JavaScript)
* **Backend:** Node.js
* **Hosting:** Hosted Online

---

## Storage Providers

| Provider | Capacity | Max Upload Size | Best Used For | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Azure Repos** | 250 GB | Standard Git limits | Documents & Code | Poor for large images & video recordings |
| **GitLab** | — | — | Backup | Serves as a secondary backup for Azure Repos |
| **Box (Free Developer)** | 10 GB | 250 MB / file | Photos & Media | API testing with a CCG service account |
| **Koofr (Starter)** | 10 GB | Unknown | General Files | **Warning:** Account/repo deleted after 2 years of inactivity |

---

## Azure Storage considerations

Azure Repos storage does not grow by storing a complete copy of the repository
for every commit. Git stores each unchanged image once and lets later commits
reference the same underlying object. Storage therefore grows approximately by
the combined size of each unique image or edited image version, rather than
exponentially with every commit. Deleting an image from the current branch does
not reclaim the copy retained in Git history.

### Repository separation

The GitHub repository stores the application source code and excludes uploaded
images. Azure data operations use a separate Git working directory configured
by `AZURE_DATA_REPO_DIR`, so Azure currently receives only files under its
`images/` directory and never receives the GitHub repository's source history.
For a hosted container, this directory should point to persistent storage such
as `/data/azure-data-repo`.

## Testing

The connectivity harness currently tests GIF, JPEG, PNG, and WebP operations
against Azure DevOps Repos and Box.

### Running the CLI

* Configure `.env` using the placeholders in `.env.example`.
* Run `node PlatformConnectivityTests/RunAll.js`.
* Select Azure or Box, then choose the required operation.

### Azure DevOps Repos

* Push one image through the temporary local server.
* Push all supported images in a folder and its subfolders as one commit.
* Remove images added by the latest Azure data commit. Removal creates a new
  deletion commit and does not rewrite Git history.

### Box

* Uses Client Credentials Grant (CCG) to authenticate as the app's service
  account.
* Push one image, selected images, or a folder of images.
* List file IDs and pull one, multiple, or all files from the configured folder.
* Delete one or multiple files by ID after explicit confirmation. Box normally
  moves deleted files to Trash.
* Downloads default to `.box-downloads/` and do not overwrite existing files.

### Current limits

* The temporary upload server accepts images up to 10 MB.
* Direct Box batch uploads accept files up to 50 MB; chunked uploads for the
  account's 250 MB limit are not yet implemented.
* Box operations target files directly inside `BOX_FOLDER_ID`. Remote
  subfolders are not traversed, and local folder uploads are flattened.
