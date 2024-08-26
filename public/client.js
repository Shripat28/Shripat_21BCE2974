const socket = io();
let currentPlayer = "A";
let selectedCharacter = null;
let gameState = [
  ["", "", "", "", ""],
  ["", "", "", "", ""],
  ["", "", "", "", ""],
  ["", "", "", "", ""],
  ["", "", "", "", ""],
];
let moveHistory = []; // Initialize move history
let turnTimer; // Variable to store the timer
let turnTimeLeft = 30; // Default time per turn in seconds

// Initialize the game and set up the board
const initializeGame = () => {
  const gameGrid = document.getElementById("game-grid");
  gameGrid.innerHTML = "";

  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      const cell = document.createElement("div");
      cell.classList.add("grid-cell");
      cell.dataset.row = i;
      cell.dataset.col = j;
      cell.addEventListener("click", () => handleCellClick(i, j));
      gameGrid.appendChild(cell);
    }
  }

  placeCharacters("A", ["P1", "H1", "H2", "P2", "P3"]);
  placeCharacters("B", ["P1", "H1", "H2", "P2", "P3"]);
  updateTurnIndicator();
  updateTimerTheme(); // Update timer theme for the initial player
  moveHistory = []; // Reset move history when initializing game
  startTurnTimer(); // Start the timer at the beginning
};

const showCustomAlert = (message) => {
  const customAlert = document.getElementById("customAlert");
  const customAlertMessage = document.getElementById("customAlertMessage");
  const customAlertButton = document.getElementById("customAlertButton");

  customAlertMessage.textContent = message;
  customAlert.classList.remove("hidden");

  customAlertButton.onclick = () => {
    customAlert.classList.add("hidden");
  };
};

// Timer Functions

const startTurnTimer = () => {
  turnTimeLeft = 30; // Reset time for each turn
  updateTimerDisplay();

  turnTimer = setInterval(() => {
    turnTimeLeft--;

    if (turnTimeLeft <= 0) {
      clearInterval(turnTimer);

      // Switch player and update UI
      switchPlayer();
      updateTurnIndicator(); // Update the turn indicator to reflect the new player
      updateTimerTheme(); // Update the timer theme to match the new player
      resetTurnTimer(); // Reset the timer for the new player

      // Show the custom alert after updating the UI
      showCustomAlert(
        `Time's up for Player ${currentPlayer}! Switching turns...`
      );
    }

    updateTimerDisplay();
  }, 1000); // Update every second
};

const updateTimerDisplay = () => {
  const timerDisplay = document.getElementById("timerText");
  timerDisplay.textContent = `Time left: ${turnTimeLeft}s`;
};

const updateTimerTheme = () => {
  const timerElement = document.getElementById("timer");
  timerElement.setAttribute("data-player", currentPlayer); // Update timer theme based on current player
};

const resetTurnTimer = () => {
  clearInterval(turnTimer);
  document.getElementById("clock").style.animation = "none"; // Stop animation
  setTimeout(() => {
    document.getElementById("clock").style.animation = ""; // Reset animation
  }, 10); // Restart animation
  startTurnTimer();
};

// Place characters for each player
const placeCharacters = (player, characters) => {
  const row = player === "A" ? 0 : 4;
  characters.forEach((char, index) => {
    gameState[row][index] = `${player}-${char}`;
    updateCell(row, index);
  });
};

// Update the visual state of a cell
const updateCell = (row, col) => {
  const cell = document.querySelector(
    `.grid-cell[data-row="${row}"][data-col="${col}"]`
  );
  const character = gameState[row][col];

  if (character) {
    cell.textContent = character;
    const [player, charType] = character.split("-");
    cell.dataset.player = player;
    if (charType.startsWith("H")) {
      cell.dataset.hero = charType;
    }
  } else {
    cell.textContent = "";
    delete cell.dataset.player;
    delete cell.dataset.hero;
  }
};

// Handle cell click to select or move characters
const handleCellClick = (row, col) => {
  const clickedCell = gameState[row][col];
  if (!selectedCharacter && clickedCell.startsWith(currentPlayer)) {
    selectedCharacter = { row, col, char: clickedCell };
    highlightSelectedCell(row, col);
    displaySelectedHero(clickedCell);
    highlightPossibleMoves(row, col, clickedCell);
  } else if (selectedCharacter) {
    const { row: startRow, col: startCol, char } = selectedCharacter;
    const isValid = validateMove(startRow, startCol, row, col);

    if (isValid) {
      gameState[startRow][startCol] = "";
      gameState[row][col] = char;
      updateCell(startRow, startCol);
      updateCell(row, col);
      logMove(
        currentPlayer,
        char,
        startRow,
        startCol,
        row,
        col,
        clickedCell !== ""
      );
      selectedCharacter = null;
      clearHighlightedMoves();

      if (checkForWinner()) {
        showWinningMessage(currentPlayer);
        socket.emit("gameOver", { winner: currentPlayer });
        clearInterval(turnTimer); // Stop the timer when the game is won
      } else {
        switchPlayer();
        updateTurnIndicator();
        updateTimerTheme(); // Update timer theme when switching players
        resetTurnTimer(); // Reset the timer for the new player
        socket.emit("move", { gameState, currentPlayer });
      }
    } else {
      showCustomAlert("Invalid move. Try again."); // Use custom alert
    }
  }
};

