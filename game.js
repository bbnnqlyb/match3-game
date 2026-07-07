// 消消乐 - 增强版
// 特殊宝石：爆炸宝石(4连/T形) + 消除漩涡(5连/T+形)
// 连锁倍数计分 + 关卡系统

const ROWS = 8;
const COLS = 8;
const TYPES = 5;
const EMOJIS = ['🔴', '🟡', '🔵', '🟢', '🟣'];
const SPECIAL_NONE = 0;
const SPECIAL_BOMB = 1;
const SPECIAL_VORTEX = 2;
const COMBO_WORDS = ['Good!', 'Wonderful!', 'Beautiful!', 'Amazing!', 'Unbelievable!', 'GODLIKE!'];

let board = [];
let special = [];
let score = 0;
let totalScore = 0;
let moves = 30;
let selected = null;
let isProcessing = false;
let comboCount = 0;
let level = 1;

// 关卡目标分数
function getLevelTarget(lv) {
    const targets = [300, 500, 800, 1200, 1800];
    if (lv <= targets.length) return targets[lv - 1];
    return 1800 + (lv - 5) * 800;
}

// DOM 引用
const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const movesEl = document.getElementById('moves');
const levelEl = document.getElementById('level');
const targetEl = document.getElementById('target');
const progressEl = document.getElementById('progress');
const gameOverEl = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');
const finalLevelEl = document.getElementById('final-level');
const restartBtn = document.getElementById('restart-btn');
const playAgainBtn = document.getElementById('play-again-btn');
let comboTextEl = document.getElementById('combo-text');
const levelUpEl = document.getElementById('level-up');
const levelUpTextEl = document.getElementById('level-up-text');
const nextLevelEl = document.getElementById('next-level');

// === 初始化 ===

function init() {
    score = 0;
    totalScore = 0;
    moves = 30;
    level = 1;
    selected = null;
    isProcessing = false;
    comboCount = 0;
    gameOverEl.classList.add('hidden');
    levelUpEl.classList.add('hidden');
    generateBoard();
    renderBoard();
    updateUI();
}

function startNextLevel() {
    totalScore += score;
    score = 0;
    moves = 30;
    level++;
    selected = null;
    isProcessing = false;
    comboCount = 0;
    levelUpEl.classList.add('hidden');
    generateBoard();
    renderBoard();
    updateUI();
}

// === 棋盘生成 ===

function generateBoard() {
    board = [];
    special = [];
    for (let r = 0; r < ROWS; r++) {
        board[r] = [];
        special[r] = [];
        for (let c = 0; c < COLS; c++) {
            let type;
            do { type = randomType(); } while (wouldMatch(r, c, type));
            board[r][c] = type;
            special[r][c] = SPECIAL_NONE;
        }
    }
}

function randomType() {
    return Math.floor(Math.random() * TYPES);
}

function wouldMatch(row, col, type) {
    return (col >= 2 && board[row][col - 1] === type && board[row][col - 2] === type) ||
           (row >= 2 && board[row - 1][col] === type && board[row - 2][col] === type);
}

// === 渲染 ===

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
            boardEl.appendChild(tile);
        }
    }
}

function getTileEl(row, col) {
    return boardEl.children[row * COLS + col];
}

// === 交互（支持点击 + 拖拽，适配移动端） ===

let dragStart = null;  // {row, col, x, y}
const SWIPE_THRESHOLD = 15; // 滑动触发阈值(px)

function getTileFromEvent(e) {
    const touch = e.touches ? e.touches[0] : e;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el || !el.dataset.row) return null;
    return { row: parseInt(el.dataset.row), col: parseInt(el.dataset.col) };
}

function getEventPos(e) {
    const touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX, y: touch.clientY };
}

function onPointerDown(e) {
    if (isProcessing) return;
    const tile = getTileFromEvent(e);
    if (!tile) return;
    const pos = getEventPos(e);
    dragStart = { row: tile.row, col: tile.col, x: pos.x, y: pos.y };
}

