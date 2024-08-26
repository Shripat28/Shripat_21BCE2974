const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, "public")));

const games = {}; // Object to keep track of game sessions

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("createGame", () => {
    const gameCode = generateGameCode();
    games[gameCode] = {
      players: [],
      gameState: initializeGameState(),
      currentPlayer: "A", // Start with Player A
    };
    socket.join(gameCode);
    socket.emit("gameCreated", gameCode);
    console.log(`Game created with code: ${gameCode}`);
  });

  socket.on("joinGame", (gameCode) => {
    if (games[gameCode]) {
      if (games[gameCode].players.length < 2) {
        const playerRole = games[gameCode].players.length === 0 ? "A" : "B";
        games[gameCode].players.push({ id: socket.id, role: playerRole });
        socket.join(gameCode);
        socket.emit("joinSuccess", { gameCode, playerRole });
        console.log(
          `User joined game with code: ${gameCode} as Player ${playerRole}`
        );
        if (games[gameCode].players.length === 2) {
          io.to(gameCode).emit("startGame", games[gameCode]);
        }
      } else {
        socket.emit("error", "Game is already full.");
      }
    } else {
      socket.emit("error", "Invalid game code.");
    }
  });

  socket.on("move", ({ gameState, gameCode }) => {
    if (games[gameCode]) {
      games[gameCode].gameState = gameState;
      games[gameCode].currentPlayer =
        games[gameCode].currentPlayer === "A" ? "B" : "A";
      io.to(gameCode).emit("moveMade", games[gameCode]);
    }
  });

  socket.on("resetGame", (gameCode) => {
    if (games[gameCode]) {
      games[gameCode].gameState = initializeGameState();
      games[gameCode].currentPlayer = "A";
      io.to(gameCode).emit("resetGame", games[gameCode]);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    handleDisconnection(socket.id);
  });
});

const generateGameCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const initializeGameState = () => {
  return Array(5)
    .fill()
    .map(() => Array(5).fill(null));
};

const handleDisconnection = (socketId) => {
  Object.keys(games).forEach((gameCode) => {
    const playerIndex = games[gameCode].players.findIndex(
      (player) => player.id === socketId
    );
    if (playerIndex !== -1) {
      games[gameCode].players.splice(playerIndex, 1);
      if (games[gameCode].players.length === 0) {
        delete games[gameCode];
        console.log(`Game ${gameCode} deleted due to inactivity.`);
      }
    }
  });
};

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
