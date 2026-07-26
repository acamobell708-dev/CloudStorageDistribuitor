const fs = require("node:fs/promises");
const path = require("node:path");
const { startServer } = require("./testServer");

const builtInPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

const imageTypes = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

async function loadTestImage() {
  const suppliedPath =
    "C:\\Users\\Adam\\Pictures\\NewVersionUltrafiltration.jpg";

  if (!suppliedPath) {
    return {
      body: builtInPng,
      contentType: "image/png",
      filename: "run-all-test.png"
    };
  }

  const absolutePath = path.resolve(suppliedPath);
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

async function runAll() {
  const image = await loadTestImage();
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

runAll().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