// Function to log each move in the move history
const logMove = (
  player,
  char,
  startRow,
  startCol,
  endRow,
  endCol,
  captured
) => {
  moveHistory.push({
    player,
    char,
    startRow,
    startCol,
    endRow,
    endCol,
    captured,
  }); // Add move to history

  const historyList = document.getElementById("history-list");
  const moveEntry = document.createElement("li");
  moveEntry.textContent = `${player}-${char} moved from (${startRow}, ${startCol}) to (${endRow}, ${endCol})`;
  if (captured) {
    moveEntry.textContent += " and captured a piece!";
    moveEntry.dataset.captured = true;
  }
  historyList.appendChild(moveEntry);
};

// Highlight the selected cell
const highlightSelectedCell = (row, col) => {
  document.querySelectorAll(".grid-cell").forEach((cell) => {
    cell.classList.remove("selected");
  });
  document
    .querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"]`)
    .classList.add("selected");
};

// Validate if a move is allowed
const validateMove = (startRow, startCol, endRow, endCol) => {
  const char = gameState[startRow][startCol].split("-")[1];
  const opponentChar = gameState[endRow][endCol];
  const rowDiff = Math.abs(startRow - endRow);
  const colDiff = Math.abs(startCol - endCol);

  if (char.startsWith("P")) {
    return (
      rowDiff <= 1 &&
      colDiff <= 1 &&
      !opponentChar.startsWith(currentPlayer) &&
      (rowDiff === 0 || colDiff === 0)
    );
  } else if (char.startsWith("H1")) {
    const isStraightMove = rowDiff === 0 || colDiff === 0;
    const isTwoStepMove = rowDiff == 2 || colDiff == 2;
    const isPathClear = checkStraightPathClear(
      startRow,
      startCol,
      endRow,
      endCol
    );
    return (
      isStraightMove &&
      isTwoStepMove &&
      isPathClear &&
      !opponentChar.startsWith(currentPlayer)
    );
  } else if (char.startsWith("H2")) {
    const isDiagonalMove = rowDiff === colDiff;
    const isTwoStepDiagonalMove = rowDiff === 2 && colDiff === 2;
    const isDiagonalPathClear = checkDiagonalPathClear(
      startRow,
      startCol,
      endRow,
      endCol
    );
    return (
      isDiagonalMove &&
      isTwoStepDiagonalMove &&
      isDiagonalPathClear &&
      !opponentChar.startsWith(currentPlayer)
    );
  }

  return false;
};

// Check if the path is clear for Hero1
const checkStraightPathClear = (startRow, startCol, endRow, endCol) => {
  if (startRow === endRow) {
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    for (let col = minCol + 1; col < maxCol; col++) {
      if (gameState[startRow][col] !== "") return false;
    }
  } else if (startCol === endCol) {
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    for (let row = minRow + 1; row < maxRow; row++) {
      if (gameState[row][startCol] !== "") return false;
    }
  }
  return true;
};

// Check if the diagonal path is clear for Hero2
const checkDiagonalPathClear = (startRow, startCol, endRow, endCol) => {
  const rowIncrement = endRow > startRow ? 1 : -1;
  const colIncrement = endCol > startCol ? 1 : -1;

  let row = startRow + rowIncrement;
  let col = startCol + colIncrement;

  while (row !== endRow && col !== endCol) {
    if (gameState[row][col] !== "") return false;
    row += rowIncrement;
    col += colIncrement;
  }
  return true;
};

// Switch the current player
const switchPlayer = () => {
  currentPlayer = currentPlayer === "A" ? "B" : "A";
};

// Check for a winner by counting remaining characters
const checkForWinner = () => {
  const playerACount = gameState
    .flat()
    .filter((cell) => cell.startsWith("A")).length;
  const playerBCount = gameState
    .flat()
    .filter((cell) => cell.startsWith("B")).length;
  return playerACount === 0 || playerBCount === 0;
};

// Show a winning message
const showWinningMessage = (winner) => {
  const winnerPopup = document.getElementById("winnerPopup");
  const winnerMessage = document.getElementById("winnerMessage");

  winnerMessage.textContent = `${winner} wins!`;
  winnerPopup.classList.add("active");
};

// Update the turn indicator
const updateTurnIndicator = () => {
  const turnIndicator = document.getElementById("turn-indicator");
  turnIndicator.textContent = `${
    currentPlayer === "A" ? "Player A's" : "Player B's"
  } Turn`;
  turnIndicator.dataset.player = currentPlayer;
};

