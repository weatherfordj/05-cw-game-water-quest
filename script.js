let currentCans = 0;
let timeLeft = 30;
let goalCans = 20;
let baseSpawnDelay = 900;
let minSpawnDelay = 400;
let obstacleChance = 0.25;

const SPEEDUP_START_TIME = 15;
const GAME_START_DELAY_MS = 5000;

let gameActive = false;
let spawnInterval;
let timerInterval;
let startDelayTimeout;

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
    obstacleChance: 0.15
  },
  normal: {
    time: 30,
    goal: 20,
    baseDelay: 900,
    minDelay: 400,
    obstacleChance: 0.25
  },
  hard: {
    time: 25,
    goal: 25,
    baseDelay: 700,
    minDelay: 250,
    obstacleChance: 0.35
  }
};

function applyDifficulty() {
  const selected = document.getElementById('difficulty').value;
  const settings = difficultySettings[selected];

  timeLeft = settings.time;
  goalCans = settings.goal;
  baseSpawnDelay = settings.baseDelay;
  minSpawnDelay = settings.minDelay;
  obstacleChance = settings.obstacleChance;

  document.getElementById('goal-cans').textContent = goalCans;
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
  const grid = document.querySelector('.game-grid');
  grid.innerHTML = '';

  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    grid.appendChild(cell);
  }
}

function updateScore() {
  document.getElementById('current-cans').textContent = currentCans;
}

function updateTimer() {
  document.getElementById('timer').textContent = timeLeft;
}

function showAchievement(message) {
  const achievement = document.getElementById('achievements');
  achievement.textContent = message;
  achievement.classList.add('show');

  setTimeout(() => {
    achievement.classList.remove('show');
  }, 1400);
}

function spawnWaterCan() {
  if (!gameActive) return;

  const cells = document.querySelectorAll('.grid-cell');
  cells.forEach(cell => (cell.innerHTML = ''));

  const randomCell = cells[Math.floor(Math.random() * cells.length)];
  const isObstacle = Math.random() < obstacleChance;

  if (isObstacle) {
    randomCell.innerHTML = `
      <div class="water-can-wrapper">
        <div class="water-can dirty-can" aria-label="Dirty can obstacle"></div>
      </div>
    `;

    const dirtyCan = randomCell.querySelector('.dirty-can');
    dirtyCan.addEventListener('click', hitObstacle);
  } else {
    randomCell.innerHTML = `
      <div class="water-can-wrapper">
        <div class="water-can" aria-label="Collect water can"></div>
      </div>
    `;

    const waterCan = randomCell.querySelector('.water-can');
    waterCan.addEventListener('click', collectCan);
  }
}

function collectCan() {
  if (!gameActive) return;

  playSound('point');

  currentCans++;
  updateScore();

  this.parentElement.parentElement.innerHTML = '';

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

  this.parentElement.parentElement.innerHTML = '';
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

  const achievement = document.getElementById('achievements');
  achievement.textContent = '';
  achievement.classList.remove('show');

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
  clearTimeout(startDelayTimeout);
  clearInterval(spawnInterval);
  clearInterval(timerInterval);

  document.querySelectorAll('.grid-cell').forEach(cell => {
    cell.innerHTML = '';
  });

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
  clearTimeout(startDelayTimeout);
  clearInterval(spawnInterval);
  clearInterval(timerInterval);

  currentCans = 0;
  applyDifficulty();
  updateScore();

  const achievement = document.getElementById('achievements');
  achievement.textContent = '';
  achievement.classList.remove('show');

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

const startButton = document.getElementById('start-game');
const resetButton = document.getElementById('reset-game');
const difficultySelect = document.getElementById('difficulty');

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