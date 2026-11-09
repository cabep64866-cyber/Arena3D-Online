const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

const rooms = new Map();
const MAX_PLAYERS = 50;

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;

    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "join") {
      const roomId = String(msg.room || "sala1");

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
      }

      const room = rooms.get(roomId);

      if (room.size >= MAX_PLAYERS) {
        send(ws, { type: "full" });
        ws.close();
        return;
      }

      const player = {
        id: Math.random().toString(36).slice(2),
        x: 0,
        y: 0,
        rotation: 0
      };

      ws.roomId = roomId;
      ws.playerId = player.id;
      room.set(player.id, { ws, player });

      send(ws, {
        type: "welcome",
        id: player.id,
        players: Array.from(room.values()).map(p => p.player)
      });

      room.forEach((p) => {
        if (p.ws !== ws) {
          send(p.ws, { type: "joined", player });
        }
      });
    }

    if (msg.type === "move" && ws.roomId && ws.playerId) {
      const room = rooms.get(ws.roomId);
      const entry = room && room.get(ws.playerId);

      if (!entry) return;

      entry.player.x = Number(msg.x) || 0;
      entry.player.y = Number(msg.y) || 0;
      entry.player.rotation = Number(msg.rotation) || 0;

      room.forEach((p) => {
        if (p.ws !== ws) {
          send(p.ws, {
            type: "state",
            player: entry.player
          });
        }
      });
    }
  });

  ws.on("close", () => {
    if (!ws.roomId || !rooms.has(ws.roomId)) return;

    const room = rooms.get(ws.roomId);
    room.delete(ws.playerId);

    room.forEach((p) => {
      send(p.ws, {
        type: "left",
        id: ws.playerId
      });
    });

    if (room.size === 0) {
      rooms.delete(ws.roomId);
    }
  });
});

console.log("Arena 3D server running on port " + PORT);
