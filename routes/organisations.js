const service = require('../services/organisations_service');

const organisationRoutes = (app) => {
  app.get('/organisations', (req, res) => {
    let orgName = req.query.name;
    let page = req.query.page
    service.get(orgName, page).then(rows => {
      res.send(rows);
    });
  });

  app.post('/organisations', (req, res, next) => {
    service.insert(req.body);
    res.send(req.body);
  });
};

module.exports = organisationRoutes;
