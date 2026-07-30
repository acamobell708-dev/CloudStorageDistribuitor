const assert = require("node:assert/strict");
const { scryptSync } = require("node:crypto");
const path = require("node:path");
const test = require("node:test");
const { createApp } = require("../../src/app");
const {
  memberPermissions,
  permissions
} = require("../../src/services/auth/permissions");
const {
  UserAccountService
} = require("../../src/services/auth/UserAccountService");

function createTestAccount({
  password,
  permissions: accountPermissions,
  role,
  username
}) {
  const salt = Buffer.from(`integration-${username}-salt`);

  return {
    displayName: username,
    id: username.toLowerCase(),
    passwordHash: scryptSync(password, salt, 64).toString("hex"),
    permissions: accountPermissions,
    role,
    salt: salt.toString("hex"),
    username
  };
}

function createTestApplication(overrides = {}) {
  const createProvider = (key, displayName) => ({
    acceptedFileTypes:
      key === "azure"
        ? ["image/*", "audio/*", "video/*"]
        : ["*/*"],
    browserUploadStorage: key === "azure" ? "memory" : "disk",
    description: `${displayName} test provider`,
    displayName,
    getMaximumUploadSizeBytes: async () =>
      overrides.maximumUploadSizeBytes || 1024,
    getStatus: async () => ({
      acceptedFileTypes:
        key === "azure"
          ? ["image/*", "audio/*", "video/*"]
          : ["*/*"],
      configured: true,
      description: `${displayName} test provider`,
      displayName,
      key,
      listingConfigured: true,
      maximumUploadSizeBytes:
        overrides.maximumUploadSizeBytes || 1024,
      supportedFileActions:
        key === "box"
          ? ["download", "delete"]
          : ["download", "delete", "permanent-delete"]
    }),
    isConfigured: () => true,
    isListingConfigured: () => true,
    key,
    deleteCloudFile: async (fileReference) => {
      overrides.onDelete?.(key, fileReference);

      return {
        filename: `${key}-file.txt`,
        id: fileReference.id,
        provider: key,
        removed: true
      };
    },
    downloadCloudFile: async (fileReference) => {
      const body = Buffer.from(`${key}-download`);

      return {
        body,
        contentType: "text/plain",
        filename: `${key}-file.txt`,
        id: fileReference.id,
        provider: key,
        size: body.length
      };
    },
    permanentlyDeleteCloudFile: async (fileReference) => {
      overrides.onPermanentDelete?.(key, fileReference);

      return {
        filename: `${key}-file.txt`,
        id: fileReference.id,
        path: fileReference.path,
        provider: key,
        removed: true,
        removedFromHistory: true,
        verified: true
      };
    },
    listCloudFiles: async () => [
      {
        id: `${key}-file-1`,
        modifiedAt: "2026-07-28T12:00:00Z",
        name: `${key}-file.txt`,
        path: `/${key}-file.txt`,
        provider: key,
        size: 12,
        version: "version-1"
      }
    ],
    browseCloudFiles: async (folderReference) => {
      overrides.onBrowse?.(key, folderReference);

      return {
        breadcrumbs: [
          {
            id: key === "box" ? "root-folder" : "/",
            name: displayName,
            path: "/"
          }
        ],
        files: [
          {
            id: `${key}-folder-1`,
            name: "Uploaded folder",
            path: "/Uploaded folder",
            provider: key,
            type: "folder"
          }
        ],
        folder: {
          id: key === "box" ? "root-folder" : "/",
          name: displayName,
          path: "/"
        }
      };
    },
    maximumUploadSizeBytes:
      overrides.maximumUploadSizeBytes || 1024,
    supportedFileActions:
      key === "box"
        ? ["download", "delete"]
        : ["download", "delete", "permanent-delete"],
    uploadFile: async (file) => {
      overrides.onUpload?.(key, file);

      return {
        duplicate: false,
        filename: `stored-${file.originalname}`,
        id: key === "box" ? "box-file-1" : undefined,
        originalName: file.originalname,
        path: key === "azure" ? "images/stored-file.png" : undefined,
        provider: key,
        pushed: true,
        size: file.size
      };
    },
    uploadFiles: async (files) => {
      const uploaded = files.map((file, index) => {
        overrides.onUpload?.(key, file);

        return {
          duplicate: false,
          filename: `stored-${file.originalname}`,
          id: `${key}-file-${index + 1}`,
          originalName: file.originalname,
          path:
            key === "azure"
              ? `folders/${file.relativePath}`
              : `/${file.relativePath || file.originalname}`,
          provider: key,
          pushed: true,
          size: file.size
        };
      });

      return {
        files: uploaded,
        provider: key,
        pushed: true
      };
    }
  });
  const providers = new Map([
    ["box", createProvider("box", "Box")],
    ["azure", createProvider("azure", "Azure Repos")]
  ]);
  const providerFactory = {
    get: (key) => providers.get(key),
    list: async () =>
      Promise.all([...providers.values()].map((provider) =>
        provider.getStatus()
      ))
  };
  const environment = {
    azure: {
      purgePat: "purge-pat"
    },
    projectRoot: path.join(__dirname, "missing-build")
  };
  const userAccountService = new UserAccountService([
    createTestAccount({
      password: "owner-test-password",
      permissions: [
        ...memberPermissions,
        permissions.permanentlyDeleteFiles
      ],
      role: "owner",
      username: "TestOwner"
    }),
    createTestAccount({
      password: "member-test-password",
      permissions: memberPermissions,
      role: "member",
      username: "TestMember"
    })
  ]);

  return createApp({
    environment,
    providerFactory,
    userAccountService
  });
}

