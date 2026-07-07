// 消消乐逻辑测试（Node.js 运行）

const ROWS = 8, COLS = 8, TYPES = 6;
const SPECIAL_NONE = 0, SPECIAL_BOMB = 1, SPECIAL_VORTEX = 2;
let board = [], special = [];

function randomType() { return Math.floor(Math.random() * TYPES); }

function wouldMatch(row, col, type) {
    if (col >= 2 && board[row][col - 1] === type && board[row][col - 2] === type) return true;
    if (row >= 2 && board[row - 1][col] === type && board[row - 2][col] === type) return true;
    return false;
}

function generateBoard() {
    board = []; special = [];
    for (let r = 0; r < ROWS; r++) {
        board[r] = []; special[r] = [];
        for (let c = 0; c < COLS; c++) {
            let type;
            do { type = randomType(); } while (wouldMatch(r, c, type));
            board[r][c] = type; special[r][c] = SPECIAL_NONE;
        }
    }
}

function findMatches() {
    const matchGroups = [];
    function canMatch(r, c) {
        if (board[r][c] === -1) return false;
        if (special[r][c] === SPECIAL_VORTEX) return false;
        return true;
    }
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
                for (let i = c; i <= end; i++) group.push({ row: r, col: i });
                matchGroups.push({ cells: group, length: len, type, direction: 'h' });
            }
            c = end + 1;
        }
    }
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
                for (let i = r; i <= end; i++) group.push({ row: i, col: c });
                matchGroups.push({ cells: group, length: len, type, direction: 'v' });
            }
            r = end + 1;
        }
    }
    const matchedSet = new Set();
    matchGroups.forEach(g => g.cells.forEach(cell => matchedSet.add(`${cell.row},${cell.col}`)));
    const allMatches = Array.from(matchedSet).map(s => { const [r, c] = s.split(',').map(Number); return { row: r, col: c }; });
    return { matches: allMatches, groups: matchGroups };
}

function determineSpecials(groups) {
    const specials = [], usedPositions = new Set();
    const sorted = [...groups].sort((a, b) => b.length - a.length);
    for (const group of sorted) {
        const mid = Math.floor(group.cells.length / 2);
        const pos = group.cells[mid];
        const key = `${pos.row},${pos.col}`;
        if (usedPositions.has(key)) continue;
        if (group.length >= 5) {
            specials.push({ row: pos.row, col: pos.col, type: group.type, specialType: SPECIAL_VORTEX });
            usedPositions.add(key);
        } else if (group.length === 4) {
            specials.push({ row: pos.row, col: pos.col, type: group.type, specialType: SPECIAL_BOMB });
            usedPositions.add(key);
        }
    }
    return specials;
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

function clearCells(cells) {
    cells.forEach(({ row, col }) => { board[row][col] = -1; special[row][col] = SPECIAL_NONE; });
}

// 生成无匹配的棋盘数据（交替模式）
function makeCleanBoard() {
    board = []; special = [];
    for (let r = 0; r < ROWS; r++) {
        board[r] = []; special[r] = [];
        for (let c = 0; c < COLS; c++) {
            // 交替模式确保没有3连
            board[r][c] = (r * 2 + c) % TYPES;
            special[r][c] = SPECIAL_NONE;
        }
    }
}

// ===== 测试 =====
let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log(`  ✓ ${msg}`); }
    else { failed++; console.log(`  ✗ FAIL: ${msg}`); }
}

// 测试1: 初始棋盘没有匹配
console.log('\n[测试1] 初始棋盘不应有匹配');
generateBoard();
const initResult = findMatches();
assert(initResult.matches.length === 0, `初始匹配数 = ${initResult.matches.length} (应为0)`);

// 测试2: 横向3连检测
console.log('\n[测试2] 横向3连检测');
makeCleanBoard();
board[3] = [1, 1, 1, 2, 3, 4, 5, 0]; // 第3行前3个是1
const test2 = findMatches();
const test2row3 = test2.matches.filter(m => m.row === 3);
assert(test2row3.length === 3, `第3行找到 ${test2row3.length} 个匹配 (应为3)`);

// 测试3: 纵向3连检测
console.log('\n[测试3] 纵向3连检测');
makeCleanBoard();
board[2][4] = 5; board[3][4] = 5; board[4][4] = 5; // 第4列连续3个5
const test3 = findMatches();
const test3col4 = test3.matches.filter(m => m.col === 4);
assert(test3col4.length === 3, `第4列找到 ${test3col4.length} 个匹配 (应为3)`);

