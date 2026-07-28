const path = require("node:path");
const { createHash } = require("node:crypto");
const { createReadStream } = require("node:fs");

class FileNamingService {
  createStoredName(fileBody, originalName) {
    const hash = createHash("sha256").update(fileBody).digest("hex");
    const { extension, stem } = this.sanitizeName(originalName);

    return {
      filename: `${stem}${extension}`,
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
      filename: `${stem}${extension}`,
      hash
    };
  }

  async hashFileContents(file, algorithm, encoding = "hex") {
    if (Buffer.isBuffer(file.body)) {
      return createHash(algorithm).update(file.body).digest(encoding);
    }

    return this.hashFile(file.path, algorithm, encoding);
  }

  async createGitBlobHash(file) {
    const hash = createHash("sha1");
    hash.update(`blob ${file.size}\0`);

    if (Buffer.isBuffer(file.body)) {
      return hash.update(file.body).digest("hex");
    }

    return new Promise((resolve, reject) => {
      const stream = createReadStream(file.path);

      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(hash.digest("hex")));
    });
  }

  createAvailableName(filename, existingNames = []) {
    const existing = new Set(
      existingNames.map((name) => String(name).toLowerCase())
    );

    if (!existing.has(filename.toLowerCase())) {
      return filename;
    }

    const extension = path.extname(filename);
    const stem = path.basename(filename, extension);
    let suffix = 2;
    let candidate;

    do {
      candidate = `${stem} (${suffix})${extension}`;
      suffix += 1;
    } while (existing.has(candidate.toLowerCase()));

    return candidate;
  }

  getDisplayName(storedName) {
    return String(storedName || "").replace(/^[a-f0-9]{64}-(?=.)/i, "");
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
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[. ]+$/g, "")
        .slice(0, 120) || "file";

    return { extension, stem };
  }
}

module.exports = { FileNamingService };
