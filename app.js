const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socket(server);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index", { title: "Chess Game" });
});

let games = {};
let gameIdCounter = 1;

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  let assignedGame = null;

  // Assign players to games
  for (let gameId in games) {
    const game = games[gameId];
    if (!game.players.white) {
      game.players.white = socket.id;
      assignedGame = gameId;
      socket.join(gameId);
      socket.emit("playRole", "w");
      break;
    } else if (!game.players.black) {
      game.players.black = socket.id;
      assignedGame = gameId;
      socket.join(gameId);
      socket.emit("playRole", "b");
      break;
    }
  }

  // If no available game, create a new one
  if (!assignedGame) {
    const newGameId = `game-${gameIdCounter++}`;
    games[newGameId] = {
      chess: new Chess(),
      players: { white: socket.id, black: null },
    };
    assignedGame = newGameId;
    socket.join(newGameId);
    socket.emit("playRole", "w");
    console.log("Created new game:", newGameId);
  }

  const currentGame = games[assignedGame];

  // Send initial board state
  socket.emit("boardState", currentGame.chess.fen());

  // Handle chess moves
  socket.on("move", (move) => {
    const game = games[assignedGame];
    if (!game) return;

    try {
      if (
        (game.chess.turn() === "w" && socket.id !== game.players.white) ||
        (game.chess.turn() === "b" && socket.id !== game.players.black)
      ) {
        return;
      }

      const result = game.chess.move(move);
      if (result) {
        io.to(assignedGame).emit("move", move);
        io.to(assignedGame).emit("boardState", game.chess.fen());

        if (game.chess.isCheckmate()) {
          const winner = game.chess.turn() === "b" ? "White" : "Black";
          io.to(assignedGame).emit("gameOver", { winner });
        }
      } else {
        socket.emit("invalidMove", move);
      }
    } catch (err) {
      console.error("Move error:", err);
      socket.emit("invalidMove", move);
    }
  });

  // Handle chat messages
  socket.on("chatMessage", (msg) => {
    io.to(assignedGame).emit("chatMessage", {
      sender: socket.id,
      message: msg,
    });
  });

  // Handle restart
  socket.on("restartGame", () => {
    const game = games[assignedGame];
    if (!game) return;

    game.chess.reset();
    io.to(assignedGame).emit("boardState", game.chess.fen());
    io.to(assignedGame).emit("gameRestarted");
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    if (!games[assignedGame]) return;

    if (socket.id === games[assignedGame].players.white) {
      games[assignedGame].players.white = null;
    }
    if (socket.id === games[assignedGame].players.black) {
      games[assignedGame].players.black = null;
    }

    // Reset game if both leave
    if (!games[assignedGame].players.white && !games[assignedGame].players.black) {
      delete games[assignedGame];
      console.log("Deleted empty game:", assignedGame);
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
