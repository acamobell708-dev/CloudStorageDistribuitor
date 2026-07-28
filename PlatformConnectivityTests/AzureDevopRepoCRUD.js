const { environment } = require("../src/config/environment");
const {
  AzureDevOpsStorageProvider
} = require("../src/services/storage/azure/AzureDevOpsStorageProvider");

// CLI tests deliberately retain the isolated local Git workflow. The web
// provider uses Azure's REST API and has local repository access disabled.
const provider = new AzureDevOpsStorageProvider({
  ...environment.azure,
  ...environment.azureCli,
  codeRepoRoot: environment.projectRoot
});

const removeImagesFromLastCommit = (...argumentsList) =>
  provider.removeMediaFromLastCommit(...argumentsList);
const uploadImage = (...argumentsList) =>
  provider.saveAndOptionallyPushFile(...argumentsList);
const uploadImages = (...argumentsList) =>
  provider.saveAndOptionallyPushFiles(...argumentsList);

module.exports = {
  removeImagesFromLastCommit,
  removeMediaFromLastCommit: removeImagesFromLastCommit,
  uploadFile: uploadImage,
  uploadFiles: uploadImages,
  uploadImage,
  uploadImages
};
