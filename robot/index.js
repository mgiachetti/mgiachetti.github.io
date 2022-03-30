// @ts-check
/** @enum {string} */
const CellType = {
  empty: 'e',
  wall: 'w',
  armV: 'v',
  armH: 'h',
  armUL: 'ul',
  armUR: 'ur',
  armDL: 'dl',
  armDR: 'dr',
  gripper: 'g',
  gripperU: 'gu',
  gripperD: 'gd',
  gripperR: 'gr',
  gripperL: 'gl',
  target: 'x',
  collision: 'c',
};

/** @enum {string} */
const Command = {
  up: 'u',
  right: 'r',
  down: 'd',
  left: 'l',
};
const CommandChar = {
  [Command.up]: '↑',
  [Command.right]: '→',
  [Command.down]: '↓',
  [Command.left]: '←',
};

/**
  @typedef {{
    x: number;
    y: number;
 }} Point;
*/

/**
  @typedef {CellType[][]} Level;
*/

/** @type {Level} */
let g_level;
/** @type {Command[]} */
let g_commands = [];
const g_canvas = /** @type HTMLCanvasElement */(document.getElementById('canvas'));
const dpr = window.devicePixelRatio;
const rect = g_canvas.getBoundingClientRect();
const cw = Math.ceil(rect.width);
const ch = Math.ceil(rect.height);
g_canvas.style.width = `${cw}px`;
g_canvas.style.height = `${ch}px`;
g_canvas.width = cw * dpr;
g_canvas.height = ch * dpr;
const g_ctx = g_canvas.getContext('2d');
/** @type {number} */
let g_cellsY;
/** @type {number} */
let g_cellsX;
let g_running = false;
let g_stopRunning = false;

function moveDown() {
  g_commands.push(Command.down);
}
function moveUp() {
  g_commands.push(Command.up);
}
function moveRight() {
  g_commands.push(Command.right);
}
function moveLeft() {
  g_commands.push(Command.left);
}
function removeLastMove() {
  g_commands.pop();
}

/**
 * @param {CellType[][]} cells
 * @param {CellType} cellType
 * @return {Point | undefined}
 */
function findCell(cells, cellType) {
  for (let y = 0; y < g_cellsY; ++y) {
    for (let x = 0; x < g_cellsX; ++x) {
      if (cells[y][x] === cellType) return { x, y };
    }
  }
  return undefined;
}

/**
 * @param {CellType[][]} cells
 * @param {Command[]} commands
 */
function applyCommandsToLevel(cells, commands) {
  let pos = findCell(cells, CellType.gripper);
  if (!pos) return;
  /** @type {CellType[][]} */
  let newCells = (cells.map(row => row.slice()));
  let prevCommand = commands[0];
  const moveCellType = {
    'uu': CellType.armV,
    'dd': CellType.armV,
    'll': CellType.armH,
    'rr': CellType.armH,
    'ur': CellType.armUR,
    'ld': CellType.armUR,
    'ul': CellType.armUL,
    'rd': CellType.armUL,
    'dr': CellType.armDR,
    'lu': CellType.armDR,
    'dl': CellType.armDL,
    'ru': CellType.armDL,
  };
  console.clear();
  for (let i = 0; i < commands.length; ++i) {
    const command = commands[i];
    const move = prevCommand + command;
    newCells[pos.y][pos.x] = moveCellType[move];
    console.log(newCells[pos.y][pos.x]);
    switch (command) {
      case Command.up:
        pos.y = Math.max(0, pos.y - 1);
        break;
      case Command.right:
        pos.x = Math.min(g_cellsX - 1, pos.x + 1);
        break;
      case Command.down:
        pos.y = Math.min(g_cellsY - 1, pos.y + 1);
        break;
      case Command.left:
        pos.x = Math.max(0, pos.x - 1);
        break;
    }
    if (newCells[pos.y][pos.x] !== CellType.empty && newCells[pos.y][pos.x] !== CellType.target) {
      // colision
      newCells[pos.y][pos.x] = CellType.collision;
      break;
    }
    newCells[pos.y][pos.x] = CellType.gripper+command;
    prevCommand = command;
  }
  return newCells;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Point} from
 * @param {Point} to
 */
