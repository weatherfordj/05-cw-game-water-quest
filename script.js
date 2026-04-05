const GAME_TIME = 30;
const GOAL_CANS = 20;
const BASE_SPAWN_DELAY = 900;
const MIN_SPAWN_DELAY = 400;
const SPEEDUP_START_TIME = 15;
const OBSTACLE_CHANCE = 0.25; // 25% chance of obstacle

let currentCans = 0;
let timeLeft = GAME_TIME;
let gameActive = false;
let spawnInterval;
let timerInterval;

function getSpawnDelay() {
  if (timeLeft > SPEEDUP_START_TIME) {
    return BASE_SPAWN_DELAY;
  }

  const speedupRatio = (SPEEDUP_START_TIME - timeLeft) / SPEEDUP_START_TIME;
  const speedCurve = speedupRatio * speedupRatio;
  const delayRange = BASE_SPAWN_DELAY - MIN_SPAWN_DELAY;

  return Math.max(
    MIN_SPAWN_DELAY,
    Math.round(BASE_SPAWN_DELAY - speedCurve * delayRange)
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
  const isObstacle = Math.random() < OBSTACLE_CHANCE;

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

  currentCans++;
  updateScore();

  this.parentElement.parentElement.innerHTML = '';

  if (currentCans === 5) {
    showAchievement('Great start — every can counts!');
  } else if (currentCans === 10) {
    showAchievement('Amazing — you are building momentum!');
  } else if (currentCans === 15) {
    showAchievement('Keep going — clean water is worth it!');
  }

  if (currentCans >= GOAL_CANS) {
    endGame(true);
  }
}

function hitObstacle() {
  if (!gameActive) return;

  currentCans = Math.max(0, currentCans - 1);
  updateScore();

  this.parentElement.parentElement.innerHTML = '';
  showAchievement('Oops! Dirty can — score -1');
}

function startGame() {
  if (gameActive) return;

  gameActive = true;
  currentCans = 0;
  timeLeft = GAME_TIME;

  updateScore();
  updateTimer();

  const achievement = document.getElementById('achievements');
  achievement.textContent = '';
  achievement.classList.remove('show');

  createGrid();
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
}

function endGame(won) {
  gameActive = false;
  clearInterval(spawnInterval);
  clearInterval(timerInterval);

  document.querySelectorAll('.grid-cell').forEach(cell => {
    cell.innerHTML = '';
  });

  if (won) {
    showAchievement('You win! Clean water champion!');
    launchConfetti();
  } else {
    showAchievement(`Time’s up! You collected ${currentCans} cans.`);
  }
}

function resetGame() {
  gameActive = false;
  clearInterval(spawnInterval);
  clearInterval(timerInterval);

  currentCans = 0;
  timeLeft = GAME_TIME;

  updateScore();
  updateTimer();

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
updateScore();
updateTimer();

document.getElementById('start-game').addEventListener('click', startGame);
document.getElementById('reset-game').addEventListener('click', resetGame);