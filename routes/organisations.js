const service = require('../services/organisations_service');

const organisationRoutes = (app) => {
  app.get('/organisations', async (req, res) => {
    const orgName = req.query.name;
    const page = req.query.page;
    const rows = await service.get(orgName, page);
    res.status(200); // OK
    res.send(rows);
  });

  app.post('/organisations', async (req, res) => {
    await service.insert(req.body);
    res.status(201); // CREATED
    res.send('OK');
  });
};

module.exports = organisationRoutes;
