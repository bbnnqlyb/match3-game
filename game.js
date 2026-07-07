// 消消乐游戏主逻辑 - 增强版
// 特殊宝石：爆炸宝石（4连）、消除漩涡（5连）
// 连锁倍数计分

const ROWS = 8;
const COLS = 8;
const TYPES = 6;
const EMOJIS = ['🔴', '🟡', '🔵', '🟢', '🟣', '💗'];

// 特殊宝石类型标记
const SPECIAL_NONE = 0;
const SPECIAL_BOMB = 1;    // 爆炸宝石：被同色消除时3x3爆炸
const SPECIAL_VORTEX = 2;  // 消除漩涡：只能手动交换触发，清除全场同色

let board = [];       // 普通类型 0-5
let special = [];     // 特殊标记
let score = 0;
let moves = 30;
let selected = null;
let isProcessing = false;
let comboCount = 0;   // 当前连锁次数

const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const movesEl = document.getElementById('moves');
const gameOverEl = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const comboTextEl = document.getElementById('combo-text');

// 连击评价词
const COMBO_WORDS = ['Good!', 'Wonderful!', 'Beautiful!', 'Amazing!', 'Unbelievable!', 'GODLIKE!'];

// 初始化游戏
function init() {
    score = 0;
    moves = 30;
    selected = null;
    isProcessing = false;
    comboCount = 0;
    updateUI();
    gameOverEl.classList.add('hidden');
    generateBoard();
    renderBoard();
}

// 生成棋盘
function generateBoard() {
    board = [];
    special = [];
    for (let r = 0; r < ROWS; r++) {
        board[r] = [];
        special[r] = [];
        for (let c = 0; c < COLS; c++) {
            let type;
            do {
                type = randomType();
            } while (wouldMatch(r, c, type));
            board[r][c] = type;
            special[r][c] = SPECIAL_NONE;
        }
    }
}

function randomType() {
    return Math.floor(Math.random() * TYPES);
}

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
            const type = board[r][c];
            const sp = special[r][c];

            tile.classList.add('tile', `tile-${type}`);

            if (sp === SPECIAL_BOMB) {
                tile.classList.add('bomb');
                tile.textContent = '💥';
            } else if (sp === SPECIAL_VORTEX) {
                tile.classList.add('vortex');
                tile.textContent = '🌀';
            } else {
                tile.textContent = EMOJIS[type];
            }

            tile.dataset.row = r;
            tile.dataset.col = c;
            tile.addEventListener('click', () => onTileClick(r, c));
            boardEl.appendChild(tile);
        }
    }
}

function getTileEl(row, col) {
    return boardEl.children[row * COLS + col];
}

// 点击宝石
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
            selected = { row, col };
            getTileEl(row, col).classList.add('selected');
        }
    }
}

function isAdjacent(a, b) {
    return (Math.abs(a.row - b.row) + Math.abs(a.col - b.col)) === 1;
}

// 尝试交换
async function trySwap(a, b) {
    isProcessing = true;

    // 漩涡特殊处理：漩涡与任意宝石交换都有效
    const spA = special[a.row][a.col];
    const spB = special[b.row][b.col];

    if (spA === SPECIAL_VORTEX || spB === SPECIAL_VORTEX) {
        moves--;
        comboCount = 0;
        updateUI();
        await handleVortexSwap(a, b);
        isProcessing = false;
        if (moves <= 0) endGame();
        return;
    }

    // 普通交换
    swap(a, b);
    renderBoard();

    const matchResult = findMatches();
    if (matchResult.matches.length > 0) {
        moves--;
        comboCount = 0;
        updateUI();
        await processMatches(matchResult);
    } else {
        await delay(200);
        swap(a, b);
        renderBoard();
    }

    isProcessing = false;
    if (moves <= 0) endGame();
}

