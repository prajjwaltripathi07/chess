const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

let roomCounter = 1;
const rooms = {}; // { roomId: [socketIds...] }

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Assign player to a room
    let assignedRoom = null;
    for (const roomId in rooms) {
        if (rooms[roomId].length < 2) {
            assignedRoom = roomId;
            break;
        }
    }
    if (!assignedRoom) {
        assignedRoom = `room-${roomCounter++}`;
        rooms[assignedRoom] = [];
    }

    rooms[assignedRoom].push(socket.id);
    socket.join(assignedRoom);

    const playerNumber = rooms[assignedRoom].length;
    const role = playerNumber === 1 ? "Player 1" : "Player 2";

    socket.emit("playerRole", { role, room: assignedRoom });

    if (rooms[assignedRoom].length === 2) {
        io.to(assignedRoom).emit("gameStart", "Game begins!");
    }

    // Handle moves
    socket.on("move", (data) => {
        socket.to(assignedRoom).emit("move", data);
    });

    // Handle chat
    socket.on("chatMessage", (msg) => {
        io.to(assignedRoom).emit("chatMessage", { player: role, message: msg });
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        if (rooms[assignedRoom]) {
            rooms[assignedRoom] = rooms[assignedRoom].filter(id => id !== socket.id);
            if (rooms[assignedRoom].length === 0) {
                delete rooms[assignedRoom];
            }
        }
    });
});

app.get("/", (req, res) => {
    res.render("index");
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
