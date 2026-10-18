import { WebSocketServer } from "ws";

// Use the port supplied by the hosting service, or 8080 when running locally.
const port = Number(process.env.PORT ?? 8080);
const wss = new WebSocketServer({ port });
// Rooms stay in memory while the server runs. Each room holds the board and two player sockets.
const rooms = new Map(); // roomId -> { board, turn, X, O }

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const newRoom = () => ({ board: Array(9).fill(null), turn: "X", X: null, O: null });

function getWinner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

// Step 8: Send each player the room state and their own symbol. App.tsx receives it in Step 9.
function broadcast(room) {
  const winner = getWinner(room.board);
  const draw = !winner && room.board.every(Boolean);
  const base = {
    type: "state",
    board: room.board,
    turn: room.turn,
    winner,
    draw,
    opponentConnected: Boolean(room.X && room.O),
  };
  send(room.X, { ...base, you: "X" });
  send(room.O, { ...base, you: "O" });
}

wss.on("connection", (ws) => {
  // Step 4: Accept a browser's WebSocket connection. It sends "join" in App.tsx Step 5.
  ws.roomId = null;
  ws.symbol = null;

  // Steps 6, 10, and 12: Handle the browser's "join", "move", and "reset" messages here.
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return send(ws, { type: "error", message: "Invalid JSON" });
    }

    if (msg.type === "join") {
      // Step 7: Put this player in the room as X or O, then send the first game state in Step 8.
      if (ws.roomId) return send(ws, { type: "error", message: "Already in a room" });
      const roomId = String(msg.room || "").trim().slice(0, 20);
      if (!roomId) return send(ws, { type: "error", message: "Room code required" });

      const room = rooms.get(roomId) ?? newRoom();
      rooms.set(roomId, room);

      const symbol = !room.X ? "X" : !room.O ? "O" : null;
      if (!symbol) return send(ws, { type: "error", message: "Room is full" });

      room[symbol] = ws;
      ws.roomId = roomId;
      ws.symbol = symbol;
      return broadcast(room);
    }

    const room = rooms.get(ws.roomId);
    if (!room) return send(ws, { type: "error", message: "Join a room first" });

    if (msg.type === "move") {
      // Step 11: Check the move, update the shared board, then broadcast it in Step 8.
      // App.tsx receives that update in Step 9.
      const i = msg.index;
      if (!Number.isInteger(i) || i < 0 || i > 8) return send(ws, { type: "error", message: "Invalid cell" });
      if (!room.X || !room.O) return send(ws, { type: "error", message: "Waiting for opponent" });
      if (getWinner(room.board) || room.board.every(Boolean)) return send(ws, { type: "error", message: "Game is over" });
      if (room.turn !== ws.symbol) return send(ws, { type: "error", message: "Not your turn" });
      if (room.board[i]) return send(ws, { type: "error", message: "Cell already taken" });

      room.board[i] = ws.symbol;
      room.turn = ws.symbol === "X" ? "O" : "X";
      return broadcast(room);
    }

    if (msg.type === "reset") {
      // Step 13: Clear the room's board and send the new state through Step 8.
      room.board = Array(9).fill(null);
      room.turn = "X";
      return broadcast(room);
    }
  });

  ws.on("close", () => {
    // Step 16: Handle the socket closed in App.tsx Step 15. Free its seat and update the other player.
    const room = rooms.get(ws.roomId);
    if (!room) return;
    room[ws.symbol] = null;
    if (!room.X && !room.O) rooms.delete(ws.roomId); // free memory
    else broadcast(room);
  });
});

console.log(`WebSocket server listening on port ${port}`);