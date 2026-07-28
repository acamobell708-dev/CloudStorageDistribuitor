export class BrowserFileDownloadService {
  constructor(apiClient, documentObject = globalThis.document) {
    this.apiClient = apiClient;
    this.document = documentObject;
  }

  download(providerKey, file) {
    if (!providerKey || !file?.id) {
      throw new TypeError("A provider and cloud file are required");
    }

    const link = this.document.createElement("a");

    link.download = file.name || "download";
    link.hidden = true;
    link.href = this.apiClient.getFileDownloadUrl(providerKey, file);
    this.document.body.append(link);
    link.click();
    link.remove();
  }
}
