const KIBIBYTE = 1024;
const MEBIBYTE = KIBIBYTE * 1024;
const GIBIBYTE = MEBIBYTE * 1024;
const TEBIBYTE = GIBIBYTE * 1024;

const providerDefinitions = [
  {
    colorKey: "box",
    key: "box",
    label: "Box"
  },
  {
    colorKey: "azure",
    key: "azure",
    label: "Azure"
  }
];

const mediaDefinitions = [
  {
    colorKey: "image",
    key: "image",
    label: "Images"
  },
  {
    colorKey: "video",
    key: "video",
    label: "Video"
  },
  {
    colorKey: "audio",
    key: "audio",
    label: "Audio"
  },
  {
    colorKey: "document",
    key: "document",
    label: "Documents"
  },
  {
    colorKey: "source",
    key: "source",
    label: "Source code"
  },
  {
    colorKey: "archive",
    key: "archive",
    label: "Archives"
  },
  {
    colorKey: "other",
    key: "other",
    label: "Other"
  }
];

const extensionsByMediaType = {
  archive: new Set([
    "7z",
    "bz2",
    "gz",
    "rar",
    "tar",
    "tgz",
    "zip"
  ]),
  audio: new Set([
    "aac",
    "aiff",
    "flac",
    "m4a",
    "mid",
    "midi",
    "mp3",
    "oga",
    "ogg",
    "opus",
    "wav",
    "wma"
  ]),
  document: new Set([
    "csv",
    "doc",
    "docx",
    "md",
    "odp",
    "ods",
    "odt",
    "pdf",
    "ppt",
    "pptx",
    "rtf",
    "txt",
    "xls",
    "xlsx"
  ]),
  image: new Set([
    "avif",
    "bmp",
    "gif",
    "heic",
    "heif",
    "ico",
    "jpeg",
    "jpg",
    "png",
    "svg",
    "tif",
    "tiff",
    "webp"
  ]),
  source: new Set([
    "c",
    "cc",
    "cpp",
    "cs",
    "css",
    "dart",
    "go",
    "gradle",
    "groovy",
    "h",
    "hpp",
    "htm",
    "html",
    "java",
    "js",
    "json",
    "jsx",
    "kt",
    "kts",
    "lua",
    "mjs",
    "php",
    "pl",
    "ps1",
    "py",
    "r",
    "rb",
    "rs",
    "sass",
    "scala",
    "scss",
    "sh",
    "sol",
    "sql",
    "svelte",
    "swift",
    "ts",
    "tsx",
    "vb",
    "vue",
    "xml",
    "yaml",
    "yml"
  ]),
  video: new Set([
    "3g2",
    "3gp",
    "avi",
    "m4v",
    "mkv",
    "mov",
    "mp4",
    "mpeg",
    "mpg",
    "ogv",
    "webm",
    "wmv"
  ])
};

const archiveMimeTypes = new Set([
  "application/gzip",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "application/x-bzip2",
  "application/x-tar",
  "application/zip"
]);

const sourceMimeTypes = new Set([
  "application/javascript",
  "application/json",
  "application/sql",
  "application/typescript",
  "application/xml"
]);

function getExtension(file) {
  const name = String(file?.name || file?.path || "");
  const lastPart = name.split(/[\\/]/).pop() || "";
  const extensionIndex = lastPart.lastIndexOf(".");

  return extensionIndex > 0
    ? lastPart.slice(extensionIndex + 1).toLowerCase()
    : "";
}

function getCategoryFromExtension(extension) {
  return Object.entries(extensionsByMediaType).find(
    ([, extensions]) => extensions.has(extension)
  )?.[0];
}

export function getMediaType(file) {
  const contentType = String(file?.contentType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const extensionCategory = getCategoryFromExtension(
    getExtension(file)
  );

  if (contentType.startsWith("image/")) {
    return "image";
  }

  if (contentType.startsWith("video/")) {
    return "video";
  }

  if (contentType.startsWith("audio/")) {
    return "audio";
  }

  if (
    archiveMimeTypes.has(contentType) ||
    contentType.includes("compressed")
  ) {
    return "archive";
  }

  if (
    sourceMimeTypes.has(contentType) ||
    contentType.includes("script")
  ) {
    return "source";
  }

  if (
    contentType === "application/pdf" ||
    contentType.includes("document") ||
    contentType.includes("presentation") ||
    contentType.includes("sheet")
  ) {
    return "document";
  }

  if (contentType.startsWith("text/")) {
    return extensionCategory === "source" ? "source" : "document";
  }

  return extensionCategory || "other";
}

function normalizeItem(file, provider) {
  const measured = Number.isFinite(file?.size) && file.size >= 0;

  return {
    category: getMediaType(file),
    measured,
    name: file?.name || file?.storedName || "Unnamed file",
    path: file?.path,
    providerKey: provider.key,
    providerLabel: provider.label,
    size: measured ? file.size : 0
  };
}

function summarizeSegment(definition, items, extra = {}) {
  return {
    ...definition,
    ...extra,
    itemCount: items.length,
    items: [...items].sort(
      (first, second) =>
        second.size - first.size ||
        first.name.localeCompare(second.name)
    ),
    value: items.reduce((total, item) => total + item.size, 0)
  };
}

export function createStorageInsights(providerRecords = []) {
  const records = new Map(
    providerRecords.map((record) => [record.key, record])
  );
  const allItems = [];
  const providerSegments = providerDefinitions.map((provider) => {
    const record = records.get(provider.key);
    const items = (record?.files || []).map((file) =>
      normalizeItem(file, provider)
    );

    allItems.push(...items);

    return summarizeSegment(provider, items, {
      available: record?.status === "loaded",
      detail:
        record?.detail ||
        (record?.status === "not-configured"
          ? "Not connected"
          : record?.status === "error"
            ? "Could not refresh"
            : undefined),
      status: record?.status || "unavailable"
    });
  });
  const mediaSegments = mediaDefinitions
    .map((definition) =>
      summarizeSegment(
        definition,
        allItems.filter((item) => item.category === definition.key)
      )
    )
    .filter((segment) => segment.itemCount > 0);
  const totalBytes = allItems.reduce(
    (total, item) => total + item.size,
    0
  );

  return {
    allItems,
    mediaSegments,
    providerSegments,
    totalBytes,
    totalFiles: allItems.length,
    unmeasuredCount: allItems.filter((item) => !item.measured).length
  };
}

export function formatBytes(value) {
  const size = Number(value);

  if (!Number.isFinite(size) || size < 0) {
    return "Unknown";
  }

  if (size < KIBIBYTE) {
    return `${Math.round(size)} B`;
  }

  const units = [
    [TEBIBYTE, "TB"],
    [GIBIBYTE, "GB"],
    [MEBIBYTE, "MB"],
    [KIBIBYTE, "KB"]
  ];
  const [divisor, unit] = units.find(([threshold]) => size >= threshold);
  const amount = size / divisor;
  const precision = amount >= 100 ? 0 : amount >= 10 ? 1 : 2;

  return `${amount.toFixed(precision)} ${unit}`;
}

export { providerDefinitions };
