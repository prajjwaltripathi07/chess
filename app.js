const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socket(server);

// Store multiple games
let games = {};
let gameCounter = 1;

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.render("index", { title: "Chess Game" });
});

io.on("connection", (socket) => {
    console.log("New connection:", socket.id);

    // Find an available game or create a new one
    let assignedGame = null;
    for (const gameId in games) {
        const game = games[gameId];
        if (!game.players.white || !game.players.black) {
            assignedGame = game;
            break;
        }
    }

    if (!assignedGame) {
        const newGameId = `game-${gameCounter++}`;
        assignedGame = {
            id: newGameId,
            chess: new (Chess)(),
            players: { white: null, black: null }
        };
        games[newGameId] = assignedGame;
    }

    // Assign player role
    let role;
    if (!assignedGame.players.white) {
        assignedGame.players.white = socket.id;
        role = "w";
        console.log(`Player White assigned in ${assignedGame.id}`);
    } else if (!assignedGame.players.black) {
        assignedGame.players.black = socket.id;
        role = "b";
        console.log(`Player Black assigned in ${assignedGame.id}`);
    }

    socket.join(assignedGame.id);

    // 🔑 Emit role (compatible with old frontend)
    socket.emit("playRole", role);

    // 🔑 Also tell client which game it belongs to
    socket.emit("gameAssigned", assignedGame.id);

    // Send initial board state
    socket.emit("boardState", assignedGame.chess.fen());

    // Handle moves
    socket.on("move", ({ move, gameId }) => {
        const game = games[gameId];
        if (!game) return;

        try {
            const { chess, players } = game;

            if ((chess.turn() === "w" && socket.id !== players.white) ||
                (chess.turn() === "b" && socket.id !== players.black)) {
                return; // Not your turn
            }

            const result = chess.move(move);
            if (result) {
                io.to(gameId).emit("move", move);
                io.to(gameId).emit("boardState", chess.fen());

                if (chess.isCheckmate()) {
                    const winner = chess.turn() === "b" ? "White" : "Black";
                    io.to(gameId).emit("gameOver", { winner });
                    console.log(`Game ${gameId} Over! ${winner} wins!`);
                }
            } else {
                socket.emit("invalidMove", move);
            }
        } catch (err) {
            console.error("Move error:", err);
            socket.emit("invalidMove", move);
        }
    });

    // Restart game manually
    socket.on("restartGame", (gameId) => {
        const game = games[gameId];
        if (!game) return;

        game.chess.reset();
        io.to(gameId).emit("boardState", game.chess.fen());
        io.to(gameId).emit("gameRestarted");
    });

    // Handle disconnect
    socket.on("disconnect", () => {
        console.log("Disconnected:", socket.id);

        for (const gameId in games) {
            const game = games[gameId];
            if (game.players.white === socket.id) game.players.white = null;
            if (game.players.black === socket.id) game.players.black = null;

            if (!game.players.white && !game.players.black) {
                delete games[gameId];
                console.log(`Deleted ${gameId} (empty)`);
            }
        }
    });
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
