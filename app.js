const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socket(server);

// Each game = { chess: Chess instance, players: { white, black } }
let games = {};
let waitingPlayer = null; // Hold 1 player until matched

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index", { title: "Chess Game" });
});

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  // Matchmaking: if waiting player exists → create game
  if (waitingPlayer) {
    const gameId = socket.id + "#" + waitingPlayer.id;
    games[gameId] = {
      chess: new Chess(),
      players: { white: waitingPlayer, black: socket }
    };

    // Assign roles
    waitingPlayer.emit("playRole", "w");
    socket.emit("playRole", "b");

    // Send initial board
    const fen = games[gameId].chess.fen();
    waitingPlayer.emit("boardState", fen);
    socket.emit("boardState", fen);

    // Store gameId in sockets
    waitingPlayer.gameId = gameId;
    socket.gameId = gameId;

    console.log(`Game created: ${gameId}`);
    waitingPlayer = null; // clear waiting
  } else {
    // No waiting → this player waits
    waitingPlayer = socket;
    console.log("Player waiting for opponent:", socket.id);
  }

  // Handle move
  socket.on("move", (move) => {
    const gameId = socket.gameId;
    if (!gameId || !games[gameId]) return;

    const game = games[gameId];
    const { chess, players } = game;

    try {
      if (
        (chess.turn() === "w" && socket.id !== players.white.id) ||
        (chess.turn() === "b" && socket.id !== players.black.id)
      ) {
        return; // Not your turn
      }

      const result = chess.move(move);
      if (result) {
        // Broadcast new board + move
        io.to(players.white.id).emit("boardState", chess.fen());
        io.to(players.black.id).emit("boardState", chess.fen());
        io.to(players.white.id).emit("move", move);
        io.to(players.black.id).emit("move", move);

        // Checkmate?
        if (chess.isGameOver()) {
          let winner = null;
          if (chess.isCheckmate()) {
            winner = chess.turn() === "w" ? "Black" : "White";
          } else {
            winner = "Draw";
          }
          io.to(players.white.id).emit("gameOver", { winner });
          io.to(players.black.id).emit("gameOver", { winner });
        }
      } else {
        socket.emit("invalidMove", move);
      }
    } catch (err) {
      console.error("Move error:", err);
      socket.emit("invalidMove", move);
    }
  });

  // Restart game
  socket.on("restartGame", () => {
    const gameId = socket.gameId;
    if (!gameId || !games[gameId]) return;

    games[gameId].chess.reset();
    const fen = games[gameId].chess.fen();
    io.to(games[gameId].players.white.id).emit("boardState", fen);
    io.to(games[gameId].players.black.id).emit("boardState", fen);
    io.to(games[gameId].players.white.id).emit("gameRestarted");
    io.to(games[gameId].players.black.id).emit("gameRestarted");
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
    }

    const gameId = socket.gameId;
    if (gameId && games[gameId]) {
      const { players } = games[gameId];
      const opponent =
        players.white.id === socket.id ? players.black : players.white;

      if (opponent) {
        opponent.emit("gameOver", { winner: "Opponent disconnected" });
      }
      delete games[gameId];
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
