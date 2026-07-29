const permissions = Object.freeze({
  accessDashboard: "page:dashboard",
  accessHome: "page:home",
  deleteFiles: "storage:delete",
  downloadFiles: "storage:download",
  listFiles: "storage:list",
  permanentlyDeleteFiles: "storage:purge",
  uploadFiles: "storage:upload"
});

const memberPermissions = Object.freeze([
  permissions.accessDashboard,
  permissions.accessHome,
  permissions.deleteFiles,
  permissions.downloadFiles,
  permissions.listFiles,
  permissions.uploadFiles
]);

module.exports = {
  memberPermissions,
  permissions
};
