const socket = io();
const boardElement = document.getElementById("board");
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

const chess = new Chess();
let role = null;

socket.on("playRole", (assignedRole) => {
    role = assignedRole;
    renderBoard();
});

socket.on("move", (move) => {
    chess.move(move);
    renderBoard();
});

socket.on("chatMessage", ({ sender, text }) => {
    const msgEl = document.createElement("div");
    msgEl.textContent = `${sender}: ${text}`;
    chatBox.appendChild(msgEl);
    chatBox.scrollTop = chatBox.scrollHeight;
});

sendBtn.addEventListener("click", () => {
    const msg = chatInput.value.trim();
    if (msg) {
        socket.emit("chatMessage", msg);
        chatInput.value = "";
    }
});

function renderBoard() {
    const board = chess.board();
    boardElement.innerHTML = "";

    const rows = role === "Player 2" ? [...board].reverse() : board;

    rows.forEach((row, rIdx) => {
        const cols = role === "Player 2" ? [...row].reverse() : row;

        cols.forEach((square, cIdx) => {
            const squareEl = document.createElement("div");

            // Adjust coloring when flipped
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
    if (!role.startsWith("Player")) return;

    const move = chess.move({
        from: toSquareName(from),
        to: toSquareName(to),
        promotion: "q"
    });

    if (move) {
        renderBoard();
        socket.emit("move", move);
    }
}

function toSquareName(coord) {
    const file = "abcdefgh"[coord[0]];
    const rank = parseInt(coord[1]) + 1;
    return file + rank;
}

function pieceToUnicode(piece) {
    const map = {
        p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
        P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔"
    };
    return map[piece.type === piece.type.toLowerCase() ? piece.type : piece.type.toUpperCase()];
}
