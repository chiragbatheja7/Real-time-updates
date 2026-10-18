import { useEffect, useRef, useState } from "react";
import "./App.css";

type Cell = "X" | "O" | null;

type GameState = {
  board: Cell[];
  turn: "X" | "O";
  winner: "X" | "O" | null;
  draw: boolean;
  opponentConnected: boolean;
  you: "X" | "O";
};

type ServerMessage = | ({ type: "state" } & GameState) | { type: "error"; message: string };

// Set VITE_WS_URL in client/.env.local for development and in the frontend host for deployment.
const WS_URL = import.meta.env.VITE_WS_URL;

export default function App() {
  const [roomInput, setRoomInput] = useState("");
  const [room, setRoom] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Step 3: Choosing a room starts this effect and opens the WebSocket. Next, server.js accepts it in Step 4.
  useEffect(() => {
    if (!room) return;

    if (!WS_URL) {
      setError("WebSocket URL is not configured. Set VITE_WS_URL and restart the client.");
      return;
    }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Step 5: Tell server.js which room to join. Next, the server handles this in Step 6.
      ws.send(JSON.stringify({ type: "join", room }));
    };

    // Step 9: Receive the server's "state" or "error" and update the screen.
    // This also runs after moves and resets; see Steps 11 and 13 in server.js.
    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data);
      if (msg.type === "state") {
        setGame(msg);
        setError("");
      } else {
        setError(msg.message);
      }
    };

    ws.onclose = () => setConnected(false);

    // Step 15: Leaving closes this socket. Next, server.js frees the seat in Step 16.
    return () => ws.close();
  }, [room]);

  const send = (payload: object) => wsRef.current?.send(JSON.stringify(payload));

  // Step 14: The Leave room button clears the room, so the effect cleanup runs in Step 15.
  const leave = () => {
    setRoom(null);
    setGame(null);
    setError("");
  };

  if (!room) {
    return (
      <main className="app">
        <h1>Tic-tac-toe</h1>
        <div className="join">
          {/* Step 2: Enter a room code and press Enter or Join room. Next, the room opens the socket in Step 3 above. */}
          <input
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && roomInput.trim() && setRoom(roomInput.trim())}
            placeholder="Room code"
          />
          <button disabled={!roomInput.trim()} onClick={() => setRoom(roomInput.trim())}>
            Join room
          </button>
        </div>
        <p className="hint">Open this page in two tabs and use the same room code.</p>
      </main>
    );
  }

  let status = "Connecting…";
  if (connected && !game) status = "Joining room…";
  if (game) {
    if (!game.opponentConnected) status = "Waiting for opponent…";
    else if (game.winner) status = game.winner === game.you ? "You won" : "You lost";
    else if (game.draw) status = "Draw";
    else status = game.turn === game.you ? "Your turn" : "Opponent's turn";
  }

  const gameOver = Boolean(game?.winner || game?.draw);

  return (
    <main className="app">
      <h1>Room: {room}</h1>
      <p className="status">
        {game && <span className="badge">You are {game.you}</span>} {status}
      </p>

      {/* Step 10: Clicking a cell sends "move" to server.js. Next, the server checks and updates it in Step 11. */}
      <div className="board">
        {(game?.board ?? Array(9).fill(null)).map((cell: Cell, i: number) => (
          <button
            key={i}
            className={`cell ${cell ?? ""}`}
            disabled={!game || Boolean(cell) || gameOver || !game.opponentConnected}
            onClick={() => send({ type: "move", index: i })}
            aria-label={`Cell ${i + 1}${cell ? `, ${cell}` : ""}`}
          >
            {cell}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="actions">
        {/* Step 12: Play again sends "reset" to server.js. Next, it clears the board in Step 13. */}
        {gameOver && <button onClick={() => send({ type: "reset" })}>Play again</button>}
        <button className="secondary" onClick={leave}>Leave room</button>
      </div>
    </main>
  );
}