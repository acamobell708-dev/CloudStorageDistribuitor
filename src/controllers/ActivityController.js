class ActivityController {
  constructor({ activityLogService, providerFactory }) {
    this.activityLogService = activityLogService;
    this.providerFactory = providerFactory;
  }

  list = async (request, response, next) => {
    try {
      response.set("Cache-Control", "private, no-store");
      const options = {
        days: request.query.days,
        page: request.query.page,
        pageSize: request.query.pageSize
      };
      const localActivity = this.activityLogService.list(options);

      if (localActivity.history.totalItems > 0) {
        response.json(localActivity);
        return;
      }

      const recoveredEvents = (
        await Promise.all(
          ["box", "azure"].map(async (providerKey) => {
            try {
              const provider = this.providerFactory?.get(providerKey);
              return (await provider?.listActivityEvents({ days: options.days })) || [];
            } catch {
              // A history fallback must not prevent the dashboard from loading.
              return [];
            }
          })
        )
      ).flat();

      if (recoveredEvents.length) {
        response.json(
          this.activityLogService.listFromEvents(recoveredEvents, options)
        );
        return;
      }

      response.json(localActivity);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { ActivityController };