function onPointerMove(e) {
    if (!dragStart || isProcessing) return;
    const pos = getEventPos(e);
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // 需要超过阈值才触发
    if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) return;

    // 确定滑动方向
    let targetRow = dragStart.row;
    let targetCol = dragStart.col;
    if (absDx > absDy) {
        targetCol += dx > 0 ? 1 : -1;
    } else {
        targetRow += dy > 0 ? 1 : -1;
    }

    // 边界检查
    if (targetRow < 0 || targetRow >= ROWS || targetCol < 0 || targetCol >= COLS) {
        dragStart = null;
        return;
    }

    // 清除之前的选中状态
    if (selected) {
        getTileEl(selected.row, selected.col).classList.remove('selected');
        selected = null;
    }

    const from = { row: dragStart.row, col: dragStart.col };
    const to = { row: targetRow, col: targetCol };
    dragStart = null;
    trySwap(from, to);
}

function onPointerUp(e) {
    if (!dragStart || isProcessing) {
        dragStart = null;
        return;
    }

    // 没有滑动，当作点击处理
    const tile = { row: dragStart.row, col: dragStart.col };
    dragStart = null;
    onTileClick(tile.row, tile.col);
}

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

// 绑定事件到棋盘（事件委托）
boardEl.addEventListener('mousedown', onPointerDown);
boardEl.addEventListener('mousemove', onPointerMove);
boardEl.addEventListener('mouseup', onPointerUp);
boardEl.addEventListener('mouseleave', () => { dragStart = null; });
boardEl.addEventListener('touchstart', onPointerDown, { passive: true });
boardEl.addEventListener('touchmove', onPointerMove, { passive: true });
boardEl.addEventListener('touchend', onPointerUp);

function isAdjacent(a, b) {
    return (Math.abs(a.row - b.row) + Math.abs(a.col - b.col)) === 1;
}

// === 交换处理 ===

async function trySwap(a, b) {
    isProcessing = true;
    const spA = special[a.row][a.col];
    const spB = special[b.row][b.col];

    if (spA === SPECIAL_BOMB && spB === SPECIAL_BOMB) {
        moves--;
        comboCount = 0;
        updateUI();
        await handleDoubleBombSwap(a, b);
    } else if ((spA === SPECIAL_BOMB && spB === SPECIAL_VORTEX) || (spA === SPECIAL_VORTEX && spB === SPECIAL_BOMB)) {
        moves--;
        comboCount = 0;
        updateUI();
        await handleBombVortexSwap(a, b);
    } else if (spA === SPECIAL_VORTEX || spB === SPECIAL_VORTEX) {
        moves--;
        comboCount = 0;
        updateUI();
        await handleVortexSwap(a, b);
    } else {
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
    }

    isProcessing = false;
    if (!checkLevelUp() && moves <= 0) endGame();
}

// === 特殊交换 ===

