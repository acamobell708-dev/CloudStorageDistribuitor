import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import {
  createFileListing,
  fileSortOptions,
  fileTypeFilters,
  getFileCategory,
  getSearchSuggestions
} from "./fileListing.mjs";

const suggestionListId = "file-search-suggestions";

export function FileViewControls({
  disabled,
  files,
  filter,
  onFilterChange,
  onReset,
  onSearch,
  onSortChange,
  query,
  resultCount,
  sort
}) {
  const [draftQuery, setDraftQuery] = useState(query);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suggestionFiles = useMemo(
    () => createFileListing(files, { filter, sort }),
    [files, filter, sort]
  );
  const suggestions = useMemo(
    () => getSearchSuggestions(suggestionFiles, draftQuery),
    [draftQuery, suggestionFiles]
  );
  const hasActiveView =
    Boolean(query) || filter !== "all" || sort !== "name-asc";

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  useEffect(() => {
    setActiveSuggestion(-1);
  }, [draftQuery]);

  const applySearch = (value) => {
    const nextQuery = String(value || "").trim();

    setDraftQuery(nextQuery);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    onSearch(nextQuery);
  };

  const handleInputKeyDown = (event) => {
    if (event.key === "Escape") {
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
      return;
    }

    if (
      !["ArrowDown", "ArrowUp"].includes(event.key) ||
      suggestions.length === 0
    ) {
      if (
        event.key === "Enter" &&
        suggestionsOpen &&
        activeSuggestion >= 0
      ) {
        event.preventDefault();
        applySearch(suggestions[activeSuggestion].name);
      }
      return;
    }

    event.preventDefault();
    setSuggestionsOpen(true);
    setActiveSuggestion((current) => {
      const direction = event.key === "ArrowDown" ? 1 : -1;
      return (current + direction + suggestions.length) %
        suggestions.length;
    });
  };

  return (
    <div className="file-view-controls">
      <form
        className="file-search"
        onSubmit={(event) => {
          event.preventDefault();
          applySearch(draftQuery);
        }}
        role="search"
      >
        <div className="file-search-input-wrap">
          <Icon name="search" size={15} />
          <input
            aria-label="Search files in this folder"
            aria-activedescendant={
              activeSuggestion >= 0
                ? `file-suggestion-${activeSuggestion}`
                : undefined
            }
            aria-autocomplete="list"
            aria-controls={suggestionListId}
            aria-expanded={suggestionsOpen && suggestions.length > 0}
            autoComplete="off"
            disabled={disabled}
            onBlur={() => setSuggestionsOpen(false)}
            onChange={(event) => {
              setDraftQuery(event.target.value);
              setSuggestionsOpen(true);
            }}
            onFocus={() => setSuggestionsOpen(true)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search this folder"
            role="combobox"
            type="search"
            value={draftQuery}
          />
          {draftQuery && (
            <button
              aria-label="Clear file search"
              className="file-search-clear"
              disabled={disabled}
              onClick={() => applySearch("")}
              type="button"
            >
              <Icon name="close" size={13} />
            </button>
          )}
          <button
            aria-label="Search files"
            className="file-search-submit"
            disabled={disabled}
            type="submit"
          >
            <Icon name="search" size={15} />
          </button>

          {suggestionsOpen && suggestions.length > 0 && (
            <ul
              className="file-search-suggestions"
              id={suggestionListId}
              role="listbox"
            >
              {suggestions.map((file, index) => (
                <li
                  key={`${file.id}:${file.path}`}
                  role="presentation"
                >
                  <button
                    aria-selected={activeSuggestion === index}
                    className={
                      activeSuggestion === index ? "is-active" : ""
                    }
                    id={`file-suggestion-${index}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => applySearch(file.name)}
                    role="option"
                    type="button"
                  >
                    <Icon
                      name={
                        getFileCategory(file) === "folder"
                          ? "folder"
                          : "document"
                      }
                      size={14}
                    />
                    <span>{file.name}</span>
                    <small>
                      {getFileCategory(file) === "source"
                        ? "code"
                        : getFileCategory(file)}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </form>

      <label className="file-view-select">
        <span>Type</span>
        <select
          disabled={disabled}
          onChange={(event) => onFilterChange(event.target.value)}
          value={filter}
        >
          {fileTypeFilters.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="file-view-select file-sort-select">
        <span>Sort</span>
        <select
          disabled={disabled}
          onChange={(event) => onSortChange(event.target.value)}
          value={sort}
        >
          {fileSortOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <span className="file-result-count">
        {resultCount} of {files.length}
      </span>

      {hasActiveView && (
        <button
          className="file-view-reset"
          disabled={disabled}
          onClick={onReset}
          type="button"
        >
          Reset
        </button>
      )}
    </div>
  );
}
