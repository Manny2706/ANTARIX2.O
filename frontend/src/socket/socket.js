import { io } from "socket.io-client";

export const socket = io(
  import.meta.env.SOCKET_URL || "https://sat-query-ai-ten.vercel.app",
  {
    autoConnect: false,
    transports: ["polling", "websocket"],
  }
);