async function handleDoubleBombSwap(a, b) {
    comboCount = 1;
    const triggerColor = board[a.row][a.col];
    const toRemoveSet = new Set();

    // 两个炸弹3x3范围
    for (const bomb of [a, b]) {
        addBombRange(toRemoveSet, bomb.row, bomb.col);
    }
    // 连锁爆炸
    expandBombChain(toRemoveSet, new Set([`${a.row},${a.col}`, `${b.row},${b.col}`]));
    // 漩涡波及
    expandVortex(toRemoveSet, triggerColor);

    const finalRemove = setToArray(toRemoveSet);
    renderBoard();

    // 动画
    [a, b].forEach(({ row, col }) => {
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

    score += finalRemove.length * 10;
    updateUI();
    showComboWord(comboCount);
    clearCells(finalRemove);
    dropTiles();
    fillEmpty();
    renderBoard();
    await delay(300);
    await checkChain();
}

async function handleBombVortexSwap(a, b) {
    comboCount = 1;
    const bombPos = special[a.row][a.col] === SPECIAL_BOMB ? a : b;
    const vortexPos = bombPos === a ? b : a;
    const targetColor = board[bombPos.row][bombPos.col];

    special[bombPos.row][bombPos.col] = SPECIAL_NONE;
    special[vortexPos.row][vortexPos.col] = SPECIAL_NONE;

    const toRemoveSet = new Set();
    // 漩涡：全场同色
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
            if (board[r][c] === targetColor) toRemoveSet.add(`${r},${c}`);
    // 爆炸：3x3
    addBombRange(toRemoveSet, bombPos.row, bombPos.col);
    // 确保两者自身被消除
    toRemoveSet.add(`${vortexPos.row},${vortexPos.col}`);
    toRemoveSet.add(`${bombPos.row},${bombPos.col}`);

    const finalRemove = setToArray(toRemoveSet);
    renderBoard();

    // 动画
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

    score += finalRemove.length * 10;
    updateUI();
    showComboWord(comboCount);
    clearCells(finalRemove);
    dropTiles();
    fillEmpty();
    renderBoard();
    await delay(300);
    await checkChain();
}

async function handleVortexSwap(a, b) {
    const vortexPos = special[a.row][a.col] === SPECIAL_VORTEX ? a : b;
    const otherPos = vortexPos === a ? b : a;
    const targetColor = board[otherPos.row][otherPos.col];

    swap(a, b);
    special[vortexPos.row][vortexPos.col] = SPECIAL_NONE;

    // 双漩涡：全场清除
    if (special[otherPos.row][otherPos.col] === SPECIAL_VORTEX) {
        special[otherPos.row][otherPos.col] = SPECIAL_NONE;
        const allCells = [];
        for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++)
                allCells.push({ row: r, col: c });
        renderBoard();
        await animateMatches(allCells);
        score += allCells.length * 10;
        updateUI();
        clearCells(allCells);
        dropTiles();
        fillEmpty();
        renderBoard();
        await delay(300);
        await checkChain();
        return;
    }

    renderBoard();

    // 全场同色消除
    const toRemove = [];
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
            if (board[r][c] === targetColor) toRemove.push({ row: r, col: c });

    await animateMatches(toRemove);
    comboCount++;
    score += toRemove.length * 10;
    updateUI();
    clearCells(toRemove);
    dropTiles();
    fillEmpty();
    renderBoard();
    await delay(300);
    await checkChain();
}

// === 匹配检测 ===

function findMatches() {
    const matchGroups = [];

    function canMatch(r, c) {
        return board[r][c] !== -1 && special[r][c] !== SPECIAL_VORTEX;
    }

    // 横向
    for (let r = 0; r < ROWS; r++) {
        let c = 0;
        while (c < COLS) {
            if (!canMatch(r, c)) { c++; continue; }
            const type = board[r][c];
            let end = c;
            while (end + 1 < COLS && canMatch(r, end + 1) && board[r][end + 1] === type) end++;
            if (end - c + 1 >= 3) {
                const group = [];
                for (let i = c; i <= end; i++) group.push({ row: r, col: i });
                matchGroups.push({ cells: group, length: end - c + 1, type, direction: 'h' });
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
            if (end - r + 1 >= 3) {
                const group = [];
                for (let i = r; i <= end; i++) group.push({ row: i, col: c });
                matchGroups.push({ cells: group, length: end - r + 1, type, direction: 'v' });
            }
            r = end + 1;
        }
    }

    const matchedSet = new Set();
    matchGroups.forEach(g => g.cells.forEach(cell => matchedSet.add(`${cell.row},${cell.col}`)));
    const matches = Array.from(matchedSet).map(s => {
        const [r, c] = s.split(',').map(Number);
        return { row: r, col: c };
    });

    return { matches, groups: matchGroups };
}

// === 消除处理 ===

async function processMatches(matchResult) {
    const { matches, groups } = matchResult;
    comboCount++;

    // 收集触发的爆炸宝石
    const triggeredBombs = matches.filter(({ row, col }) => special[row][col] === SPECIAL_BOMB);
    const toRemoveSet = new Set(matches.map(m => `${m.row},${m.col}`));

    // 爆炸扩展
    for (const bomb of triggeredBombs) {
        addBombRange(toRemoveSet, bomb.row, bomb.col);
    }
    expandBombChain(toRemoveSet, new Set(triggeredBombs.map(b => `${b.row},${b.col}`)));

    // 漩涡波及
    const vortexColor = triggeredBombs.length > 0 ? board[triggeredBombs[0].row][triggeredBombs[0].col] : null;
    expandVortex(toRemoveSet, vortexColor);

    const finalRemove = setToArray(toRemoveSet);

    // 动画
    const matchSet = new Set(matches.map(m => `${m.row},${m.col}`));
    if (triggeredBombs.length > 0) {
        // 第一阶段：匹配块消除
        finalRemove.filter(({ row, col }) => matchSet.has(`${row},${col}`)).forEach(({ row, col }) => {
            const el = getTileEl(row, col);
            if (el) el.classList.add(special[row][col] === SPECIAL_BOMB ? 'bomb-trigger' : 'matched');
        });
        await delay(300);
        // 第二阶段：爆炸扩展
        finalRemove.filter(({ row, col }) => !matchSet.has(`${row},${col}`)).forEach(({ row, col }) => {
            const el = getTileEl(row, col);
            if (el) el.classList.add('exploded');
        });
        await delay(400);
    } else {
        await animateMatches(finalRemove);
    }

    // 计分
    const baseScore = finalRemove.length * 10;
    score += comboCount === 1 ? baseScore : baseScore + baseScore * comboCount;
    updateUI();
    showComboWord(comboCount);

    // 生成特殊宝石
    const specialToCreate = determineSpecials(groups);
    clearCells(finalRemove);
    specialToCreate.forEach(({ row, col, type, specialType }) => {
        board[row][col] = type;
        special[row][col] = specialType;
    });

    dropTiles();
    fillEmpty();
    renderBoard();
    await delay(300);
    await checkChain();
}

// === 特殊宝石生成 ===

function determineSpecials(groups) {
    const specials = [];
    const used = new Set();

    // 交叉组检测（T/L形）
    for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
            const gi = groups[i], gj = groups[j];
            if (gi.type !== gj.type || gi.direction === gj.direction) continue;
            const setI = new Set(gi.cells.map(c => `${c.row},${c.col}`));
            const inter = gj.cells.filter(c => setI.has(`${c.row},${c.col}`));
            if (inter.length === 0) continue;
            const cp = inter[0], key = `${cp.row},${cp.col}`;
            if (used.has(key)) continue;
            const total = new Set([...gi.cells.map(c => `${c.row},${c.col}`), ...gj.cells.map(c => `${c.row},${c.col}`)]).size;
            if (total >= 5) {
                specials.push({ row: cp.row, col: cp.col, type: gi.type, specialType: SPECIAL_VORTEX });
            } else if (total >= 4) {
                specials.push({ row: cp.row, col: cp.col, type: gi.type, specialType: SPECIAL_BOMB });
            }
            used.add(key);
        }
    }

    // 单组长连
    [...groups].sort((a, b) => b.length - a.length).forEach(group => {
        if (group.length < 4) return;
        const pos = group.cells[Math.floor(group.cells.length / 2)];
        const key = `${pos.row},${pos.col}`;
        if (used.has(key)) return;
        specials.push({
            row: pos.row, col: pos.col, type: group.type,
            specialType: group.length >= 5 ? SPECIAL_VORTEX : SPECIAL_BOMB
        });
        used.add(key);
    });

    return specials;
}

