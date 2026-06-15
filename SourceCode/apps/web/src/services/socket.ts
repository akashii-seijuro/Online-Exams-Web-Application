import { io, type Socket } from "socket.io-client";

type SocketClientType = "teacher" | "student";

type CreateSocketOptions = {
  token: string;
  clientType: SocketClientType;
};

export function createSocket(options: CreateSocketOptions): Socket {
  return io(import.meta.env.VITE_WS_URL ?? "http://localhost:3001", {
    auth: {
      token: options.token,
      clientType: options.clientType
    },
    autoConnect: false,
    transports: ["websocket", "polling"]
  });
}
