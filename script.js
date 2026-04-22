let currentCans = 0;
let timeLeft = 30;
let goalCans = 20;
let baseSpawnDelay = 900;
let minSpawnDelay = 400;
let obstacleChance = 0.25;
let cansPerSpawn = 1;
let cleanCansPerSpawn = 0;
let dirtyCansPerSpawn = 0;

const SPEEDUP_START_TIME = 15;
const GAME_START_DELAY_MS = 5000;
const EASY_DIRTY_CAN_LIFETIME_MS = 900;

let gameActive = false;
let spawnInterval;
let timerInterval;
let startDelayTimeout;

const gridSize = 9;

const sounds = {
  collect: new Audio('sounds/collect.mp3'),
  point: new Audio('sounds/Point.mp3'),
  miss: new Audio('sounds/miss.mp3'),
  mistake: new Audio('sounds/Mistake.mp3'),
  click: new Audio('sounds/click.mp3'),
  win: new Audio('sounds/Win.mp3'),
  gameStart: new Audio('sounds/Game_Start.mp3')
};

Object.values(sounds).forEach(sound => {
  sound.preload = 'auto';
});

sounds.collect.volume = 0.45;
sounds.point.volume = 0.45;
sounds.miss.volume = 0.55;
sounds.mistake.volume = 0.55;
sounds.click.volume = 0.35;
sounds.win.volume = 0.65;
sounds.gameStart.volume = 0.6;

const goalCansElement = document.getElementById('goal-cans');
const currentCansElement = document.getElementById('current-cans');
const timerElement = document.getElementById('timer');
const achievementElement = document.getElementById('achievements');
const difficultySelect = document.getElementById('difficulty');
const startButton = document.getElementById('start-game');
const resetButton = document.getElementById('reset-game');
const gridElement = document.querySelector('.game-grid');

function playSound(name) {
  const sound = sounds[name];
  if (!sound) return;

  sound.currentTime = 0;
  sound.play().catch(() => {
    // Ignore play errors (missing file or browser autoplay policy).
  });
}

const difficultySettings = {
  easy: {
    time: 35,
    goal: 15,
    baseDelay: 1000,
    minDelay: 500,
    obstacleChance: 0.15,
    cansPerSpawn: 2,
    cleanCansPerSpawn: 1,
    dirtyCansPerSpawn: 1
  },
  normal: {
    time: 30,
    goal: 20,
    baseDelay: 900,
    minDelay: 400,
    obstacleChance: 0.25,
    cansPerSpawn: 1,
    cleanCansPerSpawn: 0,
    dirtyCansPerSpawn: 0
  },
  hard: {
    time: 25,
    goal: 25,
    baseDelay: 700,
    minDelay: 250,
    obstacleChance: 0.35,
    cansPerSpawn: 1,
    cleanCansPerSpawn: 0,
    dirtyCansPerSpawn: 0
  }
};

function applyDifficulty() {
  const selected = difficultySelect.value;
  const settings = difficultySettings[selected];

  timeLeft = settings.time;
  goalCans = settings.goal;
  baseSpawnDelay = settings.baseDelay;
  minSpawnDelay = settings.minDelay;
  obstacleChance = settings.obstacleChance;
  cansPerSpawn = settings.cansPerSpawn;
  cleanCansPerSpawn = settings.cleanCansPerSpawn;
  dirtyCansPerSpawn = settings.dirtyCansPerSpawn;

  goalCansElement.textContent = goalCans;
  updateTimer();
}

function getSpawnDelay() {
  if (timeLeft > SPEEDUP_START_TIME) {
    return baseSpawnDelay;
  }

  const speedupRatio = (SPEEDUP_START_TIME - timeLeft) / SPEEDUP_START_TIME;
  const speedCurve = speedupRatio * speedupRatio;
  const delayRange = baseSpawnDelay - minSpawnDelay;

  return Math.max(
    minSpawnDelay,
    Math.round(baseSpawnDelay - speedCurve * delayRange)
  );
}

function updateSpawnRate() {
  clearInterval(spawnInterval);
  spawnInterval = setInterval(spawnWaterCan, getSpawnDelay());
}

function createGrid() {
  gridElement.innerHTML = '';
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < gridSize; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    fragment.appendChild(cell);
  }

  gridElement.appendChild(fragment);
}

function updateScore() {
  currentCansElement.textContent = currentCans;
}

function updateTimer() {
  timerElement.textContent = timeLeft;
}

function showAchievement(message) {
  achievementElement.textContent = message;
  achievementElement.classList.add('show');

  setTimeout(() => {
    achievementElement.classList.remove('show');
  }, 1400);
}

function clearAchievement() {
  achievementElement.textContent = '';
  achievementElement.classList.remove('show');
}

function clearGridCells() {
  document.querySelectorAll('.grid-cell').forEach(cell => {
    clearDirtyDespawnTimeout(cell);
    cell.innerHTML = '';
  });
}

function stopGameLoops() {
  clearTimeout(startDelayTimeout);
  clearInterval(spawnInterval);
  clearInterval(timerInterval);
}

function renderCanMarkup(isObstacle) {
  return `
      <div class="water-can-wrapper">
        <div class="water-can${isObstacle ? ' dirty-can' : ''}" aria-label="${isObstacle ? 'Dirty can obstacle' : 'Collect water can'}"></div>
      </div>
    `;
}

function clearDirtyDespawnTimeout(cell) {
  if (!cell) return;

  const timeoutId = cell.dataset.dirtyTimeoutId;
  if (timeoutId) {
    clearTimeout(Number(timeoutId));
    delete cell.dataset.dirtyTimeoutId;
  }
}

