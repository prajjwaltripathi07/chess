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

app.get("/", (req, res) => {const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

let players = {};
let playerCount = 0;

io.on("connection", (socket) => {
    if (playerCount < 2) {
        playerCount++;
        let playerName = playerCount === 1 ? "Player 1" : "Player 2";
        players[socket.id] = playerName;

        // Send role to client
        socket.emit("playRole", playerName);

        // Inform both clients of assigned players
        io.emit("playerInfo", Object.values(players));

        console.log(`${playerName} connected`);
    } else {
        socket.emit("playRole", "Spectator");
    }

    // Handle moves
    socket.on("move", (move) => {
        socket.broadcast.emit("move", move);
    });

    // Handle chat messages
    socket.on("chatMessage", (msg) => {
        io.emit("chatMessage", { sender: players[socket.id] || "Spectator", text: msg });
    });

    socket.on("disconnect", () => {
        if (players[socket.id]) {
            console.log(`${players[socket.id]} disconnected`);
            delete players[socket.id];
            playerCount--;
            io.emit("playerInfo", Object.values(players));
        }
    });
});

app.get("/", (req, res) => {
    res.render("index");
});

server.listen(3000, () => console.log("Server running on http://localhost:3000"));

    res.render("index", { title: "Chess Game" });
});

// Store rooms
let rooms = {};
let roomCounter = 1;

io.on("connection", (socket) => {
    console.log("New connection:", socket.id);

    // Find an available room or create new
    let assignedRoom = null;
    for (let roomId in rooms) {
        if (rooms[roomId].players.length < 2) {
            assignedRoom = roomId;
            break;
        }
    }
    if (!assignedRoom) {
        assignedRoom = `room-${roomCounter++}`;
        rooms[assignedRoom] = {
            chess: new Chess(),
            players: []
        };
    }

    const room = rooms[assignedRoom];
    room.players.push(socket.id);
    socket.join(assignedRoom);

    // Assign role
    let role = room.players.length === 1 ? "w" : "b";
    socket.emit("playRole", role);
    socket.emit("boardState", room.chess.fen());
    console.log(`Player ${socket.id} joined ${assignedRoom} as ${role}`);

    // Handle moves
    socket.on("move", (move) => {
        try {
            const chess = room.chess;

            if (
                (chess.turn() === "w" && socket.id !== room.players[0]) ||
                (chess.turn() === "b" && socket.id !== room.players[1])
            ) {
                return;
            }

            const result = chess.move(move);
            if (result) {
                io.to(assignedRoom).emit("move", move);
                io.to(assignedRoom).emit("boardState", chess.fen());

                if (chess.isCheckmate()) {
                    const winner = chess.turn() === "b" ? "White" : "Black";
                    io.to(assignedRoom).emit("gameOver", { winner });
                }
            } else {
                socket.emit("invalidMove", move);
            }
        } catch (err) {
            console.error("Move error:", err);
            socket.emit("invalidMove", move);
        }
    });

    // Chat feature
    socket.on("chatMessage", (msg) => {
        io.to(assignedRoom).emit("chatMessage", {
            sender: socket.id,
            text: msg
        });
    });

    // Restart game
    socket.on("restartGame", () => {
        room.chess.reset();
        io.to(assignedRoom).emit("boardState", room.chess.fen());
        io.to(assignedRoom).emit("gameRestarted");
    });

    // Handle disconnect
    socket.on("disconnect", () => {
        console.log(`Player ${socket.id} left ${assignedRoom}`);
        room.players = room.players.filter((id) => id !== socket.id);

        if (room.players.length === 0) {
            delete rooms[assignedRoom]; // remove empty room
        }
    });
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