function drawArm(ctx, from, to) {
  ctx.strokeStyle = '#ffff00';
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(from.x, to.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Command} direction
 */
function drawGripper(ctx, direction) {
  const angle = {
    [Command.up]: 0,
    [Command.down]: Math.PI,
    [Command.right]: Math.PI/2,
    [Command.left]: -Math.PI/2,
  };
  ctx.save();
  ctx.translate(0.5, 0.5);
  ctx.rotate(angle[direction]);
  ctx.translate(-0.5, -0.5);
  ctx.lineWidth = 0.2;
  ctx.strokeStyle = '#aaaaaa';
  ctx.beginPath();
  ctx.moveTo(0.2, 0.2)
  ctx.lineTo(0.2, 0.5);
  ctx.lineTo(0.5, 0.7);
  ctx.lineTo(0.8, 0.5);
  ctx.lineTo(0.8, 0.2);
  ctx.stroke();
  drawArm(ctx, {x: 0.5, y: 1}, {x: 0.5, y: 0.8});
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 */
function drawTarget(ctx) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0.35, 0.35, 0.3, 0.3);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Level} level
*/
function draw(ctx, level) {
  const dpr = window.devicePixelRatio;
  const w = g_canvas.width / dpr;
  const h = g_canvas.height / dpr;
  const cells_oy = 40;
  const cells_y = g_level.length;
  const cells_x = g_level[0].length;
  const cell_dx = w / cells_x;
  const cell_dy = (h - cells_oy) / cells_y;
  
  
  ctx.resetTransform();
  ctx.scale(dpr, dpr);

  //clear gray
  ctx.fillStyle = '#aaa';
  ctx.fillRect(0, 0, w, h);

  ctx.font = '20px arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  //cell size
  for (let y = 0; y < cells_y; ++y) {
    for (let x = 0; x < cells_x; ++x) {
      const cell = level[y][x];
      ctx.save();
      ctx.translate(x * cell_dx, y * cell_dy + cells_oy);
      ctx.scale(cell_dx, cell_dy);

      ctx.fillStyle = cell === CellType.wall ? '#999999'
        : cell === CellType.collision ? '#ff0000'
        : '#dddddd';
      ctx.fillRect(0.5 / cell_dx, 0.5 / cell_dy, 1 - 2 * 0.5 / cell_dx, 1 - 2 * 0.5 / cell_dy);

      switch (cell) {
        case CellType.armV:
          drawArm(ctx, { x: 0.5, y: 0 }, { x: 0.5, y: 1 });
          break;
        case CellType.armH:
          drawArm(ctx, { x: 0, y: 0.5 }, { x: 1, y: 0.5 });
          break;
        case CellType.armUR:
          drawArm(ctx, { x: 0.5, y: 1 }, { x: 1, y: 0.5 });
          break;
        case CellType.armUL:
          drawArm(ctx, { x: 0.5, y: 1 }, { x: 0, y: 0.5 });
          break;
        case CellType.armDL:
          drawArm(ctx, { x: 0.5, y: 0 }, { x: 0, y: 0.5 });
          break;
        case CellType.armDR:
          drawArm(ctx, { x: 0.5, y: 0 }, { x: 1, y: 0.5 });
          break;
        case CellType.gripperU:
        case CellType.gripper:
          drawGripper(ctx, Command.up);
          break;
        case CellType.gripperD:
          drawGripper(ctx, Command.down);
          break;
        case CellType.gripperR:
          drawGripper(ctx, Command.right);
          break;
        case CellType.gripperL:
          drawGripper(ctx, Command.left);
          break;
        case CellType.target:
          drawTarget(ctx);
          break;
      }
      ctx.restore();
    }
  }

  // commands
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.font = '900 18px Courier New';
  ctx.textAlign = 'left';
  ctx.fillText(`Commands:`, 10, 20);
  const command = g_commands.map((c) => CommandChar[c]);
  const commandMaxLength = 26;
  if (command.length > commandMaxLength) {
    ctx.fillText(`${command.slice(0,commandMaxLength).join(' ')}`, 120, 10);
    ctx.fillText(`${command.slice(commandMaxLength).join(' ')}`, 120, 26);
  } else {
    ctx.fillText(`${command.join(' ')}`, 120, 20);
  }
}

