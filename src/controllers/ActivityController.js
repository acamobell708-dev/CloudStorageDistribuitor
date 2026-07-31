function createFallbackWarning(providerKey, error) {
  const provider = providerKey === "azure" ? "Azure Repos" : "Box";
  const status =
    error?.details?.azureStatus ||
    error?.details?.boxStatus ||
    error?.statusCode;

  return {
    code: error?.code || "HISTORY_FALLBACK_UNAVAILABLE",
    provider,
    ...(Number.isInteger(status) ? { status } : {})
  };
}

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

      const fallbackResults = await Promise.all(
        ["box", "azure"].map(async (providerKey) => {
          try {
            const provider = this.providerFactory?.get(providerKey);
            return {
              events:
                (await provider?.listActivityEvents({ days: options.days })) || []
            };
          } catch (error) {
            return {
              events: [],
              warning: createFallbackWarning(providerKey, error)
            };
          }
        })
      );
      const recoveredEvents = fallbackResults.flatMap((result) => result.events);
      const fallbackWarnings = fallbackResults
        .map((result) => result.warning)
        .filter(Boolean);

      if (recoveredEvents.length) {
        response.json({
          ...this.activityLogService.listFromEvents(recoveredEvents, options),
          fallbackWarnings
        });
        return;
      }

      response.json({ ...localActivity, fallbackWarnings });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { ActivityController };
