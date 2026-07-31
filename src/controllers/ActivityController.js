class ActivityController {
  constructor(activityLogService) {
    this.activityLogService = activityLogService;
  }

  list = (request, response, next) => {
    try {
      response.set("Cache-Control", "private, no-store");
      response.json(
        this.activityLogService.list({
          days: request.query.days,
          page: request.query.page,
          pageSize: request.query.pageSize
        })
      );
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { ActivityController };
