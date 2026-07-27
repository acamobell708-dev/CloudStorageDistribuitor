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
| **Box (Individual)** | 10 GB | 250 MB / file | Photos & Media | Reliable for individual photo storage |
| **Koofr (Starter)** | 10 GB | Unknown | General Files | **Warning:** Account/repo deleted after 2 years of inactivity |

---

## Azure Stroage considerations

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

### Image CLI

Run `node PlatformConnectivityTests/RunAll.js`, then choose:

1. Upload an image by entering its local file path.
2. Remove the image files added by the latest Azure data commit.
3. Upload every supported image in a folder and its subfolders. Non-image files
   are ignored, and the new images are grouped into one commit.

Removal creates and pushes a new deletion commit; it does not rewrite Git
history.
