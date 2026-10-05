import express from "express";
import bodyParser from "body-parser";
import appRouter from "./src/routes/index.js";
import type { Server } from "node:http";

const app = express();

app.use(bodyParser.json());

appRouter(app);

const server: Server = app.listen(3000, () => {
	const address = server.address();
	if (address && typeof address !== "string") {
		console.log("Server started up on port %s", address.port);
	}
});

export default server;