// 漩涡交换处理
async function handleVortexSwap(a, b) {
    const vortexPos = special[a.row][a.col] === SPECIAL_VORTEX ? a : b;
    const otherPos = vortexPos === a ? b : a;
    const targetColor = board[otherPos.row][otherPos.col];

    // 交换位置
    swap(a, b);
    // 清除漩涡自身
    special[vortexPos.row][vortexPos.col] = SPECIAL_NONE;

    // 如果另一个也是漩涡，全场清除
    if (special[otherPos.row][otherPos.col] === SPECIAL_VORTEX) {
        special[otherPos.row][otherPos.col] = SPECIAL_NONE;
        const allMatched = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                allMatched.push({ row: r, col: c });
            }
        }
        renderBoard();
        await animateMatches(allMatched);
        score += allMatched.length * 10;
        updateUI();
        clearCells(allMatched);
        dropTiles();
        fillEmpty();
        renderBoard();
        await delay(300);
        await checkChain();
        return;
    }

    renderBoard();

    // 找出全场所有该颜色的块
    const toRemove = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] === targetColor) {
                toRemove.push({ row: r, col: c });
            }
        }
    }

    // 消除动画
    await animateMatches(toRemove);

    // 计分：漩涡消除算第一次消除，基础分不带倍数
    comboCount++;
    const baseScore = toRemove.length * 10;
    score += baseScore;
    updateUI();

    clearCells(toRemove);
    dropTiles();
    fillEmpty();
    renderBoard();
    await delay(300);

    // 检查连锁
    await checkChain();
}

// 交换两个位置（包括 special）
function swap(a, b) {
    let temp = board[a.row][a.col];
    board[a.row][a.col] = board[b.row][b.col];
    board[b.row][b.col] = temp;

    temp = special[a.row][a.col];
    special[a.row][a.col] = special[b.row][b.col];
    special[b.row][b.col] = temp;
}

// 查找所有匹配
// 规则：消除漩涡（VORTEX）不参与自动匹配，视为断点
//       爆炸宝石（BOMB）正常参与匹配（被匹配到时触发爆炸）
function findMatches() {
    const matchGroups = [];

    function canMatch(r, c) {
        if (board[r][c] === -1) return false;
        if (special[r][c] === SPECIAL_VORTEX) return false; // 漩涡不参与自动匹配
        return true;
    }

    // 横向
    for (let r = 0; r < ROWS; r++) {
        let c = 0;
        while (c < COLS) {
            if (!canMatch(r, c)) { c++; continue; }
            const type = board[r][c];
            let end = c;
            while (end + 1 < COLS && canMatch(r, end + 1) && board[r][end + 1] === type) end++;
            const len = end - c + 1;
            if (len >= 3) {
                const group = [];
                for (let i = c; i <= end; i++) {
                    group.push({ row: r, col: i });
                }
                matchGroups.push({ cells: group, length: len, type, direction: 'h' });
            }
            c = end + 1;
        }
    }

    // 纵向
    for (let c = 0; c < COLS; c++) {
        let r = 0;
        while (r < ROWS) {
            if (!canMatch(r, c)) { r++; continue; }
            const type = board[r][c];
            let end = r;
            while (end + 1 < ROWS && canMatch(end + 1, c) && board[end + 1][c] === type) end++;
            const len = end - r + 1;
            if (len >= 3) {
                const group = [];
                for (let i = r; i <= end; i++) {
                    group.push({ row: i, col: c });
                }
                matchGroups.push({ cells: group, length: len, type, direction: 'v' });
            }
            r = end + 1;
        }
    }

    // 合并所有匹配位置（去重）
    const matchedSet = new Set();
    matchGroups.forEach(g => {
        g.cells.forEach(cell => matchedSet.add(`${cell.row},${cell.col}`));
    });

    const allMatches = Array.from(matchedSet).map(s => {
        const [r, c] = s.split(',').map(Number);
        return { row: r, col: c };
    });

    return { matches: allMatches, groups: matchGroups };
}

