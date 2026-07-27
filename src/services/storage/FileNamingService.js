const path = require("node:path");
const { createHash } = require("node:crypto");

class FileNamingService {
  createStoredName(fileBody, originalName) {
    const hash = createHash("sha256").update(fileBody).digest("hex");
    const { extension, stem } = this.sanitizeName(originalName);

    return {
      filename: `${hash}-${stem}${extension}`,
      hash
    };
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