// Socket event to handle moves from other players
socket.on("move", (data) => {
  gameState = data.gameState;
  currentPlayer = data.currentPlayer;
  gameState.forEach((row, i) => row.forEach((cell, j) => updateCell(i, j)));
  updateTurnIndicator();
});

// Highlight possible moves for the selected character
const highlightPossibleMoves = (row, col, char) => {
  clearHighlightedMoves();
  let possibleMoves = [];

  if (char.includes("P")) {
    possibleMoves = getPawnMoves(row, col);
  } else if (char.includes("H1")) {
    possibleMoves = getHero1Moves(row, col);
  } else if (char.includes("H2")) {
    possibleMoves = getHero2Moves(row, col);
  }

  possibleMoves.forEach((move) => {
    const targetCell = document.querySelector(
      `.grid-cell[data-row="${move.row}"][data-col="${move.col}"]`
    );

    if (targetCell) {
      targetCell.classList.add("highlighted");
    }
  });
};

// Calculate possible moves for a Pawn
const getPawnMoves = (row, col) => {
  const moves = [
    { row: row - 1, col: col },
    { row: row + 1, col: col },
    { row: row, col: col - 1 },
    { row: row, col: col + 1 },
  ];
  return moves.filter(
    (move) =>
      isValidCell(move.row, move.col) &&
      !gameState[move.row][move.col].startsWith(currentPlayer)
  );
};

// Calculate possible moves for Hero1
const getHero1Moves = (row, col) => {
  const moves = [
    { row: row - 2, col: col },
    { row: row + 2, col: col },
    { row: row, col: col - 2 },
    { row: row, col: col + 2 },
  ];
  return moves.filter(
    (move) =>
      isValidCell(move.row, move.col) &&
      checkStraightPathClear(row, col, move.row, move.col)
  );
};

// Calculate possible moves for Hero2
const getHero2Moves = (row, col) => {
  const moves = [
    { row: row - 2, col: col - 2 },
    { row: row - 2, col: col + 2 },
    { row: row + 2, col: col - 2 },
    { row: row + 2, col: col + 2 },
  ];
  return moves.filter(
    (move) =>
      isValidCell(move.row, move.col) &&
      checkDiagonalPathClear(row, col, move.row, move.col)
  );
};

// Check if a cell is within the board
const isValidCell = (row, col) => {
  return row >= 0 && row < 5 && col >= 0 && col < 5;
};

// Clear all highlighted moves
const clearHighlightedMoves = () => {
  document.querySelectorAll(".grid-cell.highlighted").forEach((cell) => {
    cell.classList.remove("highlighted");
  });
};

// Display the selected hero below the grid
const displaySelectedHero = (heroName) => {
  const selectedHeroDisplay = document.getElementById("selectedHeroDisplay");
  selectedHeroDisplay.innerHTML = `Selected Hero: ${heroName}`;
};

// Function to reset the game
const resetGame = () => {
  // Reset game state
  gameState = [
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
  ];
  selectedCharacter = null;
  currentPlayer = "A";

  // Clear move history
  moveHistory = [];
  const historyList = document.getElementById("history-list");
  historyList.innerHTML = "";

  // Reset game UI
  initializeGame();
  // Hide winning message if displayed
  const gameMessage = document.getElementById("game-message");
  gameMessage.classList.add("hidden");
  gameMessage.textContent = "";

  // Notify server of game reset if applicable
  socket.emit("resetGame");
};

// Event listener for reset button
const resetButton = document.getElementById("resetGame");
resetButton.addEventListener("click", resetGame);

// Event listener for play again button
const playAgainButton = document.getElementById("playAgainButton");
// playAgainButton.addEventListener("click", resetGame);
playAgainButton.addEventListener("click", () => {
  // Hide winner popup if displayed
  const winnerPopup = document.getElementById("winnerPopup");
  winnerPopup.classList.remove("active"); // Ensure popup is hidden when reset
  winnerPopup.style.display = "none";
  resetGame();
});
// Event listeners for game rules popup
const showRulesButton = document.getElementById("showRules");
const rulesPopup = document.getElementById("rulesPopup");
const closeRulesButton = document.getElementById("closeRules");
const rulesOverlay = document.getElementById("rulesOverlay");

showRulesButton.addEventListener("click", () => {
  rulesPopup.classList.add("active");
  rulesOverlay.style.display = "block";
  rulesPopup.style.display = "block";
});

closeRulesButton.addEventListener("click", () => {
  rulesPopup.classList.remove("active");
  rulesOverlay.style.display = "none";
  setTimeout(() => {
    rulesPopup.style.display = "none";
  }, 300);
});

rulesOverlay.addEventListener("click", () => {
  rulesPopup.classList.remove("active");
  rulesOverlay.style.display = "none";
  setTimeout(() => {
    rulesPopup.style.display = "none";
  }, 300);
});

// Initialize the game when the script loads
initializeGame();
