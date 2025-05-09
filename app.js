const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();
let players = { white: null, black: null };

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.render("index", { title: "Chess Game" });
});

io.on("connection", (socket) => {
    console.log("New connection:", socket.id);

    if (!players.white) {
        players.white = socket.id;
        socket.emit("playRole", "w");
    } else if (!players.black) {
        players.black = socket.id;
        socket.emit("playRole", "b");
    } else {
        socket.emit("spectatorRole");
    }

    socket.on("move", (move) => {
        try {
            if ((chess.turn() === "w" && socket.id !== players.white) ||
                (chess.turn() === "b" && socket.id !== players.black)) {
                return;
            }

            const result = chess.move(move);
            if (result) {
                io.emit("move", move);
                io.emit("boardState", chess.fen());
            } else {
                socket.emit("invalidMove", move);
                console.log("Invalid move", move);
            }
        } catch (err) {
            console.error("Move error:", err);
            socket.emit("invalidMove", move);
        }
    });

    socket.on("disconnect", () => {
        if (socket.id === players.white) players.white = null;
        if (socket.id === players.black) players.black = null;
        console.log("Disconnected:", socket.id);
    });
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
