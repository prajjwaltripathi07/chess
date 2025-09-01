const socket = io();
const chess = new Chess();
const boardElement = document.getElementById("board");
const statusElement = document.getElementById("status");
const chatWindow = document.getElementById("chatWindow");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

let role = null;
let room = null;

socket.on("playerRole", (data) => {
    role = data.role;
    room = data.room;
    statusElement.textContent = `${role} joined ${room}. Waiting for opponent...`;
});

socket.on("gameStart", (msg) => {
    statusElement.textContent = msg + ` You are ${role}.`;
    renderBoard();
});

socket.on("move", (move) => {
    chess.move(move);
    renderBoard();
});

socket.on("chatMessage", (data) => {
    const msgEl = document.createElement("div");
    msgEl.textContent = `${data.player}: ${data.message}`;
    chatWindow.appendChild(msgEl);
    chatWindow.scrollTop = chatWindow.scrollHeight;
});

sendBtn.addEventListener("click", () => {
    const msg = chatInput.value;
    if (msg.trim() !== "") {
        socket.emit("chatMessage", msg);
        chatInput.value = "";
    }
});

// Piece symbols
function pieceToUnicode(piece) {
    const map = {
        w: { p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔" },
        b: { p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚" }
    };
    return map[piece.color][piece.type];
}

// Render chessboard (with flipping for Player 2)
function renderBoard() {
    const board = chess.board();
    boardElement.innerHTML = "";

    const rows = role === "Player 2" ? [...board].reverse() : board;

    rows.forEach((row, rIdx) => {
        const cols = role === "Player 2" ? [...row].reverse() : row;

        cols.forEach((square, cIdx) => {
            const squareEl = document.createElement("div");

            const actualR = role === "Player 2" ? 7 - rIdx : rIdx;
            const actualC = role === "Player 2" ? 7 - cIdx : cIdx;

            squareEl.classList.add(
                "square",
                (actualR + actualC) % 2 === 0 ? "light" : "dark"
            );

            if (square) {
                const pieceEl = document.createElement("span");
                pieceEl.textContent = pieceToUnicode(square);
                pieceEl.classList.add("piece", square.color === "w" ? "white" : "black");
                pieceEl.draggable = true;
                pieceEl.addEventListener("dragstart", (e) => {
                    e.dataTransfer.setData("from", `${actualC}${actualR}`);
                });
                squareEl.appendChild(pieceEl);
            }

            squareEl.addEventListener("dragover", (e) => e.preventDefault());
            squareEl.addEventListener("drop", (e) => {
                const from = e.dataTransfer.getData("from");
                const to = `${actualC}${actualR}`;
                handleMove(from, to);
            });

            boardElement.appendChild(squareEl);
        });
    });
}

function handleMove(from, to) {
    const move = chess.move({ from, to, promotion: "q" });
    if (move) {
        renderBoard();
        socket.emit("move", move);
    }
}
