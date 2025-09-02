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
      socket.role = "Player1";
      assignedGame = gameId;
      socket.join(gameId);
      socket.emit("playRole", "w");
      io.to(gameId).emit("chatMessage", { sender: "System", message: "Player1 joined the game" });
      break;
    } else if (!game.players.black) {
      game.players.black = socket.id;
      socket.role = "Player2";
      assignedGame = gameId;
      socket.join(gameId);
      socket.emit("playRole", "b");
      io.to(gameId).emit("chatMessage", { sender: "System", message: "Player2 joined the game" });
      break;
    }
  }

  // If no available game, create new
  if (!assignedGame) {
    const newGameId = `game-${gameIdCounter++}`;
    games[newGameId] = {
      chess: new Chess(),
      players: { white: socket.id, black: null },
    };
    assignedGame = newGameId;
    socket.role = "Player1";
    socket.join(newGameId);
    socket.emit("playRole", "w");
    io.to(newGameId).emit("chatMessage", { sender: "System", message: "Player1 joined the game" });
  }

  const currentGame = games[assignedGame];
  socket.emit("boardState", currentGame.chess.fen());

  // Chat
  socket.on("chatMessage", (msg) => {
    const senderName = socket.role || "Spectator";
    io.to(assignedGame).emit("chatMessage", { sender: senderName, message: msg });
  });

  // Moves
  socket.on("move", (move) => {
    const game = games[assignedGame];
    if (!game) return;

    if ((game.chess.turn() === "w" && socket.id !== game.players.white) ||
        (game.chess.turn() === "b" && socket.id !== game.players.black)) return;

    const result = game.chess.move(move);
    if (result) {
      io.to(assignedGame).emit("move", move);
      io.to(assignedGame).emit("boardState", game.chess.fen());

      if (game.chess.isCheckmate()) {
        const winner = game.chess.turn() === "b" ? "White" : "Black";
        io.to(assignedGame).emit("gameOver", { winner });
      }
    }
  });

  // Restart
  socket.on("restartGame", () => {
    const game = games[assignedGame];
    if (!game) return;
    game.chess.reset();
    io.to(assignedGame).emit("boardState", game.chess.fen());
    io.to(assignedGame).emit("gameRestarted");
  });

  // Disconnect
  socket.on("disconnect", () => {
    if (!games[assignedGame]) return;
    if (socket.role === "Player1") {
      games[assignedGame].players.white = null;
      io.to(assignedGame).emit("chatMessage", { sender: "System", message: "Player1 left the game" });
    }
    if (socket.role === "Player2") {
      games[assignedGame].players.black = null;
      io.to(assignedGame).emit("chatMessage", { sender: "System", message: "Player2 left the game" });
    }

    if (!games[assignedGame].players.white && !games[assignedGame].players.black) {
      delete games[assignedGame];
    }
  });
});

server.listen(3000, () => console.log("Server running on http://localhost:3000"));
