// 消消乐游戏主逻辑
const ROWS = 8;
const COLS = 8;
const TYPES = 6;
const EMOJIS = ['🔴', '🟡', '🔵', '🟢', '🟣', '💗'];

let board = [];
let score = 0;
let moves = 30;
let selected = null;
let isProcessing = false;

const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const movesEl = document.getElementById('moves');
const gameOverEl = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const playAgainBtn = document.getElementById('play-again-btn');

// 初始化游戏
function init() {
    score = 0;
    moves = 30;
    selected = null;
    isProcessing = false;
    updateUI();
    gameOverEl.classList.add('hidden');
    generateBoard();
    renderBoard();
}

// 生成棋盘（确保初始没有匹配）
function generateBoard() {
    board = [];
    for (let r = 0; r < ROWS; r++) {
        board[r] = [];
        for (let c = 0; c < COLS; c++) {
            let type;
            do {
                type = randomType();
            } while (wouldMatch(r, c, type));
            board[r][c] = type;
        }
    }
}

function randomType() {
    return Math.floor(Math.random() * TYPES);
}

// 检查放置某个类型是否会产生初始匹配
function wouldMatch(row, col, type) {
    if (col >= 2 && board[row][col - 1] === type && board[row][col - 2] === type) {
        return true;
    }
    if (row >= 2 && board[row - 1][col] === type && board[row - 2][col] === type) {
        return true;
    }
    return false;
}

// 渲染棋盘
function renderBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const tile = document.createElement('div');
            tile.classList.add('tile', `tile-${board[r][c]}`);
            tile.textContent = EMOJIS[board[r][c]];
            tile.dataset.row = r;
            tile.dataset.col = c;
            tile.addEventListener('click', () => onTileClick(r, c));
            boardEl.appendChild(tile);
        }
    }
}

// 获取 tile DOM 元素
function getTileEl(row, col) {
    return boardEl.children[row * COLS + col];
}

// 点击/触摸宝石
function onTileClick(row, col) {
    if (isProcessing) return;

    if (selected === null) {
        selected = { row, col };
        getTileEl(row, col).classList.add('selected');
    } else if (selected.row === row && selected.col === col) {
        getTileEl(row, col).classList.remove('selected');
        selected = null;
    } else {
        const prev = selected;
        getTileEl(prev.row, prev.col).classList.remove('selected');
        selected = null;

        if (isAdjacent(prev, { row, col })) {
            trySwap(prev, { row, col });
        } else {
            // 选中新的宝石（而不是什么都不做）
            selected = { row, col };
            getTileEl(row, col).classList.add('selected');
        }
    }
}

// 判断是否相邻
function isAdjacent(a, b) {
    return (Math.abs(a.row - b.row) + Math.abs(a.col - b.col)) === 1;
}

// 尝试交换
async function trySwap(a, b) {
    isProcessing = true;

    swap(a, b);
    renderBoard();

    const matches = findMatches();
    if (matches.length > 0) {
        moves--;
        updateUI();
        await processMatches(matches);
    } else {
        await delay(200);
        swap(a, b);
        renderBoard();
    }

    isProcessing = false;

    if (moves <= 0) {
        endGame();
    }
}

// 交换两个位置
function swap(a, b) {
    const temp = board[a.row][a.col];
    board[a.row][a.col] = board[b.row][b.col];
    board[b.row][b.col] = temp;
}

// 查找所有匹配
function findMatches() {
    const matched = new Set();

    // 横向检查
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS - 2; c++) {
            const type = board[r][c];
            if (type !== -1 && board[r][c + 1] === type && board[r][c + 2] === type) {
                let end = c + 2;
                while (end + 1 < COLS && board[r][end + 1] === type) end++;
                for (let i = c; i <= end; i++) {
                    matched.add(`${r},${i}`);
                }
                c = end;
            }
        }
    }

    // 纵向检查
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS - 2; r++) {
            const type = board[r][c];
            if (type !== -1 && board[r + 1][c] === type && board[r + 2][c] === type) {
                let end = r + 2;
                while (end + 1 < ROWS && board[end + 1][c] === type) end++;
                for (let i = r; i <= end; i++) {
                    matched.add(`${i},${c}`);
                }
                r = end;
            }
        }
    }

    return Array.from(matched).map(s => {
        const [r, c] = s.split(',').map(Number);
        return { row: r, col: c };
    });
}

// 处理匹配：消除 -> 下落 -> 检查连锁
async function processMatches(matches) {
    matches.forEach(({ row, col }) => {
        const el = getTileEl(row, col);
        if (el) el.classList.add('matched');
    });

    score += matches.length * 10;
    updateUI();

    await delay(300);

    matches.forEach(({ row, col }) => {
        board[row][col] = -1;
    });

    dropTiles();
    fillEmpty();
    renderBoard();

    await delay(300);

    const newMatches = findMatches();
    if (newMatches.length > 0) {
        await processMatches(newMatches);
    }
}

// 宝石下落
function dropTiles() {
    for (let c = 0; c < COLS; c++) {
        let emptyRow = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r][c] !== -1) {
                board[emptyRow][c] = board[r][c];
                if (emptyRow !== r) {
                    board[r][c] = -1;
                }
                emptyRow--;
            }
        }
    }
}

// 用新宝石填充空位
function fillEmpty() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] === -1) {
                board[r][c] = randomType();
            }
        }
    }
}

// 更新UI
function updateUI() {
    scoreEl.textContent = score;
    movesEl.textContent = moves;
}

// 游戏结束
function endGame() {
    finalScoreEl.textContent = score;
    gameOverEl.classList.remove('hidden');
}

// 工具函数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 禁止双指缩放和长按菜单（移动端优化）
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());

// 事件绑定
restartBtn.addEventListener('click', init);
playAgainBtn.addEventListener('click', init);

// 启动游戏
init();