async function withServer(app, callback) {
  const server = await new Promise((resolve, reject) => {
    const listeningServer = app.listen(0, "127.0.0.1", () =>
      resolve(listeningServer)
    );
    listeningServer.once("error", reject);
  });
  const address = server.address();

  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

async function login(baseUrl, credentials = {}) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    body: JSON.stringify({
      password: credentials.password || "owner-test-password",
      username: credentials.username || "TestOwner"
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const body = await response.json();

  assert.equal(response.status, 200, body.error?.message);
  return response.headers.get("set-cookie").split(";")[0];
}

async function withAuthenticatedServer(
  app,
  callback,
  credentials
) {
  return withServer(app, async (baseUrl) => {
    const cookie = await login(baseUrl, credentials);
    const authenticatedFetch = (url, options = {}) =>
      fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Cookie: cookie
        }
      });

    return callback(baseUrl, authenticatedFetch);
  });
}

test("creates sessions and enforces guest storage restrictions", async () => {
  await withServer(createTestApplication(), async (baseUrl) => {
    const unauthenticated = await fetch(
      `${baseUrl}/api/storage/providers`
    );

    assert.equal(unauthenticated.status, 401);

    const invalidLogin = await fetch(`${baseUrl}/api/auth/login`, {
      body: JSON.stringify({
        password: "incorrect",
        username: "TestOwner"
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    const invalidBody = await invalidLogin.json();

    assert.equal(invalidLogin.status, 401);
    assert.equal(invalidBody.error.code, "INVALID_LOGIN");

    const guestLogin = await fetch(`${baseUrl}/api/auth/guest`, {
      method: "POST"
    });
    const guestBody = await guestLogin.json();
    const guestCookie = guestLogin.headers
      .get("set-cookie")
      .split(";")[0];

    assert.equal(guestBody.user.role, "guest");
    assert.equal(
      guestLogin.headers.get("set-cookie").includes("HttpOnly"),
      true
    );
    assert.equal(
      guestLogin.headers.get("set-cookie").includes("SameSite=Strict"),
      true
    );

    const providerResponse = await fetch(
      `${baseUrl}/api/storage/providers`,
      {
        headers: {
          Cookie: guestCookie
        }
      }
    );
    const listResponse = await fetch(
      `${baseUrl}/api/storage/box/files`,
      {
        headers: {
          Cookie: guestCookie
        }
      }
    );
    const downloadResponse = await fetch(
      `${baseUrl}/api/storage/box/files/box-file-1/download`,
      {
        headers: {
          Cookie: guestCookie
        }
      }
    );
    const uploadResponse = await fetch(
      `${baseUrl}/api/storage/box/files`,
      {
        headers: {
          Cookie: guestCookie
        },
        method: "POST"
      }
    );
    const deleteResponse = await fetch(
      `${baseUrl}/api/storage/box/files/box-file-1`,
      {
        headers: {
          Cookie: guestCookie
        },
        method: "DELETE"
      }
    );

    assert.equal(providerResponse.status, 200);
    assert.deepEqual(
      [
        listResponse.status,
        downloadResponse.status,
        uploadResponse.status,
        deleteResponse.status
      ],
      [403, 403, 403, 403]
    );
    assert.equal(
      (await listResponse.json()).error.code,
      "INSUFFICIENT_PERMISSION"
    );

    const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
      headers: {
        Cookie: guestCookie
      },
      method: "POST"
    });
    const sessionResponse = await fetch(
      `${baseUrl}/api/auth/session`,
      {
        headers: {
          Cookie: guestCookie
        }
      }
    );

    assert.equal(logoutResponse.status, 200);
    assert.equal((await sessionResponse.json()).authenticated, false);
  });
});

test("reports API health and configured storage providers", async () => {
  await withAuthenticatedServer(
    createTestApplication(),
    async (baseUrl, authenticatedFetch) => {
    const health = await authenticatedFetch(
      `${baseUrl}/api/health`
    ).then((response) => response.json());
    const providers = await authenticatedFetch(
      `${baseUrl}/api/storage/providers`
    ).then((response) => response.json());

    assert.equal(health.status, "ok");
    assert.equal(providers.providers[0].key, "box");
    assert.equal(providers.providers[0].configured, true);
    assert.deepEqual(
      providers.providers[0].supportedFileActions,
      ["download", "delete"]
    );
    assert.equal(providers.providers[1].key, "azure");
    assert.deepEqual(
      providers.providers[1].supportedFileActions,
      ["download", "delete", "permanent-delete"]
    );
    }
  );
});

test("routes a media upload to the selected Azure provider", async () => {
  let receivedFile;
  const app = createTestApplication({
    onUpload: (providerKey, file) => {
      if (providerKey === "azure") {
        receivedFile = file;
      }
    }
  });

  await withAuthenticatedServer(app, async (baseUrl, authenticatedFetch) => {
    const form = new FormData();
    form.append(
      "file",
      new Blob(["image"], { type: "image/png" }),
      "photo.png"
    );

    const response = await authenticatedFetch(`${baseUrl}/api/storage/azure/files`, {
      body: form,
      method: "POST"
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.file.provider, "azure");
    assert.equal(body.file.path, "images/stored-file.png");
    assert.equal(body.message, "photo.png was sent to Azure Repos");
    assert.equal(Buffer.isBuffer(receivedFile.buffer), true);
    assert.equal(receivedFile.path, undefined);
    assert.equal(receivedFile.temporary, false);
  });
});

test("lists current cloud files through the selected provider", async () => {
  await withAuthenticatedServer(
    createTestApplication(),
    async (baseUrl, authenticatedFetch) => {
    const response = await authenticatedFetch(
      `${baseUrl}/api/storage/azure/files`
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.source, "cloud");
    assert.equal(body.provider.key, "azure");
    assert.equal(body.files.length, 1);
    assert.equal(body.files[0].name, "azure-file.txt");
    assert.equal(body.files[0].size, 12);
    assert.match(body.refreshedAt, /^\d{4}-\d{2}-\d{2}T/);
    }
  );
});

test("browses a cloud folder through the shared listing route", async () => {
  let browsedFolder;
  const app = createTestApplication({
    onBrowse: (providerKey, folderReference) => {
      assert.equal(providerKey, "box");
      browsedFolder = folderReference;
    }
  });

  await withAuthenticatedServer(app, async (baseUrl, authenticatedFetch) => {
    const response = await authenticatedFetch(
      `${baseUrl}/api/storage/box/files?` +
        new URLSearchParams({
          browse: "true",
          folderId: "folder-123",
          path: "/Uploaded folder"
        })
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.files[0].type, "folder");
    assert.equal(body.folder.path, "/");
    assert.deepEqual(browsedFolder, {
      id: "folder-123",
      path: "/Uploaded folder"
    });
  });
});

test("streams a selected cloud file to the browser as an attachment", async () => {
  await withAuthenticatedServer(
    createTestApplication(),
    async (baseUrl, authenticatedFetch) => {
    const response = await authenticatedFetch(
      `${baseUrl}/api/storage/azure/files/azure-file-1/download?` +
        new URLSearchParams({ path: "/azure-file.txt" })
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/plain/);
    assert.match(
      response.headers.get("content-disposition"),
      /attachment; filename="azure-file\.txt"/
    );
    assert.equal(await response.text(), "azure-download");
    }
  );
});

test("deletes a selected Box file through the shared storage route", async () => {
  let deletedReference;
  const app = createTestApplication({
    onDelete: (providerKey, fileReference) => {
      assert.equal(providerKey, "box");
      deletedReference = fileReference;
    }
  });

  await withAuthenticatedServer(app, async (baseUrl, authenticatedFetch) => {
    const response = await authenticatedFetch(
      `${baseUrl}/api/storage/box/files/box-file-1?` +
        new URLSearchParams({ path: "/box-file.txt" }),
      {
        method: "DELETE"
      }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.file.removed, true);
    assert.equal(body.message, "box-file.txt was deleted from Box");
    assert.deepEqual(deletedReference, {
      id: "box-file-1",
      path: "/box-file.txt"
    });
  });
});

test("creates a normal deletion for a selected Azure file", async () => {
  let deletedReference;
  const app = createTestApplication({
    onDelete: (providerKey, fileReference) => {
      assert.equal(providerKey, "azure");
      deletedReference = fileReference;
    }
  });

  await withAuthenticatedServer(app, async (baseUrl, authenticatedFetch) => {
    const response = await authenticatedFetch(
      `${baseUrl}/api/storage/azure/files/azure-file-1?` +
        new URLSearchParams({ path: "/azure-file.txt" }),
      {
        method: "DELETE"
      }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.file.removed, true);
    assert.equal(
      body.message,
      "azure-file.txt was deleted from Azure Repos"
    );
    assert.deepEqual(deletedReference, {
      id: "azure-file-1",
      path: "/azure-file.txt"
    });
  });
});

test("requires the owner account before permanently deleting Azure history", async () => {
  let permanentDeleteCount = 0;
  const app = createTestApplication({
    onPermanentDelete: () => {
      permanentDeleteCount += 1;
    }
  });
  const url =
    "/api/storage/azure/files/azure-file-1/history?" +
    new URLSearchParams({ path: "/azure-file.txt" });

  await withServer(app, async (baseUrl) => {
    const memberCookie = await login(baseUrl, {
      password: "member-test-password",
      username: "TestMember"
    });
    const deniedResponse = await fetch(`${baseUrl}${url}`, {
      headers: {
        Cookie: memberCookie
      },
      method: "DELETE"
    });
    const deniedBody = await deniedResponse.json();

    assert.equal(deniedResponse.status, 403);
    assert.equal(
      deniedBody.error.code,
      "INSUFFICIENT_PERMISSION"
    );
    assert.equal(permanentDeleteCount, 0);

    const ownerCookie = await login(baseUrl);
    const response = await fetch(`${baseUrl}${url}`, {
      headers: {
        Cookie: ownerCookie
      },
      method: "DELETE"
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.file.removedFromHistory, true);
    assert.match(body.message, /reachable history/);
    assert.equal(permanentDeleteCount, 1);
  });
});

test("accepts a browser multipart upload and returns the Box result", async () => {
  await withAuthenticatedServer(
    createTestApplication(),
    async (baseUrl, authenticatedFetch) => {
    const form = new FormData();
    form.append(
      "file",
      new Blob(["hello"], { type: "text/plain" }),
      "hello.txt"
    );

    const response = await authenticatedFetch(`${baseUrl}/api/storage/box/files`, {
      body: form,
      method: "POST"
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.file.id, "box-file-1");
    assert.equal(body.file.originalName, "hello.txt");
    assert.equal(body.message, "hello.txt was sent to Box");
    }
  );
});

test("accepts multiple browser files through the shared upload route", async () => {
  const receivedFiles = [];
  const app = createTestApplication({
    onUpload: (providerKey, file) => {
      assert.equal(providerKey, "box");
      receivedFiles.push(file);
    }
  });

  await withAuthenticatedServer(app, async (baseUrl, authenticatedFetch) => {
    const form = new FormData();
    form.append("files", new Blob(["one"]), "one.txt");
    form.append("files", new Blob(["two"]), "two.txt");
    form.append(
      "manifest",
      JSON.stringify({
        mode: "multiple",
        paths: ["one.txt", "two.txt"]
      })
    );

    const response = await authenticatedFetch(
      `${baseUrl}/api/storage/box/files`,
      {
        body: form,
        method: "POST"
      }
    );
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.files.length, 2);
    assert.equal(body.mode, "multiple");
    assert.equal(body.message, "2 files were sent to Box");
    assert.equal(receivedFiles.length, 2);
    assert.equal(receivedFiles[0].relativePath, undefined);
  });
});

test("preserves safe relative paths for a browser folder upload", async () => {
  const receivedFiles = [];
  const app = createTestApplication({
    onUpload: (providerKey, file) => {
      assert.equal(providerKey, "azure");
      receivedFiles.push(file);
    }
  });

  await withAuthenticatedServer(app, async (baseUrl, authenticatedFetch) => {
    const form = new FormData();
    form.append("files", new Blob(["cover"]), "cover.png");
    form.append("files", new Blob(["notes"]), "notes.txt");
    form.append(
      "manifest",
      JSON.stringify({
        mode: "folder",
        paths: ["Album/cover.png", "Album/Notes/notes.txt"]
      })
    );

    const response = await authenticatedFetch(
      `${baseUrl}/api/storage/azure/files`,
      {
        body: form,
        method: "POST"
      }
    );
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.mode, "folder");
    assert.equal(
      body.message,
      "Album (2 files) was sent to Azure Repos"
    );
    assert.deepEqual(
      receivedFiles.map((file) => file.relativePath),
      ["Album/cover.png", "Album/Notes/notes.txt"]
    );
  });
});

test("rejects a browser upload above the server limit", async () => {
  await withAuthenticatedServer(
    createTestApplication({ maximumUploadSizeBytes: 3 }),
    async (baseUrl, authenticatedFetch) => {
      const form = new FormData();
      form.append("file", new Blob(["four"]), "too-large.txt");

      const response = await authenticatedFetch(`${baseUrl}/api/storage/box/files`, {
        body: form,
        method: "POST"
      });
      const body = await response.json();

      assert.equal(response.status, 413);
      assert.equal(body.error.code, "FILE_TOO_LARGE");
    }
  );
});
