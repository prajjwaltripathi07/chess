const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");
const chatForm = document.querySelector("#chatForm");
const chatInput = document.querySelector("#chatInput");
const chatBox = document.querySelector("#chatBox");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;

const renderBoard = () => {
  const board = chess.board();
  boardElement.innerHTML = "";
  board.forEach((row, rowIndex) => {
    row.forEach((square, squareIndex) => {
      const squareElement = document.createElement("div");
      squareElement.classList.add(
        "square",
        (rowIndex + squareIndex) % 2 === 0 ? "light" : "dark"
      );

      squareElement.dataset.row = rowIndex;
      squareElement.dataset.col = squareIndex;

      if (square) {
        const pieceElement = document.createElement("div");
        pieceElement.classList.add(
          "piece",
          square.color === "w" ? "white" : "black"
        );
        pieceElement.innerText = getPieceUnicode(square);

        if (playerRole === square.color) {
          pieceElement.draggable = true;
          pieceElement.classList.add("draggable");
        }

        pieceElement.addEventListener("dragstart", (e) => {
          if (pieceElement.draggable) {
            draggedPiece = pieceElement;
            sourceSquare = { row: rowIndex, col: squareIndex };
            e.dataTransfer.setData("text/plain", "");
          }
        });

        pieceElement.addEventListener("dragend", () => {
          draggedPiece = null;
          sourceSquare = null;
        });

        squareElement.appendChild(pieceElement);
      }

      squareElement.addEventListener("dragover", (e) => e.preventDefault());
      squareElement.addEventListener("drop", (e) => {
        e.preventDefault();
        if (draggedPiece) {
          const targetSquare = {
            row: parseInt(squareElement.dataset.row),
            col: parseInt(squareElement.dataset.col),
          };
          handleMove(sourceSquare, targetSquare);
        }
      });

      boardElement.appendChild(squareElement);
    });
  });

  if (playerRole === "b") {
    boardElement.classList.add("flipped");
  } else {
    boardElement.classList.remove("flipped");
  }
};

const handleMove = (source, target) => {
  const move = {
    from: `${String.fromCharCode(source.col + 97)}${8 - source.row}`,
    to: `${String.fromCharCode(target.col + 97)}${8 - target.row}`,
    promotion: "q",
  };
  socket.emit("move", move);
};

const getPieceUnicode = (piece) => {
  const unicodePieces = {
    k: "♔",
    q: "♕",
    r: "♖",
    b: "♗",
    n: "♘",
    p: "♙",
    K: "♚",
    Q: "♛",
    R: "♜",
    B: "♝",
    N: "♞",
    P: "♟",
  };
  return unicodePieces[piece.type] || "";
};

socket.on("playRole", (role) => {
  playerRole = role;
  renderBoard();
});

socket.on("boardState", (fen) => {
  chess.load(fen);
  renderBoard();
});

socket.on("move", (move) => {
  chess.move(move);
  renderBoard();
});

socket.on("gameOver", (data) => {
  const gameOverMessage = document.createElement("div");
  gameOverMessage.classList.add(
    "game-over-message",
    "absolute",
    "top-4",
    "left-1/2",
    "transform",
    "-translate-x-1/2",
    "bg-red-600",
    "text-white",
    "px-4",
    "py-2",
    "rounded"
  );
  gameOverMessage.innerHTML = `
        <h2 class="text-center text-xl font-bold">Game Over! ${data.winner} wins!</h2>
        <button class="mt-4 px-4 py-2 bg-blue-500 text-white rounded" onclick="restartGame()">Restart</button>
    `;
  document.body.appendChild(gameOverMessage);
});

function restartGame() {
  socket.emit("restartGame");
  const gameOverMessage = document.querySelector(".game-over-message");
  if (gameOverMessage) gameOverMessage.remove();
}

socket.on("gameRestarted", () => {
  chess.reset();
  renderBoard();
});

// ==================== CHAT FEATURE ====================
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (chatInput.value.trim() !== "") {
    socket.emit("chatMessage", chatInput.value);
    chatInput.value = "";
  }
});

socket.on("chatMessage", (data) => {
  const msgElement = document.createElement("div");
  msgElement.classList.add("chat-msg");
  msgElement.innerHTML = `<b>${data.sender.slice(0, 5)}:</b> ${data.message}`;
  chatBox.appendChild(msgElement);
  chatBox.scrollTop = chatBox.scrollHeight;
});

renderBoard();
