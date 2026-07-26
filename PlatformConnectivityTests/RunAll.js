const fs = require("node:fs/promises");
const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");
const { startServer } = require("./testServer");
const {
  removeImagesFromLastCommit
} = require("./AzureDevopRepoCRUD");

const imageTypes = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

async function loadImage(suppliedPath) {
  const unquotedPath = suppliedPath.trim().replace(/^"(.*)"$/, "$1");
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

async function uploadImage(suppliedPath) {
  const image = await loadImage(suppliedPath);
  const server = await startServer({ host: "127.0.0.1", port: 0 });
  const address = server.address();

  console.log(`Server started on http://127.0.0.1:${address.port}`);

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
      throw new Error(result.error || `Upload failed with status ${response.status}`);
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

async function runAll() {
  const terminal = readline.createInterface({ input, output });
  let choice;
  let suppliedPath;

  try {
    console.log("1. Upload an image");
    console.log("2. Remove images added by the last Azure commit");
    choice = (await terminal.question("Choose an option: ")).trim();

    if (choice === "1") {
      suppliedPath = await terminal.question("Enter the image path: ");
    }
  } finally {
    terminal.close();
  }

  if (choice === "1") {
    await uploadImage(suppliedPath);
    return;
  }

  if (choice === "2") {
    const result = await removeImagesFromLastCommit();
    console.log("Removed and pushed:");
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  throw new Error("Please enter either 1 or 2");
}

runAll().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