function scheduleEasyDirtyDespawn(cell) {
  clearDirtyDespawnTimeout(cell);

  const timeoutId = setTimeout(() => {
    if (!gameActive || difficultySelect.value !== 'easy') return;

    const dirtyCanStillPresent = cell.querySelector('.dirty-can');
    if (!dirtyCanStillPresent) return;

    cell.innerHTML = '';
    delete cell.dataset.dirtyTimeoutId;
    spawnReplacementCan(true);
  }, EASY_DIRTY_CAN_LIFETIME_MS);

  cell.dataset.dirtyTimeoutId = String(timeoutId);
}

function placeCanInCell(cell, isObstacle = Math.random() < obstacleChance) {
  clearDirtyDespawnTimeout(cell);
  cell.innerHTML = renderCanMarkup(isObstacle);

  if (isObstacle) {
    cell.querySelector('.dirty-can').addEventListener('click', hitObstacle);

    if (difficultySelect.value === 'easy') {
      scheduleEasyDirtyDespawn(cell);
    }

    return;
  }

  cell.querySelector('.water-can').addEventListener('click', collectCan);
}

function spawnReplacementCan(isObstacle = null) {
  if (!gameActive) return;

  const emptyCells = Array.from(document.querySelectorAll('.grid-cell')).filter(
    cell => cell.innerHTML.trim() === ''
  );

  if (emptyCells.length === 0) return;

  const replacementCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  placeCanInCell(replacementCell, isObstacle === null ? Math.random() < obstacleChance : isObstacle);
}

function spawnWaterCan() {
  if (!gameActive) return;

  const cells = Array.from(document.querySelectorAll('.grid-cell'));
  clearGridCells();

  if (difficultySelect.value === 'easy') {
    const shuffledCells = [...cells].sort(() => Math.random() - 0.5);
    let nextCellIndex = 0;

    const dirtyCount = Math.min(dirtyCansPerSpawn, shuffledCells.length);
    for (let i = 0; i < dirtyCount; i++) {
      placeCanInCell(shuffledCells[nextCellIndex], true);
      nextCellIndex++;
    }

    const remainingCells = shuffledCells.length - nextCellIndex;
    const cleanCount = Math.min(cleanCansPerSpawn, remainingCells);
    for (let i = 0; i < cleanCount; i++) {
      placeCanInCell(shuffledCells[nextCellIndex], false);
      nextCellIndex++;
    }

    return;
  }

  const spawnCount = Math.min(cansPerSpawn, cells.length);
  const shuffledCells = [...cells].sort(() => Math.random() - 0.5);
  const selectedCells = shuffledCells.slice(0, spawnCount);

  selectedCells.forEach(cell => {
    placeCanInCell(cell);
  });
}

function collectCan() {
  if (!gameActive) return;

  playSound('point');

  currentCans++;
  updateScore();

  const parentCell = this.closest('.grid-cell');
  clearDirtyDespawnTimeout(parentCell);
  parentCell.innerHTML = '';
  spawnReplacementCan(false);

  if (currentCans === Math.floor(goalCans / 2)) {
    showAchievement('Halfway there!');
  } else if (currentCans === goalCans - 5) {
    showAchievement('Almost there — keep going!');
  }

  if (currentCans >= goalCans) {
    endGame(true);
  }
}

function hitObstacle() {
  if (!gameActive) return;

  const hadPointToLose = currentCans > 0;
  currentCans = Math.max(0, currentCans - 1);

  if (hadPointToLose) {
    playSound('mistake');
  }

  updateScore();

  const parentCell = this.closest('.grid-cell');
  clearDirtyDespawnTimeout(parentCell);
  parentCell.innerHTML = '';
  spawnReplacementCan(true);
  showAchievement('Oops! Dirty can — score -1');
}

function startGame() {
  if (gameActive) return;

  applyDifficulty();

  gameActive = true;
  playSound('gameStart');
  currentCans = 0;

  updateScore();
  updateTimer();
  clearAchievement();

  createGrid();

  clearTimeout(startDelayTimeout);
  startDelayTimeout = setTimeout(() => {
    if (!gameActive) return;

    spawnWaterCan();
    updateSpawnRate();

    timerInterval = setInterval(() => {
      timeLeft--;
      updateTimer();

      if (timeLeft <= 0) {
        endGame(false);
      } else {
        updateSpawnRate();
      }
    }, 1000);
  }, GAME_START_DELAY_MS);
}

function endGame(won) {
  gameActive = false;
  stopGameLoops();
  clearGridCells();

  if (won) {
    playSound('win');
    showAchievement('You win! Clean water champion!');
    launchConfetti();
  } else {
    playSound('miss');
    showAchievement(`Time’s up! You collected ${currentCans} cans.`);
  }
}

function resetGame() {
  gameActive = false;
  stopGameLoops();

  currentCans = 0;
  applyDifficulty();
  updateScore();
  clearAchievement();

  document.querySelectorAll('.confetti-piece').forEach(piece => piece.remove());
  createGrid();
}

function launchConfetti() {
  for (let i = 0; i < 80; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-piece';

    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.animationDelay = Math.random() * 0.5 + 's';
    confetti.style.animationDuration = 2 + Math.random() * 2 + 's';

    document.body.appendChild(confetti);

    setTimeout(() => {
      confetti.remove();
    }, 4000);
  }
}

createGrid();
applyDifficulty();
updateScore();

startButton.addEventListener('click', () => {
  playSound('click');
  startGame();
});

resetButton.addEventListener('click', () => {
  playSound('click');
  resetGame();
});

difficultySelect.addEventListener('change', () => {
  playSound('click');
  resetGame();
});