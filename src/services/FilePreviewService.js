const { Readable } = require("node:stream");
const { ValidationError } = require("../errors/ApplicationError");

let previewPolicyPromise;

function loadPreviewPolicy() {
  previewPolicyPromise ||= import("../shared/filePreviewPolicy.mjs");
  return previewPolicyPromise;
}

function createReadable(body) {
  if (typeof body?.pipe === "function") {
    return body;
  }

  if (typeof body?.getReader === "function") {
    return Readable.fromWeb(body);
  }

  if (Buffer.isBuffer(body) || typeof body === "string") {
    return Readable.from([body]);
  }

  throw new TypeError("The cloud provider returned an invalid file stream");
}

async function cancelBody(body) {
  if (typeof body?.cancel === "function") {
    await body.cancel().catch(() => undefined);
  } else if (typeof body?.destroy === "function") {
    body.destroy();
  }
}

async function readBodyPrefix(body, maximumBytes) {
  const stream = createReadable(body);
  const chunks = [];
  let length = 0;
  let exceeded = false;

  try {
    for await (const value of stream) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      const remaining = maximumBytes - length;

      if (chunk.length > remaining) {
        chunks.push(chunk.subarray(0, Math.max(remaining, 0)));
        length += Math.max(remaining, 0);
        exceeded = true;
        break;
      }

      chunks.push(chunk);
      length += chunk.length;
    }
  } finally {
    if (!stream.readableEnded) {
      stream.destroy();
    }
  }

  return {
    body: Buffer.concat(chunks, length),
    exceeded
  };
}

class FilePreviewService {
  constructor(fileDownloadService) {
    this.fileDownloadService = fileDownloadService;
  }

  normalizeRange(range) {
    if (!range) {
      return undefined;
    }

    const normalized = String(range).trim();

    if (!/^bytes=(?:\d+-\d*|-\d+)$/.test(normalized)) {
      throw new ValidationError("Only one valid byte range can be previewed", {
        code: "INVALID_PREVIEW_RANGE",
        statusCode: 416
      });
    }

    return normalized;
  }

  async getPreview(providerKey, fileReference = {}, options = {}) {
    const { filePreviewLimits, getFilePreviewCapability } =
      await loadPreviewPolicy();
    const range = this.normalizeRange(options.range);
    const download = await this.fileDownloadService.getDownload(
      providerKey,
      {
        ...fileReference,
        ...(range ? { range } : {})
      }
    );
    const capability = getFilePreviewCapability({
      filename: download.filename,
      size: download.size
    });

    if (!capability.available) {
      await cancelBody(download.body);
      throw new ValidationError(capability.reason, {
        code: "PREVIEW_NOT_AVAILABLE",
        statusCode: 415
      });
    }

    if (["source", "text"].includes(capability.kind)) {
      const prefix = await readBodyPrefix(
        download.body,
        filePreviewLimits.textBytes
      );
      const totalSize = Number(download.size);

      return {
        ...download,
        acceptRanges: undefined,
        body: prefix.body,
        contentRange: undefined,
        contentType: capability.contentType,
        kind: capability.kind,
        pageLimit: undefined,
        responseSize: prefix.body.length,
        status: 200,
        truncated:
          prefix.exceeded ||
          (Number.isFinite(totalSize) &&
            totalSize > filePreviewLimits.textBytes)
      };
    }

    return {
      ...download,
      contentType: capability.contentType,
      kind: capability.kind,
      pageLimit:
        capability.kind === "pdf"
          ? filePreviewLimits.pdfPages
          : undefined,
      truncated: false
    };
  }
}

module.exports = {
  FilePreviewService,
  readBodyPrefix
};