// 测试4: 4连生成爆炸宝石
console.log('\n[测试4] 4连应生成爆炸宝石');
makeCleanBoard();
board[3] = [1, 1, 1, 1, 2, 3, 4, 5]; // 4连
const test4 = findMatches();
const test4groups = test4.groups.filter(g => g.length === 4);
assert(test4groups.length === 1, `找到${test4groups.length}个4连组 (应为1)`);
const specials4 = determineSpecials(test4.groups);
const bombs4 = specials4.filter(s => s.specialType === SPECIAL_BOMB);
assert(bombs4.length === 1, `生成爆炸宝石数 = ${bombs4.length} (应为1)`);
assert(bombs4[0]?.row === 3, `爆炸宝石在第3行`);

// 测试5: 5连生成消除漩涡
console.log('\n[测试5] 5连应生成消除漩涡');
makeCleanBoard();
board[3] = [1, 1, 1, 1, 1, 2, 3, 4]; // 5连
const test5 = findMatches();
const specials5 = determineSpecials(test5.groups);
const vortexes5 = specials5.filter(s => s.specialType === SPECIAL_VORTEX);
assert(vortexes5.length === 1, `生成漩涡数 = ${vortexes5.length} (应为1)`);
assert(vortexes5[0]?.col === 2, `漩涡在中间位置 col=${vortexes5[0]?.col} (应为2)`);

// 测试6: 漩涡不参与自动匹配（作为断点）
console.log('\n[测试6] 消除漩涡不参与自动匹配');
makeCleanBoard();
board[3] = [1, 1, 1, 2, 3, 4, 5, 0]; // 前3个是1
special[3][1] = SPECIAL_VORTEX; // 中间那个标记为漩涡
const test6 = findMatches();
const test6row3 = test6.matches.filter(m => m.row === 3);
assert(test6row3.length === 0, `漩涡断点后第3行匹配数 = ${test6row3.length} (应为0，因为漩涡把3连断成1+1)`);

// 测试7: 爆炸宝石正常参与匹配
console.log('\n[测试7] 爆炸宝石参与自动匹配');
makeCleanBoard();
board[3] = [1, 1, 1, 2, 3, 4, 5, 0];
special[3][1] = SPECIAL_BOMB; // 中间是爆炸宝石
const test7 = findMatches();
const test7row3 = test7.matches.filter(m => m.row === 3);
assert(test7row3.length === 3, `爆炸宝石参与时第3行匹配数 = ${test7row3.length} (应为3)`);

// 测试8: 爆炸宝石被匹配后扩展3x3范围
console.log('\n[测试8] 爆炸宝石3x3消除范围');
makeCleanBoard();
board[3] = [1, 1, 1, 2, 3, 4, 5, 0];
special[3][1] = SPECIAL_BOMB;
const test8 = findMatches();
const triggeredBombs8 = test8.matches.filter(({row,col}) => special[row][col] === SPECIAL_BOMB);
const toRemoveSet8 = new Set(test8.matches.map(m => `${m.row},${m.col}`));
for (const bomb of triggeredBombs8) {
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
            const nr = bomb.row + dr, nc = bomb.col + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) toRemoveSet8.add(`${nr},${nc}`);
        }
}
// (3,1)的3x3范围: row 2-4, col 0-2 = 9格，加上原本匹配的(3,0)(3,2)已经包含在内
assert(toRemoveSet8.size === 9, `消除范围 = ${toRemoveSet8.size} (应为9: 3x3)`);

// 测试9: 两个相邻爆炸宝石连锁
console.log('\n[测试9] 爆炸宝石连锁爆炸');
makeCleanBoard();
board[3] = [1, 1, 1, 2, 3, 4, 5, 0];
special[3][1] = SPECIAL_BOMB; // 触发的炸弹
board[3][3] = 2; // 确保不干扰
special[2][2] = SPECIAL_BOMB; // 在(3,1)的爆炸范围内，会被波及
board[2][2] = 3; // 给它一个颜色

