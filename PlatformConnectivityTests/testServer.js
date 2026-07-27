const http = require("node:http");
const {
  uploadImage: uploadAzureImage
} = require("./AzureDevopRepoCRUD");
const {
  uploadImage: uploadBoxImage
} = require("./BoxCRUDTest");

const maximumImageSize = 10 * 1024 * 1024;

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json"
  });
  response.end(JSON.stringify(data, null, 2));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    request.on("data", (chunk) => {
      size += chunk.length;

      if (size > maximumImageSize) {
        tooLarge = true;
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      if (tooLarge) {
        reject(new Error("The image must be no larger than 10 MB"));
        return;
      }

      resolve(Buffer.concat(chunks));
    });

    request.on("error", reject);
  });
}

function getUploader(provider) {
  if (provider === "azure") {
    return uploadAzureImage;
  }

  if (provider === "box") {
    return uploadBoxImage;
  }

  throw new Error(`Unsupported storage provider: ${provider}`);
}

function getUploadMessage(provider, result) {
  if (result.duplicate) {
    if (provider === "azure" && result.pushed) {
      return (
        "Existing local image committed and pushed without creating " +
        "another copy"
      );
    }

    return "This image was already uploaded; no second copy was created";
  }

  if (provider === "box") {
    return "Image uploaded to Box";
  }

  if (result.pushed) {
    return "Image uploaded, committed, and pushed";
  }

  return "Image stored in the isolated Azure data repository in dry-run mode";
}

async function handleRequest(request, response, provider) {
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { provider, status: "ok" });
    return;
  }

  if (request.method === "POST" && request.url === "/images") {
    try {
      const image = await readRequestBody(request);
      const uploadImage = getUploader(provider);
      const result = await uploadImage(
        image,
        request.headers["x-filename"],
        request.headers["content-type"]
      );

      sendJson(response, result.duplicate ? 200 : 201, {
        message: getUploadMessage(provider, result),
        ...result
      });
    } catch (error) {
      console.error(error);
      sendJson(response, 400, { error: error.message });
    }

    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

function startServer(options = {}) {
  const port = options.port ?? Number(process.env.PORT || 3000);
  const host = options.host || process.env.HOST || "127.0.0.1";
  const provider = (
    options.provider ||
    process.env.STORAGE_PROVIDER ||
    "azure"
  ).toLowerCase();

  getUploader(provider);

  const server = http.createServer((request, response) =>
    handleRequest(request, response, provider)
  );

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer()
    .then((server) => {
      const address = server.address();
      console.log(`Test server listening at http://${address.address}:${address.port}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { startServer };
