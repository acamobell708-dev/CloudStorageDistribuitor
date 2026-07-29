const { environment } = require("../src/config/environment");
const {
  BoxStorageProvider
} = require("../src/services/storage/box/BoxStorageProvider");

// The CLI connectivity harness exercises the same Box implementation as the
// web API while credentials, validation, pagination, and network work remain
// in src.
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
  listFiles,
  uploadFile,
  uploadFiles,
  uploadImage: uploadFile,
  uploadImages: uploadFiles
};