/**
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stop() {
  if (g_running) {
    g_stopRunning = true;
  }
}

async function start() {
  g_running = true;

  for (let step = 1; step <= g_commands.length; ++step) {
    if (g_stopRunning) break;
    const level = applyCommandsToLevel(g_level, g_commands.slice(0, step));
    draw(g_ctx, level);
    await delay(20);

    if (findCell(level, CellType.collision)) {
      // colision
      alert('Colision');
      break;
    }

    if (!findCell(level, CellType.target)) {
      // win
      alert('Win');
      resetLevel();
      break;
    }
    await delay(300);
  }

  g_stopRunning = false;
  g_running = false;
  draw(g_ctx, g_level);
}

/**
 * @param {KeyboardEvent} e
 */
function onKeydown(e) {
  e.preventDefault();
  if (e.key === ' ') {
    g_running ? stop() : start();
    return;
  }
  if (g_running) return;
  if (e.key === 'ArrowLeft') {
    moveLeft();
  } else if (e.key === 'ArrowRight') {
    moveRight();
  } else if (e.key === 'ArrowUp') {
    moveUp();
  } else if (e.key === 'ArrowDown') {
    moveDown();
  } else if (e.key === 'Backspace') {
    removeLastMove();
  }
  draw(g_ctx, g_level);
}

/**
 * @param {Level} level
 * @param {Point} point
 * @param {CellType} type
 */
function floodFill(level, point, type) {
  const newLevel = level.map((row) => row.map((cell) => cell));;
  const stack = [point];
  while (stack.length > 0) {
    const p = stack.pop();
    if (newLevel[p.y][p.x] === CellType.wall) continue;
    if (newLevel[p.y][p.x] === type) continue;
    newLevel[p.y][p.x] = type;
    stack.push({ x: p.x - 1, y: p.y });
    stack.push({ x: p.x + 1, y: p.y });
    stack.push({ x: p.x, y: p.y - 1});
    stack.push({ x: p.x, y: p.y + 1});
  }
  return newLevel;
}

/**
 * @param {Level} level
 */
function validLevel(level) {
  const targetPoint = findCell(level, CellType.target);
  const startPoint = findCell(level, CellType.gripper);
  const newLevel = floodFill(level, targetPoint, CellType.collision);
  return newLevel[startPoint.y][startPoint.x] !== CellType.gripper;
}

/**
 * @param {number} width
 * @param {number} height
 * @returns {Level}
 */
function createEmptyLevel(width, height) {
  const level = [...Array(height)]
    .map((_, y) => [...Array(width)]
      .map((_,x) => x*y === 0 || y === height-1 || x === width-1 ? CellType.wall : CellType.empty));
  level[height-2][1] = CellType.gripper;
  return level;
}
function resetLevel() {
  g_level = createEmptyLevel(12, 12);
  g_cellsY = g_level.length;
  g_cellsX = g_level[0].length;

  const targetLength = 1;
  for (let i = 0; i < targetLength; ++i) {
    let tx = 0;
    let ty = 0;
    do {
      tx = Math.random() * g_cellsX | 0;
      ty = Math.random() * g_cellsY | 0;
    } while(g_level[ty][tx] !== CellType.empty)
    g_level[ty][tx] = CellType.target;
  }

  for(let i = 0; i < 80; ++i) {
    const tx = Math.random() * g_cellsX | 0;
    const ty = Math.random() * g_cellsY | 0;
    if (g_level[ty][tx] === CellType.empty) {
      g_level[ty][tx] = CellType.wall;
      if (!validLevel(g_level)) {
        g_level[ty][tx] = CellType.empty;
      }
    }
  }

  g_commands = [];

  draw(g_ctx, g_level);
}

function init() {
  resetLevel();
  document.addEventListener('keydown', onKeydown, false);
}

init();
