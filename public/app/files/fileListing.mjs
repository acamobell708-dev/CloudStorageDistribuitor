import { getMediaType } from "../dashboard/storageInsights.mjs";

export const fileTypeFilters = Object.freeze([
  { key: "all", label: "All types" },
  { key: "folder", label: "Folders" },
  { key: "image", label: "Images" },
  { key: "video", label: "Videos" },
  { key: "audio", label: "Audio" },
  { key: "document", label: "Documents" },
  { key: "source", label: "Code" },
  { key: "archive", label: "Archives" },
  { key: "other", label: "Other" }
]);

export const fileSortOptions = Object.freeze([
  { key: "name-asc", label: "Name A–Z" },
  { key: "size-desc", label: "Largest first" },
  { key: "size-asc", label: "Smallest first" },
  { key: "updated-desc", label: "Recently updated" },
  { key: "updated-asc", label: "Oldest updated" }
]);

const nameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base"
});

export function getFileCategory(file) {
  return file?.type === "folder" ? "folder" : getMediaType(file);
}

function matchesSearch(file, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [file?.name, file?.path].some((value) =>
    String(value || "").toLowerCase().includes(normalizedQuery)
  );
}

function getTimestamp(file) {
  const timestamp = Date.parse(file?.modifiedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareFiles(first, second, sort) {
  const firstIsFolder = first?.type === "folder";
  const secondIsFolder = second?.type === "folder";

  if (firstIsFolder !== secondIsFolder) {
    return firstIsFolder ? -1 : 1;
  }

  if (sort === "size-desc" || sort === "size-asc") {
    const direction = sort === "size-desc" ? -1 : 1;
    const difference =
      (Number(first?.size) || 0) - (Number(second?.size) || 0);

    if (difference !== 0) {
      return difference * direction;
    }
  }

  if (sort === "updated-desc" || sort === "updated-asc") {
    const direction = sort === "updated-desc" ? -1 : 1;
    const difference = getTimestamp(first) - getTimestamp(second);

    if (difference !== 0) {
      return difference * direction;
    }
  }

  return nameCollator.compare(first?.name || "", second?.name || "");
}

export function createFileListing(files = [], options = {}) {
  const filter = options.filter || "all";
  const sort = options.sort || "name-asc";

  return files
    .filter(
      (file) =>
        (filter === "all" || getFileCategory(file) === filter) &&
        matchesSearch(file, options.query)
    )
    .sort((first, second) => compareFiles(first, second, sort));
}

export function getSearchSuggestions(
  files = [],
  query,
  limit = 5
) {
  const normalizedQuery = String(query || "").trim().toLowerCase();

  if (!normalizedQuery || limit <= 0) {
    return [];
  }

  const prefixMatches = [];
  const otherMatches = [];

  for (const file of files) {
    const name = String(file?.name || "");
    const normalizedName = name.toLowerCase();

    if (!normalizedName.includes(normalizedQuery)) {
      continue;
    }

    const target = normalizedName.startsWith(normalizedQuery)
      ? prefixMatches
      : otherMatches;

    if (target.length < limit) {
      target.push(file);
    }
  }

  return [...prefixMatches, ...otherMatches].slice(0, limit);
}
