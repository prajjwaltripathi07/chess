const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { Chess } = require("chess.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

const chess = new Chess();
let players = {};
let gameInProgress = false;

app.get("/", (req, res) => {
  res.render("index");
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Assign roles
  if (!players.white) {
    players.white = socket.id;
    socket.emit("playRole", "w");
  } else if (!players.black) {
    players.black = socket.id;
    socket.emit("playRole", "b");
  } else {
    socket.emit("spectatorRole");
  }

  socket.emit("boardState", chess.fen());

  // Handle moves
  socket.on("move", (move) => {
    try {
      const result = chess.move(move);
      if (result) {
        io.emit("move", move);
        if (chess.isGameOver()) {
          let winner = chess.turn() === "w" ? "Black" : "White";
          io.emit("gameOver", { winner });
        }
      }
    } catch (err) {
      console.log("Invalid move:", err.message);
    }
  });

  // Restart game
  socket.on("restartGame", () => {
    chess.reset();
    io.emit("gameRestarted");
  });

  // Chat messages
  socket.on("chatMessage", (data) => {
    io.emit("chatMessage", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    if (players.white === socket.id) delete players.white;
    if (players.black === socket.id) delete players.black;
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
