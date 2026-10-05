import express from "express";
import bodyParser from "body-parser";
import appRouter from "./src/routes/index.js";

const app = express();

app.use(bodyParser.json());

appRouter(app);

const server = app.listen(3000, () => {
	console.log("Server started up on port %s", server.address().port);
});

export default server;
