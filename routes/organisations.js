const service = require('../services/organisations_service');

const organisationRoutes = (app) => {
  app.get('/organisations', (req, res) => {
    const orgName = req.query.name;
    const page = req.query.page;
    service.get(orgName, page).then((rows) => {
      res.status(200); // OK
      res.send(rows);
    });
  });

  app.post('/organisations', (req, res) => {
    service.insert(req.body);
    res.status(201); // CREATED
    // just return the same body we got
    res.send(req.body);
  });
};

module.exports = organisationRoutes;
