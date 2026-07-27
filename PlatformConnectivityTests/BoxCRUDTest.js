const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");

const codeRepoRoot = path.resolve(__dirname, "..");

try {
  process.loadEnvFile(path.join(codeRepoRoot, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") {
    throw error;
  }
}

const clientId = process.env.BOX_CLIENT_ID;
const clientSecret = process.env.BOX_CLIENT_SECRET;
const enterpriseId = process.env.BOX_ENTERPRISE_ID;
const folderId = process.env.BOX_FOLDER_ID;

const boxApiUrl = "https://api.box.com/2.0";
const boxUploadUrl = "https://upload.box.com/api/2.0";
const maximumDirectUploadSize = 50 * 1024 * 1024;

function requireBoxConfiguration() {
  const missing = [];

  if (!clientId) {
    missing.push("BOX_CLIENT_ID");
  }

  if (!clientSecret) {
    missing.push("BOX_CLIENT_SECRET");
  }

  if (!enterpriseId) {
    missing.push("BOX_ENTERPRISE_ID");
  }

  if (!folderId) {
    missing.push("BOX_FOLDER_ID");
  }

  if (missing.length > 0) {
    throw new Error(`Missing Box configuration: ${missing.join(", ")}`);
  }
}

async function readResponseBody(response) {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorMessage(body) {
  if (!body) {
    return "No response body was returned";
  }

  if (typeof body === "string") {
    return body;
  }

  return (
    body.error_description ||
    body.message ||
    body.code ||
    JSON.stringify(body)
  );
}

async function throwBoxError(response, action) {
  const body = await readResponseBody(response);

  throw new Error(
    `${action} failed with Box status ${response.status}: ` +
      getErrorMessage(body)
  );
}

let cachedAccessToken;
let cachedAccessTokenExpiresAt = 0;

async function getAccessToken() {
  requireBoxConfiguration();

  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt) {
    return cachedAccessToken;
  }

  const body = new URLSearchParams({
    box_subject_id: enterpriseId,
    box_subject_type: "enterprise",
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials"
  });

  const response = await fetch("https://api.box.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    await throwBoxError(response, "Obtaining a Box access token");
  }

  const tokenResponse = await response.json();

  if (!tokenResponse.access_token) {
    throw new Error("Box did not return an access token");
  }

  const expiresInSeconds = Number(tokenResponse.expires_in || 3600);

  cachedAccessToken = tokenResponse.access_token;
  cachedAccessTokenExpiresAt =
    Date.now() + Math.max(expiresInSeconds - 60, 1) * 1000;

  return cachedAccessToken;
}

async function boxFetch(url, options = {}) {
  const accessToken = await getAccessToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    await throwBoxError(
      response,
      options.action || `${options.method || "GET"} ${url}`
    );
  }

  return response;
}

async function boxJson(url, options = {}) {
  const response = await boxFetch(url, options);
  return readResponseBody(response);
}

function validateFile(fileBody, originalName) {
  if (!Buffer.isBuffer(fileBody) || fileBody.length === 0) {
    throw new Error(
      `No file data was supplied for ${originalName || "the file"}`
    );
  }

  if (fileBody.length > maximumDirectUploadSize) {
    throw new Error(
      `${originalName || "The file"} exceeds the direct-upload ` +
        "test limit of 50 MB"
    );
  }
}

function cleanName(originalName) {
  const suppliedName = path.basename(originalName || "file");
  const suppliedExtension = path.extname(suppliedName);
  const extension = suppliedExtension
    .replace(/[^.a-zA-Z0-9]/g, "")
    .slice(0, 16);
  const stem =
    path
      .basename(suppliedName, suppliedExtension)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 120) || "file";

  return { extension, stem };
}

function createStoredName(fileBody, originalName) {
  const hash = createHash("sha256").update(fileBody).digest("hex");
  const { extension, stem } = cleanName(originalName);

  return {
    filename: `${hash}-${stem}${extension}`,
    hash
  };
}

async function listFiles() {
  requireBoxConfiguration();

  const files = [];
  let marker;

  do {
    const query = new URLSearchParams({
      fields: "id,type,name,size,sha1,modified_at,parent",
      limit: "1000",
      usemarker: "true"
    });

    if (marker) {
      query.set("marker", marker);
    }

    const result = await boxJson(
      `${boxApiUrl}/folders/${encodeURIComponent(folderId)}/items?${query}`,
      {
        action: "Listing files in the configured Box folder"
      }
    );

    for (const entry of result.entries || []) {
      if (entry.type === "file") {
        files.push(entry);
      }
    }

    marker = result.next_marker || undefined;
  } while (marker);

  return files;
}

async function getFileInfo(fileId) {
  if (!fileId) {
    throw new Error("A Box file ID is required");
  }

  const query = new URLSearchParams({
    fields: "id,type,name,size,sha1,modified_at,parent"
  });

  return boxJson(
    `${boxApiUrl}/files/${encodeURIComponent(fileId)}?${query}`,
    {
      action: `Reading Box file ${fileId}`
    }
  );
}

