const { environment } = require("../src/config/environment");
const {
  AzureDevOpsStorageProvider
} = require("../src/services/storage/azure/AzureDevOpsStorageProvider");

// Preserve the original CLI exports while exercising the same isolated Azure
// data-repository implementation used by the web API.
const provider = new AzureDevOpsStorageProvider({
  ...environment.azure,
  codeRepoRoot: environment.projectRoot
});

const removeImagesFromLastCommit = (...argumentsList) =>
  provider.removeMediaFromLastCommit(...argumentsList);
const uploadImage = (...argumentsList) =>
  provider.uploadFile(...argumentsList);
const uploadImages = (...argumentsList) =>
  provider.uploadFiles(...argumentsList);

module.exports = {
  removeImagesFromLastCommit,
  removeMediaFromLastCommit: removeImagesFromLastCommit,
  uploadFile: uploadImage,
  uploadFiles: uploadImages,
  uploadImage,
  uploadImages
};
