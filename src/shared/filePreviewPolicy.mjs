const MEBIBYTE = 1024 * 1024;

export const filePreviewLimits = Object.freeze({
  audioBytes: 50 * MEBIBYTE,
  imageBytes: 15 * MEBIBYTE,
  pdfBytes: 25 * MEBIBYTE,
  pdfPages: 50,
  textBytes: 256 * 1024,
  videoBytes: 100 * MEBIBYTE
});

const previewTypes = Object.freeze({
  aac: ["audio", "audio/aac"],
  aiff: ["audio", "audio/aiff"],
  "3g2": ["video", "video/3gpp2"],
  "3gp": ["video", "video/3gpp"],
  avi: ["video", "video/x-msvideo"],
  avif: ["image", "image/avif"],
  bmp: ["image", "image/bmp"],
  c: ["source", "text/plain; charset=utf-8"],
  cc: ["source", "text/plain; charset=utf-8"],
  cpp: ["source", "text/plain; charset=utf-8"],
  cs: ["source", "text/plain; charset=utf-8"],
  css: ["source", "text/plain; charset=utf-8"],
  csv: ["text", "text/plain; charset=utf-8"],
  dart: ["source", "text/plain; charset=utf-8"],
  flac: ["audio", "audio/flac"],
  gif: ["image", "image/gif"],
  go: ["source", "text/plain; charset=utf-8"],
  gradle: ["source", "text/plain; charset=utf-8"],
  groovy: ["source", "text/plain; charset=utf-8"],
  h: ["source", "text/plain; charset=utf-8"],
  hpp: ["source", "text/plain; charset=utf-8"],
  htm: ["source", "text/plain; charset=utf-8"],
  html: ["source", "text/plain; charset=utf-8"],
  heic: ["image", "image/heic"],
  heif: ["image", "image/heif"],
  ico: ["image", "image/x-icon"],
  java: ["source", "text/plain; charset=utf-8"],
  jpeg: ["image", "image/jpeg"],
  jpg: ["image", "image/jpeg"],
  js: ["source", "text/plain; charset=utf-8"],
  json: ["source", "text/plain; charset=utf-8"],
  jsx: ["source", "text/plain; charset=utf-8"],
  kt: ["source", "text/plain; charset=utf-8"],
  kts: ["source", "text/plain; charset=utf-8"],
  lua: ["source", "text/plain; charset=utf-8"],
  m4a: ["audio", "audio/mp4"],
  m4v: ["video", "video/mp4"],
  md: ["text", "text/plain; charset=utf-8"],
  mid: ["audio", "audio/midi"],
  midi: ["audio", "audio/midi"],
  mkv: ["video", "video/x-matroska"],
  mjs: ["source", "text/plain; charset=utf-8"],
  mov: ["video", "video/quicktime"],
  mp3: ["audio", "audio/mpeg"],
  mp4: ["video", "video/mp4"],
  mpeg: ["video", "video/mpeg"],
  mpg: ["video", "video/mpeg"],
  oga: ["audio", "audio/ogg"],
  ogg: ["audio", "audio/ogg"],
  ogv: ["video", "video/ogg"],
  opus: ["audio", 'audio/ogg; codecs="opus"'],
  pdf: ["pdf", "application/pdf"],
  php: ["source", "text/plain; charset=utf-8"],
  pl: ["source", "text/plain; charset=utf-8"],
  png: ["image", "image/png"],
  ps1: ["source", "text/plain; charset=utf-8"],
  py: ["source", "text/plain; charset=utf-8"],
  r: ["source", "text/plain; charset=utf-8"],
  rb: ["source", "text/plain; charset=utf-8"],
  rs: ["source", "text/plain; charset=utf-8"],
  sass: ["source", "text/plain; charset=utf-8"],
  scala: ["source", "text/plain; charset=utf-8"],
  scss: ["source", "text/plain; charset=utf-8"],
  sh: ["source", "text/plain; charset=utf-8"],
  sol: ["source", "text/plain; charset=utf-8"],
  sql: ["source", "text/plain; charset=utf-8"],
  svelte: ["source", "text/plain; charset=utf-8"],
  svg: ["image", "image/svg+xml"],
  swift: ["source", "text/plain; charset=utf-8"],
  tif: ["image", "image/tiff"],
  tiff: ["image", "image/tiff"],
  ts: ["source", "text/plain; charset=utf-8"],
  tsx: ["source", "text/plain; charset=utf-8"],
  txt: ["text", "text/plain; charset=utf-8"],
  vb: ["source", "text/plain; charset=utf-8"],
  vue: ["source", "text/plain; charset=utf-8"],
  wav: ["audio", "audio/wav"],
  weba: ["audio", "audio/webm"],
  webm: ["video", "video/webm"],
  webp: ["image", "image/webp"],
  wma: ["audio", "audio/x-ms-wma"],
  wmv: ["video", "video/x-ms-wmv"],
  xml: ["source", "text/plain; charset=utf-8"],
  yaml: ["source", "text/plain; charset=utf-8"],
  yml: ["source", "text/plain; charset=utf-8"]
});

const officeExtensions = new Set([
  "doc",
  "docx",
  "odp",
  "ods",
  "odt",
  "ppt",
  "pptx",
  "rtf",
  "xls",
  "xlsx"
]);

const archiveExtensions = new Set([
  "7z",
  "bz2",
  "gz",
  "rar",
  "tar",
  "tgz",
  "zip"
]);

function getExtension(file) {
  const filename = String(file?.name || file?.filename || file?.path || "");
  const basename = filename.split(/[\\/]/).pop() || "";
  const extensionIndex = basename.lastIndexOf(".");

  return extensionIndex > 0
    ? basename.slice(extensionIndex + 1).toLowerCase()
    : "";
}

function getMaximumBytes(kind) {
  if (kind === "source" || kind === "text") {
    return filePreviewLimits.textBytes;
  }

  return filePreviewLimits[`${kind}Bytes`];
}

export function getFilePreviewCapability(file) {
  if (file?.type === "folder") {
    return {
      available: false,
      reason: "Folders are opened rather than previewed"
    };
  }

  const extension = getExtension(file);
  const definition = previewTypes[extension];

  if (!definition) {
    return {
      available: false,
      reason: officeExtensions.has(extension)
        ? "Office documents are download-only"
        : archiveExtensions.has(extension)
          ? "Archives are download-only"
          : "This file type does not have a safe browser preview"
    };
  }

  const [kind, contentType] = definition;
  const maximumBytes = getMaximumBytes(kind);
  const size = Number(file?.size);
  const sizeKnown = Number.isFinite(size) && size >= 0;
  const truncatesText = kind === "source" || kind === "text";

  if (!truncatesText && !sizeKnown) {
    return {
      available: false,
      contentType,
      kind,
      maximumBytes,
      reason: "The file size must be known before it can be previewed"
    };
  }

  if (!truncatesText && size > maximumBytes) {
    return {
      available: false,
      contentType,
      kind,
      maximumBytes,
      reason: "This file is above the safe preview size"
    };
  }

  return {
    available: true,
    contentType,
    extension,
    kind,
    maximumBytes,
    truncated: truncatesText && sizeKnown && size > maximumBytes
  };
}

export function browserCanRenderPreview(
  capability,
  documentObject = globalThis.document
) {
  if (
    !capability?.available ||
    !["audio", "video"].includes(capability.kind) ||
    !documentObject
  ) {
    return Boolean(capability?.available);
  }

  const mediaElement = documentObject.createElement(capability.kind);
  return mediaElement.canPlayType(capability.contentType) !== "";
}
