const organisationRoutes = require("./organisations");

const appRouter = (app) => {
  app.get("/", (req, res) => {
    res.send("Nothing here");
  });

  organisationRoutes(app);
};

module.exports = appRouter;
