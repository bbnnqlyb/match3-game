// 消消乐游戏主逻辑 - 增强版
// 特殊宝石：爆炸宝石（4连）、消除漩涡（5连）
// 连锁倍数计分

const ROWS = 8;
const COLS = 8;
const TYPES = 5;
const EMOJIS = ['🔴', '🟡', '🔵', '🟢', '🟣'];

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

    const spA = special[a.row][a.col];
    const spB = special[b.row][b.col];

    // 两个爆炸宝石交换：无论颜色，都直接爆炸
    if (spA === SPECIAL_BOMB && spB === SPECIAL_BOMB) {
        moves--;
        comboCount = 0;
        updateUI();
        await handleDoubleBombSwap(a, b);
        isProcessing = false;
        if (moves <= 0) endGame();
        return;
    }

    // 爆炸宝石 + 漩涡交换：两者都触发，叠加效果
    if ((spA === SPECIAL_BOMB && spB === SPECIAL_VORTEX) || (spA === SPECIAL_VORTEX && spB === SPECIAL_BOMB)) {
        moves--;
        comboCount = 0;
        updateUI();
        await handleBombVortexSwap(a, b);
        isProcessing = false;
        if (moves <= 0) endGame();
        return;
    }

    // 漩涡特殊处理：漩涡与任意宝石交换都有效
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

// 两个爆炸宝石交换：都爆炸（两个3x3范围）
// 爆炸范围内的漩涡也会被触发，消除颜色取决于第一个选中的宝石(a)的颜色
async function handleDoubleBombSwap(a, b) {
    comboCount = 1;
    const triggerColor = board[a.row][a.col]; // 第一个选中的宝石颜色

    // 收集两个炸弹的3x3范围
    const toRemoveSet = new Set();
    for (const bomb of [a, b]) {
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

    // 连锁检查：范围内的其他爆炸宝石也要爆炸
    const processedBombs = new Set([`${a.row},${a.col}`, `${b.row},${b.col}`]);
    let hasNewBombs = true;
    while (hasNewBombs) {
        hasNewBombs = false;
        for (const s of toRemoveSet) {
            const [r, c] = s.split(',').map(Number);
            const key = `${r},${c}`;
            if (special[r][c] === SPECIAL_BOMB && !processedBombs.has(key)) {
                processedBombs.add(key);
                hasNewBombs = true;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const nr = r + dr;
                        const nc = c + dc;
                        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                            toRemoveSet.add(`${nr},${nc}`);
                        }
                    }
                }
            }
        }
    }

    // 检查爆炸范围内是否有漩涡，触发漩涡效果
    const triggeredVortexColors = new Set();
    for (const s of toRemoveSet) {
        const [r, c] = s.split(',').map(Number);
        if (special[r][c] === SPECIAL_VORTEX) {
            triggeredVortexColors.add(triggerColor);
        }
    }

    // 如果有漩涡被波及，把全场该颜色的块也加入消除范围
    if (triggeredVortexColors.size > 0) {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (board[r][c] === triggerColor) {
                    toRemoveSet.add(`${r},${c}`);
                }
            }
        }
    }

    // 全部消除（包括漩涡）
    const finalRemove = Array.from(toRemoveSet).map(s => {
        const [r, c] = s.split(',').map(Number);
        return { row: r, col: c };
    });

    renderBoard();

    // 爆炸动画：先炸弹本身，再扩展范围
    const bombCells = [a, b];
    bombCells.forEach(({ row, col }) => {
        const el = getTileEl(row, col);
        if (el) el.classList.add('bomb-trigger');
    });
    await delay(300);
    finalRemove.forEach(({ row, col }) => {
        if (!(row === a.row && col === a.col) && !(row === b.row && col === b.col)) {
            const el = getTileEl(row, col);
            if (el) el.classList.add('exploded');
        }
    });
    await delay(400);

    // 计分
    const baseScore = finalRemove.length * 10;
    score += baseScore;
    updateUI();
    showComboWord(comboCount);

    clearCells(finalRemove);
    dropTiles();
    fillEmpty();
    renderBoard();
    await delay(300);

    // 检查连锁
    await checkChain();
}

