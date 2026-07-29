const fs = require("node:fs/promises");
const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");
const { startServer } = require("./testServer");
const {
  removeImagesFromLastCommit,
  uploadImages: uploadAzureImages
} = require("./AzureDevopRepoCRUD");
const {
  deleteFile: deleteBoxFile,
  deleteFiles: deleteBoxFiles,
  downloadAllFiles: downloadAllBoxFiles,
  downloadFile: downloadBoxFile,
  downloadFiles: downloadBoxFiles,
  listFiles: listBoxFiles,
  uploadImages: uploadBoxImages
} = require("./BoxCRUDTest");

const codeRepoRoot = path.resolve(__dirname, "..");
const defaultBoxDownloadDirectory = path.resolve(
  codeRepoRoot,
  process.env.BOX_DOWNLOAD_DIR || ".box-downloads"
);

const imageTypes = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

function removeSurroundingQuotes(value) {
  return value.trim().replace(/^"(.*)"$/, "$1");
}

async function loadImage(suppliedPath) {
  const unquotedPath = removeSurroundingQuotes(suppliedPath);
  const absolutePath = path.resolve(unquotedPath);
  const extension = path.extname(absolutePath).toLowerCase();
  const contentType = imageTypes[extension];

  if (!contentType) {
    throw new Error("Supported test images are GIF, JPEG, PNG, and WebP");
  }

  return {
    body: await fs.readFile(absolutePath),
    contentType,
    filename: path.basename(absolutePath)
  };
}

async function findImagesInFolder(suppliedPath) {
  const unquotedPath = removeSurroundingQuotes(suppliedPath);
  const folderPath = path.resolve(unquotedPath);
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const images = [];

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name)
  )) {
    const entryPath = path.join(folderPath, entry.name);

    if (entry.isDirectory()) {
      images.push(...(await findImagesInFolder(entryPath)));
      continue;
    }

    if (
      entry.isFile() &&
      imageTypes[path.extname(entry.name).toLowerCase()]
    ) {
      images.push(await loadImage(entryPath));
    }
  }

  return images;
}

