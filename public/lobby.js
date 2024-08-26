const socket = io();

document.getElementById("createGame").addEventListener("click", () => {
  socket.emit("createGame");
});

document.getElementById("joinGame").addEventListener("click", () => {
  const gameCode = document.getElementById("gameCodeInput").value;
  socket.emit("joinGame", gameCode);
});

socket.on("gameCreated", (gameCode) => {
  // Redirect to game page with the game code
  window.location.href = `game.html?gameCode=${gameCode}`;
});

socket.on("joinSuccess", (gameCode) => {
  // Redirect to game page with the game code
  window.location.href = `game.html?gameCode=${gameCode}`;
});

socket.on("error", (message) => {
  document.getElementById("error").textContent = message;
  document.getElementById("error").classList.remove("hidden");
});
