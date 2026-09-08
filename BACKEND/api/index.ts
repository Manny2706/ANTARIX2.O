import { createServer } from "http";
import app from "../src/app";
import initiateSocketConnection from "../src/socket/socket";

const server = createServer(app);

initiateSocketConnection(server);

export default server;

