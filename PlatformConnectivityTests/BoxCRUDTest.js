const { environment } = require("../src/config/environment");
const {
  BoxStorageProvider
} = require("../src/services/storage/box/BoxStorageProvider");

// The CLI connectivity harness now exercises the same Box implementation as
// the web API. Keeping this adapter preserves the original function exports
// while credentials, validation, pagination, and network work remain in src.
const provider = new BoxStorageProvider({
  ...environment.box
});

const deleteFile = (...argumentsList) =>
  provider.deleteFile(...argumentsList);
const deleteFiles = (...argumentsList) =>
  provider.deleteFiles(...argumentsList);
const downloadAllFiles = (...argumentsList) =>
  provider.downloadAllFiles(...argumentsList);
const downloadFile = (...argumentsList) =>
  provider.downloadFile(...argumentsList);
const downloadFiles = (...argumentsList) =>
  provider.downloadFiles(...argumentsList);
const getAccessToken = (...argumentsList) =>
  provider.getAccessToken(...argumentsList);
const getFileInfo = (...argumentsList) =>
  provider.getFileInfo(...argumentsList);
const listFiles = (...argumentsList) =>
  provider.listFiles(...argumentsList);
const uploadFile = (...argumentsList) =>
  provider.uploadFile(...argumentsList);
const uploadFiles = (...argumentsList) =>
  provider.uploadFiles(...argumentsList);

module.exports = {
  deleteFile,
  deleteFiles,
  downloadAllFiles,
  downloadFile,
  downloadFiles,
  getAccessToken,
  getFileInfo,
  listFiles,
  uploadFile,
  uploadFiles,
  uploadImage: uploadFile,
  uploadImages: uploadFiles
};
