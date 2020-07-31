const express = require('express');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json());

require('./routes/routes.js')(app);

const server = app.listen(3000, () => {
  console.log('Server started up on port %s', server.address().port);
});

module.exports = server;