const test9 = findMatches();
const triggeredBombs9 = test9.matches.filter(({row,col}) => special[row][col] === SPECIAL_BOMB);
const toRemoveSet9 = new Set(test9.matches.map(m => `${m.row},${m.col}`));
for (const bomb of triggeredBombs9) {
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
            const nr = bomb.row + dr, nc = bomb.col + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) toRemoveSet9.add(`${nr},${nc}`);
        }
}
// 连锁检查
let hasNewBombs = true;
const processedBombs9 = new Set(triggeredBombs9.map(b => `${b.row},${b.col}`));
while (hasNewBombs) {
    hasNewBombs = false;
    const currentCells = Array.from(toRemoveSet9).map(s => { const [r,c] = s.split(',').map(Number); return {row:r,col:c}; });
    for (const { row, col } of currentCells) {
        const key = `${row},${col}`;
        if (special[row][col] === SPECIAL_BOMB && !processedBombs9.has(key)) {
            processedBombs9.add(key);
            hasNewBombs = true;
            for (let dr = -1; dr <= 1; dr++)
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = row + dr, nc = col + dc;
                    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) toRemoveSet9.add(`${nr},${nc}`);
                }
        }
    }
}
assert(processedBombs9.size === 2, `连锁爆炸宝石数 = ${processedBombs9.size} (应为2)`);
assert(toRemoveSet9.size > 9, `两次爆炸总范围 = ${toRemoveSet9.size} (应>9)`);

// 测试10: 漩涡不被爆炸波及
console.log('\n[测试10] 漩涡不被爆炸波及');
makeCleanBoard();
board[3] = [1, 1, 1, 2, 3, 4, 5, 0];
special[3][1] = SPECIAL_BOMB;
special[2][0] = SPECIAL_VORTEX; // 在爆炸范围内
board[2][0] = 5;
const test10 = findMatches();
const toRemoveSet10 = new Set(test10.matches.map(m => `${m.row},${m.col}`));
const triggeredBombs10 = test10.matches.filter(({row,col}) => special[row][col] === SPECIAL_BOMB);
for (const bomb of triggeredBombs10) {
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
            const nr = bomb.row + dr, nc = bomb.col + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) toRemoveSet10.add(`${nr},${nc}`);
        }
}
const finalRemove10 = Array.from(toRemoveSet10).map(s => { const [r,c] = s.split(',').map(Number); return {row:r,col:c}; })
    .filter(({row,col}) => special[row][col] !== SPECIAL_VORTEX);
const vortexRemoved = finalRemove10.some(({row,col}) => row === 2 && col === 0);
assert(!vortexRemoved, `漩涡(2,0)不在最终消除列表中`);

// 测试11: 计分规则
console.log('\n[测试11] 计分规则验证');
let score = 0, comboCount = 0;
comboCount++; // 第1次
let baseScore = 3 * 10;
score += (comboCount === 1) ? baseScore : baseScore + baseScore * comboCount;
assert(score === 30, `第1次消3块: ${score} (应为30)`);

comboCount++; // 第2次
baseScore = 4 * 10;
score += (comboCount === 1) ? baseScore : baseScore + baseScore * comboCount;
assert(score === 150, `第2次消4块: ${score} (应为150 = 30+40+80)`);

comboCount++; // 第3次
baseScore = 3 * 10;
score += (comboCount === 1) ? baseScore : baseScore + baseScore * comboCount;
assert(score === 270, `第3次消3块: ${score} (应为270 = 150+30+90)`);

// 测试12: dropTiles 正确下落（含特殊宝石）
console.log('\n[测试12] 下落逻辑（特殊宝石正确随之下落）');
makeCleanBoard();
board[0][3] = 5; special[0][3] = SPECIAL_BOMB;
board[1][3] = -1; // 空
board[2][3] = -1; // 空
board[3][3] = 2; special[3][3] = SPECIAL_VORTEX;
for (let r = 4; r < 8; r++) board[r][3] = r;
dropTiles();
// BOMB从(0,3)下落到(2,3)（跳过两个空格），VORTEX在(3,3)不动（下面没有空隙）
assert(board[2][3] === 5 && special[2][3] === SPECIAL_BOMB, `BOMB从(0,3)下落到(2,3): type=${board[2][3]} sp=${special[2][3]}`);
assert(board[3][3] === 2 && special[3][3] === SPECIAL_VORTEX, `VORTEX留在(3,3): type=${board[3][3]} sp=${special[3][3]}`);

// 测试13: 特殊宝石跟随下落（下方有空隙时）
console.log('\n[测试13] 特殊宝石有空隙时正确下落');
makeCleanBoard();
board[0][0] = 3; special[0][0] = SPECIAL_VORTEX;
board[1][0] = -1;
board[2][0] = -1;
board[3][0] = -1;
for (let r = 4; r < 8; r++) board[r][0] = r;
dropTiles();
assert(board[3][0] === 3 && special[3][0] === SPECIAL_VORTEX, `VORTEX从(0,0)下落到(3,0): type=${board[3][0]} sp=${special[3][0]}`);

// 总结
console.log(`\n===== 结果: ${passed} 通过, ${failed} 失败 =====`);
process.exit(failed > 0 ? 1 : 0);