// === 辅助函数 ===

function addBombRange(set, row, col) {
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) set.add(`${nr},${nc}`);
        }
}

function expandBombChain(toRemoveSet, processedBombs) {
    let hasNew = true;
    while (hasNew) {
        hasNew = false;
        for (const s of toRemoveSet) {
            const [r, c] = s.split(',').map(Number);
            if (special[r][c] === SPECIAL_BOMB && !processedBombs.has(s)) {
                processedBombs.add(s);
                hasNew = true;
                addBombRange(toRemoveSet, r, c);
            }
        }
    }
}

function expandVortex(toRemoveSet, triggerColor) {
    if (triggerColor === null) return;
    let hasVortex = false;
    for (const s of toRemoveSet) {
        const [r, c] = s.split(',').map(Number);
        if (special[r][c] === SPECIAL_VORTEX) { hasVortex = true; break; }
    }
    if (hasVortex) {
        for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++)
                if (board[r][c] === triggerColor) toRemoveSet.add(`${r},${c}`);
    }
}

function setToArray(set) {
    return Array.from(set).map(s => {
        const [r, c] = s.split(',').map(Number);
        return { row: r, col: c };
    });
}

function swap(a, b) {
    [board[a.row][a.col], board[b.row][b.col]] = [board[b.row][b.col], board[a.row][a.col]];
    [special[a.row][a.col], special[b.row][b.col]] = [special[b.row][b.col], special[a.row][a.col]];
}

