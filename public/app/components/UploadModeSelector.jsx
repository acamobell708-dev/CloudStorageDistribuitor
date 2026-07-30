import { Icon } from "./Icon";

const uploadModes = [
  {
    description: "Choose one item",
    icon: "document",
    key: "single",
    label: "Single file"
  },
  {
    description: "Choose several items",
    icon: "archive",
    key: "multiple",
    label: "Multiple files"
  },
  {
    description: "Keep its structure",
    icon: "folder",
    key: "folder",
    label: "Folder"
  }
];

export function UploadModeSelector({
  disabled,
  onSelect,
  selectedMode
}) {
  return (
    <fieldset className="upload-mode-selector" disabled={disabled}>
      <legend>What would you like to upload?</legend>
      <div>
        {uploadModes.map((mode) => (
          <button
            aria-pressed={selectedMode === mode.key}
            className={
              selectedMode === mode.key ? "is-selected" : undefined
            }
            key={mode.key}
            onClick={() => onSelect(mode.key)}
            type="button"
          >
            <span className="upload-mode-icon">
              <Icon name={mode.icon} size={17} />
            </span>
            <span>
              <strong>{mode.label}</strong>
              <small>{mode.description}</small>
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