function requireFileInConfiguredFolder(file) {
  if (String(file.parent?.id) !== String(folderId)) {
    throw new Error(
      `Box file ${file.id} is not directly inside BOX_FOLDER_ID ${folderId}`
    );
  }
}

async function uploadFile(
  fileBody,
  originalName,
  contentType = "application/octet-stream"
) {
  requireBoxConfiguration();
  validateFile(fileBody, originalName);

  const { filename, hash } = createStoredName(fileBody, originalName);
  const currentFiles = await listFiles();
  const existing = currentFiles.find((file) =>
    file.name.startsWith(`${hash}-`)
  );

  if (existing) {
    return {
      duplicate: true,
      filename: existing.name,
      hash,
      id: existing.id,
      provider: "box",
      pushed: true,
      sha1: existing.sha1,
      size: existing.size
    };
  }

  const form = new FormData();

  form.append(
    "attributes",
    JSON.stringify({
      name: filename,
      parent: {
        id: folderId
      }
    })
  );

  form.append(
    "file",
    new Blob([fileBody], {
      type: contentType || "application/octet-stream"
    }),
    filename
  );

  const result = await boxJson(`${boxUploadUrl}/files/content`, {
    action: `Uploading ${originalName || filename} to Box`,
    body: form,
    method: "POST"
  });

  const uploaded = result.entries?.[0];

  if (!uploaded) {
    throw new Error("Box did not return an uploaded file");
  }

  return {
    duplicate: false,
    filename: uploaded.name,
    hash,
    id: uploaded.id,
    provider: "box",
    pushed: true,
    sha1: uploaded.sha1,
    size: uploaded.size
  };
}

async function uploadFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("No files were supplied");
  }

  for (const file of files) {
    validateFile(file.body, file.filename);
  }

  const uploadedFiles = [];

  for (const file of files) {
    uploadedFiles.push(
      await uploadFile(file.body, file.filename, file.contentType)
    );
  }

  return {
    images: uploadedFiles,
    provider: "box",
    pushed: true
  };
}

async function findAvailableDownloadPath(destinationDirectory, filename) {
  const safeName = path.basename(filename);
  const extension = path.extname(safeName);
  const stem = path.basename(safeName, extension);

  let candidate = path.join(destinationDirectory, safeName);
  let suffix = 1;

  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(
        destinationDirectory,
        `${stem}-${suffix}${extension}`
      );
      suffix += 1;
    } catch (error) {
      if (error.code === "ENOENT") {
        return candidate;
      }

      throw error;
    }
  }
}

async function downloadFile(fileId, destinationDirectory) {
  requireBoxConfiguration();

  const file = await getFileInfo(fileId);
  requireFileInConfiguredFolder(file);

  const destination = path.resolve(destinationDirectory);
  await fs.mkdir(destination, { recursive: true });

  const localPath = await findAvailableDownloadPath(destination, file.name);
  const response = await boxFetch(
    `${boxApiUrl}/files/${encodeURIComponent(fileId)}/content`,
    {
      action: `Downloading Box file ${fileId}`
    }
  );
  const fileBody = Buffer.from(await response.arrayBuffer());

  await fs.writeFile(localPath, fileBody, {
    flag: "wx"
  });

  return {
    filename: file.name,
    id: file.id,
    localPath,
    provider: "box",
    size: fileBody.length
  };
}

async function downloadFiles(fileIds, destinationDirectory) {
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    throw new Error("No Box file IDs were supplied");
  }

  const downloaded = [];

  for (const fileId of fileIds) {
    downloaded.push(await downloadFile(fileId, destinationDirectory));
  }

  return downloaded;
}

async function downloadAllFiles(destinationDirectory) {
  const files = await listFiles();

  if (files.length === 0) {
    return [];
  }

  return downloadFiles(
    files.map((file) => file.id),
    destinationDirectory
  );
}

async function deleteFile(fileId) {
  requireBoxConfiguration();

  const file = await getFileInfo(fileId);
  requireFileInConfiguredFolder(file);

  await boxFetch(`${boxApiUrl}/files/${encodeURIComponent(fileId)}`, {
    action: `Deleting Box file ${fileId}`,
    method: "DELETE"
  });

  return {
    filename: file.name,
    id: file.id,
    provider: "box",
    removed: true
  };
}

async function deleteFiles(fileIds) {
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    throw new Error("No Box file IDs were supplied");
  }

  const deleted = [];

  for (const fileId of fileIds) {
    deleted.push(await deleteFile(fileId));
  }

  return deleted;
}

module.exports = {
  deleteFile,
  deleteFiles,
  downloadAllFiles,
  downloadFile,
  downloadFiles,
  getAccessToken,
  getFileInfo,
  listFiles,
  uploadFile,
  uploadFiles,
  uploadImage: uploadFile,
  uploadImages: uploadFiles
};
