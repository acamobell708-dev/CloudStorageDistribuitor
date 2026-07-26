const http = require("node:http");
const { uploadImage } = require("./AzureDevopRepoCRUD");

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

async function handleRequest(request, response) {
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "POST" && request.url === "/images") {
    try {
      const image = await readRequestBody(request);
      const result = await uploadImage(
        image,
        request.headers["x-filename"],
        request.headers["content-type"]
      );

      sendJson(response, result.duplicate ? 200 : 201, {
        message:
          result.duplicate && result.pushed
            ? "Existing local image committed and pushed without creating another copy"
            : result.duplicate
              ? "This image was already uploaded; no second copy was created"
              : result.pushed
                ? "Image uploaded, committed, and pushed"
                : "Image stored in the isolated Azure image repository in dry-run mode",
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
  const server = http.createServer(handleRequest);

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
