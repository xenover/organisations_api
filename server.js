const express = require("express");
const bodyParser = require("body-parser");

const app = express();

app.use(bodyParser.json());

require("./src/routes/index.js")(app);

const server = app.listen(3000, () => {
	console.log("Server started up on port %s", server.address().port);
});

module.exports = server;