function clearCells(cells) {
    cells.forEach(({ row, col }) => { board[row][col] = -1; special[row][col] = SPECIAL_NONE; });
}

function dropTiles() {
    for (let c = 0; c < COLS; c++) {
        let emptyRow = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r][c] !== -1) {
                board[emptyRow][c] = board[r][c];
                special[emptyRow][c] = special[r][c];
                if (emptyRow !== r) { board[r][c] = -1; special[r][c] = SPECIAL_NONE; }
                emptyRow--;
            }
        }
        for (let r = emptyRow; r >= 0; r--) { board[r][c] = -1; special[r][c] = SPECIAL_NONE; }
    }
}

function fillEmpty() {
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
            if (board[r][c] === -1) { board[r][c] = randomType(); special[r][c] = SPECIAL_NONE; }
}

async function animateMatches(matches) {
    matches.forEach(({ row, col }) => {
        const el = getTileEl(row, col);
        if (el) el.classList.add('matched');
    });
    await delay(300);
}

async function checkChain() {
    const matchResult = findMatches();
    if (matchResult.matches.length > 0) await processMatches(matchResult);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// === UI ===

function updateUI() {
    scoreEl.textContent = score;
    movesEl.textContent = moves;
    levelEl.textContent = level;
    const target = getLevelTarget(level);
    targetEl.textContent = target;
    progressEl.style.width = Math.min(100, Math.floor(score / target * 100)) + '%';
}

function endGame() {
    totalScore += score;
    finalScoreEl.textContent = totalScore;
    finalLevelEl.textContent = level;
    gameOverEl.classList.remove('hidden');
}

function checkLevelUp() {
    if (score >= getLevelTarget(level)) {
        levelUpTextEl.textContent = '第' + level + '关 通过!';
        nextLevelEl.textContent = level + 1;
        levelUpEl.classList.remove('hidden');
        // TODO: 接入广告后，level >= 2 时在此处调用 showAd(() => startNextLevel())
        setTimeout(startNextLevel, 1500);
        return true;
    }
    return false;
}

function showComboWord(combo) {
    if (combo < 1) return;
    const idx = Math.min(combo - 1, COMBO_WORDS.length - 1);
    const newEl = comboTextEl.cloneNode(false);
    newEl.textContent = COMBO_WORDS[idx];
    newEl.classList.add('show');
    comboTextEl.parentNode.replaceChild(newEl, comboTextEl);
    comboTextEl = newEl;
}

// === 事件绑定 ===

document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
restartBtn.addEventListener('click', init);
playAgainBtn.addEventListener('click', init);

init();
