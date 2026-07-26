# Project Overview

A React-based web application that allows users to seamlessly store, view, download, and search their data online across multiple storage providers.

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
images. Azure image operations use a separate Git working directory configured
by `AZURE_IMAGE_REPO_DIR`, so Azure receives only files under its `images/`
directory and never receives the GitHub repository's source history. For a
hosted container, this directory should point to persistent storage such as
`/data/azure-image-repo`.