// 爆炸宝石 + 漩涡交换：漩涡消除全场该色 + 爆炸3x3范围
async function handleBombVortexSwap(a, b) {
    comboCount = 1;
    const bombPos = special[a.row][a.col] === SPECIAL_BOMB ? a : b;
    const vortexPos = bombPos === a ? b : a;
    const targetColor = board[bombPos.row][bombPos.col]; // 爆炸宝石的颜色

    // 清除两个特殊宝石的标记
    special[bombPos.row][bombPos.col] = SPECIAL_NONE;
    special[vortexPos.row][vortexPos.col] = SPECIAL_NONE;

    // 收集消除范围：漩涡全场同色 + 爆炸3x3
    const toRemoveSet = new Set();

    // 漩涡效果：全场该颜色
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] === targetColor) {
                toRemoveSet.add(`${r},${c}`);
            }
        }
    }

    // 爆炸效果：3x3范围
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const nr = bombPos.row + dr;
            const nc = bombPos.col + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                toRemoveSet.add(`${nr},${nc}`);
            }
        }
    }

    // 确保漩涡自身也被消除
    toRemoveSet.add(`${vortexPos.row},${vortexPos.col}`);
    toRemoveSet.add(`${bombPos.row},${bombPos.col}`);

    const finalRemove = Array.from(toRemoveSet).map(s => {
        const [r, c] = s.split(',').map(Number);
        return { row: r, col: c };
    });

    renderBoard();

    // 动画：爆炸宝石先爆，漩涡同色消除
    const el1 = getTileEl(bombPos.row, bombPos.col);
    if (el1) el1.classList.add('bomb-trigger');
    const el2 = getTileEl(vortexPos.row, vortexPos.col);
    if (el2) el2.classList.add('matched');
    await delay(300);
    finalRemove.forEach(({ row, col }) => {
        if (!(row === bombPos.row && col === bombPos.col) && !(row === vortexPos.row && col === vortexPos.col)) {
            const el = getTileEl(row, col);
            if (el) el.classList.add('exploded');
        }
    });
    await delay(400);

    const baseScore = finalRemove.length * 10;
    score += baseScore;
    updateUI();
    showComboWord(comboCount);

    clearCells(finalRemove);
    dropTiles();
    fillEmpty();
    renderBoard();
    await delay(300);

    await checkChain();
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

    // 检查爆炸范围内是否有漩涡被波及
    // 如果有，触发漩涡效果：消除全场该颜色（颜色取触发匹配的颜色）
    const vortexTriggerColor = triggeredBombs.length > 0 ? board[triggeredBombs[0].row][triggeredBombs[0].col] : null;
    let hasVortexTriggered = false;
    for (const s of toRemoveSet) {
        const [r, c] = s.split(',').map(Number);
        if (special[r][c] === SPECIAL_VORTEX) {
            hasVortexTriggered = true;
        }
    }
    if (hasVortexTriggered && vortexTriggerColor !== null) {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (board[r][c] === vortexTriggerColor) {
                    toRemoveSet.add(`${r},${c}`);
                }
            }
        }
    }

    // 最终消除列表（全部消除，包括漩涡）
    const finalRemove = Array.from(toRemoveSet).map(s => {
        const [r, c] = s.split(',').map(Number);
        return { row: r, col: c };
    });

    // 分阶段动画：先消除匹配块，再爆炸扩展块
    const matchSet = new Set(matches.map(m => `${m.row},${m.col}`));
    const matchOnly = finalRemove.filter(({ row, col }) => matchSet.has(`${row},${col}`));
    const explodeOnly = finalRemove.filter(({ row, col }) => !matchSet.has(`${row},${col}`));

    if (triggeredBombs.length > 0) {
        // 第一阶段：匹配块消除 + 爆炸宝石放大爆炸动画
        matchOnly.forEach(({ row, col }) => {
            const el = getTileEl(row, col);
            if (el) {
                if (special[row][col] === SPECIAL_BOMB) {
                    el.classList.add('bomb-trigger');
                } else {
                    el.classList.add('matched');
                }
            }
        });
        await delay(300);

        // 第二阶段：爆炸扩展范围的格子用爆炸动画
        if (explodeOnly.length > 0) {
            explodeOnly.forEach(({ row, col }) => {
                const el = getTileEl(row, col);
                if (el) el.classList.add('exploded');
            });
            await delay(400);
        }
    } else {
        // 没有爆炸宝石，普通消除动画
        await animateMatches(finalRemove);
    }

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
// 规则：
//   - 单组4连 或 两组交叉（T/L形，总块数>=4）-> 爆炸宝石
//   - 单组5连 或 两组交叉（总块数>=5）-> 消除漩涡
function determineSpecials(groups) {
    const specials = [];
    const usedPositions = new Set();

    // 先检查是否有交叉组（同色，一横一纵，共享一个格子）
    for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
            const gi = groups[i], gj = groups[j];
            if (gi.type !== gj.type) continue;
            if (gi.direction === gj.direction) continue; // 必须一横一纵
            // 找交叉点
            const setI = new Set(gi.cells.map(c => `${c.row},${c.col}`));
            const intersection = gj.cells.filter(c => setI.has(`${c.row},${c.col}`));
            if (intersection.length > 0) {
                const crossPoint = intersection[0];
                const key = `${crossPoint.row},${crossPoint.col}`;
                if (usedPositions.has(key)) continue;
                // 总块数 = 两组去重
                const allCells = new Set([...gi.cells.map(c => `${c.row},${c.col}`), ...gj.cells.map(c => `${c.row},${c.col}`)]);
                const totalLen = allCells.size;
                if (totalLen >= 5) {
                    specials.push({ row: crossPoint.row, col: crossPoint.col, type: gi.type, specialType: SPECIAL_VORTEX });
                    usedPositions.add(key);
                } else if (totalLen >= 4) {
                    specials.push({ row: crossPoint.row, col: crossPoint.col, type: gi.type, specialType: SPECIAL_BOMB });
                    usedPositions.add(key);
                }
            }
        }
    }

    // 再处理单独的长组（没有被交叉处理过的）
    const sortedGroups = [...groups].sort((a, b) => b.length - a.length);
    for (const group of sortedGroups) {
        if (group.length >= 5) {
            const mid = Math.floor(group.cells.length / 2);
            const pos = group.cells[mid];
            const key = `${pos.row},${pos.col}`;
            if (!usedPositions.has(key)) {
                specials.push({ row: pos.row, col: pos.col, type: group.type, specialType: SPECIAL_VORTEX });
                usedPositions.add(key);
            }
        } else if (group.length === 4) {
            const mid = Math.floor(group.cells.length / 2);
            const pos = group.cells[mid];
            const key = `${pos.row},${pos.col}`;
            if (!usedPositions.has(key)) {
                specials.push({ row: pos.row, col: pos.col, type: group.type, specialType: SPECIAL_BOMB });
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

// 测试模式：按 T 键在随机位置放置特殊宝石
document.addEventListener('keydown', (e) => {
    if (e.key === 'b' || e.key === 'B') {
        // 放一个爆炸宝石在(4,4)
        special[4][4] = SPECIAL_BOMB;
        renderBoard();
        console.log('已放置爆炸宝石在(4,4), 颜色=' + board[4][4]);
    }
    if (e.key === 'v' || e.key === 'V') {
        // 放一个漩涡在(4,4)
        special[4][4] = SPECIAL_VORTEX;
        renderBoard();
        console.log('已放置漩涡在(4,4), 颜色=' + board[4][4]);
    }
    if (e.key === 't' || e.key === 'T') {
        // 制造T形：在(6,3)(6,4)(6,5)横3 + (5,4)(6,4)(7,4)纵3
        const color = board[6][4];
        board[6][3] = color; board[6][5] = color;
        board[5][4] = color; board[7][4] = color;
        renderBoard();
        console.log('已制造T形，颜色=' + color + '，交换任意相邻块触发');
    }
});

// 启动游戏
init();