async function uploadImageThroughServer(provider, suppliedPath) {
  const image = await loadImage(suppliedPath);
  const server = await startServer({
    host: "127.0.0.1",
    port: 0,
    provider
  });
  const address = server.address();

  console.log(
    `Server started for ${provider} at http://127.0.0.1:${address.port}`
  );

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/images`,
      {
        method: "POST",
        headers: {
          "Content-Type": image.contentType,
          "X-Filename": image.filename
        },
        body: image.body
      }
    );
    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || `Upload failed with status ${response.status}`
      );
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    console.log("Server stopped");
  }
}

function printUploadResult(result) {
  const newImages = result.images.filter((image) => !image.duplicate).length;
  const duplicates = result.images.length - newImages;

  console.log(
    `Processed ${result.images.length} image(s): ` +
      `${newImages} new, ${duplicates} duplicate(s).`
  );
  console.log(JSON.stringify(result, null, 2));
}

async function uploadImageFolder(provider, suppliedPath) {
  const images = await findImagesInFolder(suppliedPath);

  if (images.length === 0) {
    throw new Error("The folder does not contain any supported images");
  }

  const uploadImages =
    provider === "azure" ? uploadAzureImages : uploadBoxImages;
  const result = await uploadImages(images);

  printUploadResult(result);
}

async function askForMultipleImagePaths(terminal) {
  const suppliedCount = (
    await terminal.question("How many images do you want to upload? ")
  ).trim();
  const count = Number(suppliedCount);

  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error("Enter a whole number between 1 and 100");
  }

  const images = [];

  for (let index = 0; index < count; index += 1) {
    const suppliedPath = await terminal.question(
      `Enter path ${index + 1} of ${count}: `
    );

    images.push(await loadImage(suppliedPath));
  }

  return images;
}

function parseBoxFileIds(suppliedIds) {
  const ids = suppliedIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    throw new Error("Enter at least one Box file ID");
  }

  for (const id of ids) {
    if (!/^\d+$/.test(id)) {
      throw new Error(`Invalid Box file ID: ${id}`);
    }
  }

  return [...new Set(ids)];
}

function resolveDownloadDirectory(suppliedPath) {
  if (!suppliedPath.trim()) {
    return defaultBoxDownloadDirectory;
  }

  return path.resolve(removeSurroundingQuotes(suppliedPath));
}

function formatBytes(size) {
  if (!Number.isFinite(size)) {
    return "unknown";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function displayBoxFiles() {
  const files = await listBoxFiles();

  if (files.length === 0) {
    console.log("The configured Box folder is empty");
    return files;
  }

  console.table(
    files.map((file) => ({
      id: file.id,
      modified: file.modified_at,
      name: file.name,
      size: formatBytes(file.size)
    }))
  );

  return files;
}

async function askForDownloadDirectory(terminal) {
  const suppliedPath = await terminal.question(
    `Download directory [${defaultBoxDownloadDirectory}]: `
  );

  return resolveDownloadDirectory(suppliedPath);
}

async function confirmBoxDeletion(terminal, count) {
  const confirmation = await terminal.question(
    `This will delete ${count} Box file(s). Type DELETE to continue: `
  );

  return confirmation.trim() === "DELETE";
}

async function runAzureMenu(terminal) {
  console.log("");
  console.log("Azure DevOps Repos");
  console.log("1. Push one image");
  console.log("2. Remove images added by the last Azure commit");
  console.log("3. Push an image folder recursively");

  const choice = (
    await terminal.question("Choose an Azure option: ")
  ).trim();

  if (choice === "1") {
    const suppliedPath = await terminal.question("Enter the image path: ");
    await uploadImageThroughServer("azure", suppliedPath);
    return;
  }

  if (choice === "2") {
    const result = await removeImagesFromLastCommit();

    console.log("Removed and pushed:");
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (choice === "3") {
    const suppliedPath = await terminal.question("Enter the folder path: ");
    await uploadImageFolder("azure", suppliedPath);
    return;
  }

  throw new Error("Please enter 1, 2, or 3");
}

async function runBoxMenu(terminal) {
  console.log("");
  console.log("Box");
  console.log("1. Push one image");
  console.log("2. Push multiple selected images");
  console.log("3. Push an image folder recursively");
  console.log("4. List Box files and IDs");
  console.log("5. Pull one Box file");
  console.log("6. Pull multiple Box files");
  console.log("7. Pull every file in the Box folder");
  console.log("8. Delete one Box file");
  console.log("9. Delete multiple Box files");

  const choice = (
    await terminal.question("Choose a Box option: ")
  ).trim();

  if (choice === "1") {
    const suppliedPath = await terminal.question("Enter the image path: ");
    await uploadImageThroughServer("box", suppliedPath);
    return;
  }

  if (choice === "2") {
    const images = await askForMultipleImagePaths(terminal);
    const result = await uploadBoxImages(images);

    printUploadResult(result);
    return;
  }

  if (choice === "3") {
    const suppliedPath = await terminal.question("Enter the folder path: ");
    await uploadImageFolder("box", suppliedPath);
    return;
  }

  if (choice === "4") {
    await displayBoxFiles();
    return;
  }

  if (choice === "5") {
    await displayBoxFiles();

    const fileId = (
      await terminal.question("Enter the Box file ID to pull: ")
    ).trim();
    const destination = await askForDownloadDirectory(terminal);
    const result = await downloadBoxFile(fileId, destination);

    console.log("Downloaded:");
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (choice === "6") {
    await displayBoxFiles();

    const suppliedIds = await terminal.question(
      "Enter Box file IDs separated by commas: "
    );
    const destination = await askForDownloadDirectory(terminal);
    const results = await downloadBoxFiles(
      parseBoxFileIds(suppliedIds),
      destination
    );

    console.log("Downloaded:");
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (choice === "7") {
    const destination = await askForDownloadDirectory(terminal);
    const results = await downloadAllBoxFiles(destination);

    console.log(`Downloaded ${results.length} Box file(s)`);
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (choice === "8") {
    await displayBoxFiles();

    const fileId = (
      await terminal.question("Enter the Box file ID to delete: ")
    ).trim();

    if (!(await confirmBoxDeletion(terminal, 1))) {
      console.log("Deletion cancelled");
      return;
    }

    const result = await deleteBoxFile(fileId);

    console.log("Deleted:");
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (choice === "9") {
    await displayBoxFiles();

    const suppliedIds = await terminal.question(
      "Enter Box file IDs separated by commas: "
    );
    const fileIds = parseBoxFileIds(suppliedIds);

    if (!(await confirmBoxDeletion(terminal, fileIds.length))) {
      console.log("Deletion cancelled");
      return;
    }

    const results = await deleteBoxFiles(fileIds);

    console.log("Deleted:");
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  throw new Error("Please enter a Box option from 1 to 9");
}

async function runAll() {
  const terminal = readline.createInterface({ input, output });

  try {
    console.log("Storage provider");
    console.log("1. Azure DevOps Repos");
    console.log("2. Box");

    const providerChoice = (
      await terminal.question("Choose a storage provider: ")
    ).trim();

    if (providerChoice === "1") {
      await runAzureMenu(terminal);
      return;
    }

    if (providerChoice === "2") {
      await runBoxMenu(terminal);
      return;
    }

    throw new Error("Please enter 1 for Azure or 2 for Box");
  } finally {
    terminal.close();
  }
}

runAll().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
