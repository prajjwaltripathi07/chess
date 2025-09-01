const socket = io();
let boardElement = document.querySelector(".chessboard");
let role = null;
let chess = new Chess();

// Render chessboard
function renderBoard() {
    const board = chess.board();
    boardElement.innerHTML = "";
    board.forEach((row, rIdx) => {
        row.forEach((square, cIdx) => {
            const squareEl = document.createElement("div");
            squareEl.classList.add("square", (rIdx + cIdx) % 2 === 0 ? "light" : "dark");

            if (square) {
                const pieceEl = document.createElement("span");
                pieceEl.textContent = pieceToUnicode(square);
                pieceEl.classList.add("piece", square.color === "w" ? "white" : "black");
                pieceEl.draggable = true;
                pieceEl.addEventListener("dragstart", (e) => {
                    e.dataTransfer.setData("from", `${cIdx}${rIdx}`);
                });
                squareEl.appendChild(pieceEl);
            }

            squareEl.addEventListener("dragover", (e) => e.preventDefault());
            squareEl.addEventListener("drop", (e) => {
                const from = e.dataTransfer.getData("from");
                const to = `${cIdx}${rIdx}`;
                handleMove(from, to);
            });

            boardElement.appendChild(squareEl);
        });
    });
}

// Convert piece to unicode
function pieceToUnicode(piece) {
    const map = {
        p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
        P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔"
    };
    return map[piece.type] || "";
}

// Handle moves
function handleMove(from, to) {
    const file = "abcdefgh";
    const fromSq = file[from[0]] + (8 - from[1]);
    const toSq = file[to[0]] + (8 - to[1]);

    const move = { from: fromSq, to: toSq, promotion: "q" };
    socket.emit("move", move);
}

// Socket events
socket.on("playRole", (assignedRole) => { role = assignedRole; });
socket.on("boardState", (fen) => { chess.load(fen); renderBoard(); });
socket.on("move", (move) => { chess.move(move); renderBoard(); });
socket.on("gameOver", ({ winner }) => alert(`${winner} wins!`));
socket.on("gameRestarted", () => { alert("Game restarted!"); });

// Chat handling
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

sendBtn.addEventListener("click", () => {
    const msg = chatInput.value.trim();
    if (msg) {
        socket.emit("chatMessage", msg);
        chatInput.value = "";
    }
});

socket.on("chatMessage", ({ sender, text }) => {
    const msgEl = document.createElement("div");
    msgEl.textContent = `${sender}: ${text}`;
    chatBox.appendChild(msgEl);
    chatBox.scrollTop = chatBox.scrollHeight;
});
