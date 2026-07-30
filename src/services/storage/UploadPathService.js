const path = require("node:path");
const { ValidationError } = require("../../errors/ApplicationError");

const uploadModes = new Set(["single", "multiple", "folder"]);

class UploadPathService {
  parseManifest(value, fileCount) {
    if (!value) {
      if (fileCount !== 1) {
        throw new ValidationError(
          "Upload metadata is required when sending more than one file"
        );
      }

      return {
        mode: "single",
        paths: []
      };
    }

    let manifest;

    try {
      manifest = JSON.parse(value);
    } catch {
      throw new ValidationError("The upload metadata is not valid JSON");
    }

    if (!uploadModes.has(manifest?.mode)) {
      throw new ValidationError(
        "Choose single file, multiple files, or folder upload mode"
      );
    }

    if (manifest.mode === "single" && fileCount !== 1) {
      throw new ValidationError(
        "Single-file upload mode accepts exactly one file"
      );
    }

    const suppliedPaths = Array.isArray(manifest.paths)
      ? manifest.paths
      : [];

    if (
      manifest.mode === "folder" &&
      suppliedPaths.length !== fileCount
    ) {
      throw new ValidationError(
        "Every folder upload item must include its relative path"
      );
    }

    const paths = suppliedPaths.map((filePath) =>
      this.normalizeRelativePath(filePath)
    );

    if (
      manifest.mode === "folder" &&
      paths.some((filePath) => !filePath.includes("/"))
    ) {
      throw new ValidationError(
        "Folder uploads must include a top-level folder name"
      );
    }

    return {
      mode: manifest.mode,
      paths
    };
  }

  applyManifest(files, manifestValue) {
    const manifest = this.parseManifest(manifestValue, files.length);

    if (manifest.mode === "folder") {
      files.forEach((file, index) => {
        file.relativePath = manifest.paths[index];
      });
    }

    return manifest;
  }

  normalizeRelativePath(value) {
    const suppliedPath = String(value || "")
      .trim()
      .replaceAll("\\", "/");

    if (
      !suppliedPath ||
      suppliedPath.length > 1024 ||
      suppliedPath.startsWith("/") ||
      /^[a-z]:/i.test(suppliedPath) ||
      /[\0\r\n]/.test(suppliedPath)
    ) {
      throw new ValidationError("An uploaded folder path is not safe");
    }

    const segments = suppliedPath.split("/");

    if (
      segments.some(
        (segment) =>
          !segment ||
          segment === "." ||
          segment === ".." ||
          segment.length > 255 ||
          /[\0-\x1f]/.test(segment)
      )
    ) {
      throw new ValidationError("An uploaded folder path is not safe");
    }

    const normalized = path.posix.normalize(segments.join("/"));

    if (
      normalized !== segments.join("/") ||
      normalized.startsWith("../")
    ) {
      throw new ValidationError("An uploaded folder path is not safe");
    }

    return normalized;
  }

  getDirectory(relativePath) {
    if (!relativePath) {
      return "";
    }

    const normalized = this.normalizeRelativePath(relativePath);
    const directory = path.posix.dirname(normalized);
    return directory === "." ? "" : directory;
  }
}

module.exports = { UploadPathService };