// 处理匹配
async function processMatches(matchResult) {
    const { matches, groups } = matchResult;

    // 连锁倍数
    comboCount++;

    // 检查是否有爆炸宝石被匹配到
    const triggeredBombs = [];
    for (const { row, col } of matches) {
        if (special[row][col] === SPECIAL_BOMB) {
            triggeredBombs.push({ row, col });
        }
    }

    // 如果有爆炸宝石被触发，扩大消除范围
    const toRemoveSet = new Set(matches.map(m => `${m.row},${m.col}`));

    for (const bomb of triggeredBombs) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = bomb.row + dr;
                const nc = bomb.col + dc;
                if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                    toRemoveSet.add(`${nr},${nc}`);
                }
            }
        }
    }

    // 检查爆炸范围内是否有其他爆炸宝石（连锁爆炸）
    let hasNewBombs = true;
    const processedBombs = new Set(triggeredBombs.map(b => `${b.row},${b.col}`));
    while (hasNewBombs) {
        hasNewBombs = false;
        const currentCells = Array.from(toRemoveSet).map(s => {
            const [r, c] = s.split(',').map(Number);
            return { row: r, col: c };
        });
        for (const { row, col } of currentCells) {
            const key = `${row},${col}`;
            if (special[row][col] === SPECIAL_BOMB && !processedBombs.has(key)) {
                processedBombs.add(key);
                hasNewBombs = true;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const nr = row + dr;
                        const nc = col + dc;
                        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                            toRemoveSet.add(`${nr},${nc}`);
                        }
                    }
                }
            }
        }
    }

    // 最终消除列表（排除漩涡，漩涡不会被爆炸波及消除）
    const finalRemove = Array.from(toRemoveSet).map(s => {
        const [r, c] = s.split(',').map(Number);
        return { row: r, col: c };
    }).filter(({ row, col }) => special[row][col] !== SPECIAL_VORTEX);

    // 消除动画
    await animateMatches(finalRemove);

    // 计分规则：
    // 第1次消除：基础分（无倍数）
    // 第N次连锁（N>=2）：基础分 + 基础分 * N
    const baseScore = finalRemove.length * 10;
    if (comboCount === 1) {
        score += baseScore;
    } else {
        score += baseScore + baseScore * comboCount;
    }
    updateUI();

    // 显示评价词
    showComboWord(comboCount);

    // 决定生成特殊宝石（基于原始匹配组，不含爆炸扩展）
    const specialToCreate = determineSpecials(groups);

    // 清除格子
    clearCells(finalRemove);

    // 生成特殊宝石
    specialToCreate.forEach(({ row, col, type, specialType }) => {
        board[row][col] = type;
        special[row][col] = specialType;
    });

    // 下落填充
    dropTiles();
    fillEmpty();
    renderBoard();
    await delay(300);

    // 检查连锁
    await checkChain();
}

// 确定要生成的特殊宝石
function determineSpecials(groups) {
    const specials = [];
    const usedPositions = new Set();

    // 按长度降序排列，优先处理 5 连
    const sortedGroups = [...groups].sort((a, b) => b.length - a.length);

    for (const group of sortedGroups) {
        if (group.length >= 5) {
            const mid = Math.floor(group.cells.length / 2);
            const pos = group.cells[mid];
            const key = `${pos.row},${pos.col}`;
            if (!usedPositions.has(key)) {
                specials.push({
                    row: pos.row,
                    col: pos.col,
                    type: group.type,
                    specialType: SPECIAL_VORTEX
                });
                usedPositions.add(key);
            }
        } else if (group.length === 4) {
            const mid = Math.floor(group.cells.length / 2);
            const pos = group.cells[mid];
            const key = `${pos.row},${pos.col}`;
            if (!usedPositions.has(key)) {
                specials.push({
                    row: pos.row,
                    col: pos.col,
                    type: group.type,
                    specialType: SPECIAL_BOMB
                });
                usedPositions.add(key);
            }
        }
    }

    return specials;
}

// 检查连锁反应
async function checkChain() {
    const matchResult = findMatches();
    if (matchResult.matches.length > 0) {
        await processMatches(matchResult);
    }
}

// 消除动画
async function animateMatches(matches) {
    matches.forEach(({ row, col }) => {
        const el = getTileEl(row, col);
        if (el) el.classList.add('matched');
    });
    await delay(300);
}

// 清除格子
function clearCells(cells) {
    cells.forEach(({ row, col }) => {
        board[row][col] = -1;
        special[row][col] = SPECIAL_NONE;
    });
}

// 宝石下落
function dropTiles() {
    for (let c = 0; c < COLS; c++) {
        let emptyRow = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r][c] !== -1) {
                board[emptyRow][c] = board[r][c];
                special[emptyRow][c] = special[r][c];
                if (emptyRow !== r) {
                    board[r][c] = -1;
                    special[r][c] = SPECIAL_NONE;
                }
                emptyRow--;
            }
        }
        for (let r = emptyRow; r >= 0; r--) {
            board[r][c] = -1;
            special[r][c] = SPECIAL_NONE;
        }
    }
}

// 填充空位
function fillEmpty() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] === -1) {
                board[r][c] = randomType();
                special[r][c] = SPECIAL_NONE;
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

// 显示连击评价词
function showComboWord(combo) {
    if (combo < 1) return;
    const idx = Math.min(combo - 1, COMBO_WORDS.length - 1);
    comboTextEl.textContent = COMBO_WORDS[idx];
    comboTextEl.classList.remove('show');
    // 触发 reflow 以重新启动动画
    void comboTextEl.offsetWidth;
    comboTextEl.classList.add('show');
}

// 禁止移动端缩放和长按
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());

// 事件绑定
restartBtn.addEventListener('click', init);
playAgainBtn.addEventListener('click', init);

// 启动游戏
init();
