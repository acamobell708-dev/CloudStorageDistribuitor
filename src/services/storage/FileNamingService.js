const path = require("node:path");
const { createHash } = require("node:crypto");
const { createReadStream } = require("node:fs");

class FileNamingService {
  createStoredName(fileBody, originalName) {
    const hash = createHash("sha256").update(fileBody).digest("hex");
    const { extension, stem } = this.sanitizeName(originalName);

    return {
      filename: `${hash}-${stem}${extension}`,
      hash
    };
  }

  async createStoredNameForFile(file) {
    if (Buffer.isBuffer(file.body)) {
      return this.createStoredName(file.body, file.filename);
    }

    const hash = await this.hashFile(file.path, "sha256", "hex");
    const { extension, stem } = this.sanitizeName(file.filename);

    return {
      filename: `${hash}-${stem}${extension}`,
      hash
    };
  }

  hashFile(filePath, algorithm, encoding) {
    return new Promise((resolve, reject) => {
      const hash = createHash(algorithm);
      const stream = createReadStream(filePath);

      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(hash.digest(encoding)));
    });
  }

  sanitizeName(originalName) {
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
}

module.exports = { FileNamingService };
