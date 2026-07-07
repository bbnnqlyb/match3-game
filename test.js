// 完整集成测试
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
            let type; do { type = randomType(); } while (wouldMatch(r, c, type));
            board[r][c] = type; special[r][c] = SPECIAL_NONE;
        }
    }
}
function findMatches() {
    const matchGroups = [];
    function canMatch(r, c) { return board[r][c] !== -1 && special[r][c] !== SPECIAL_VORTEX; }
    for (let r = 0; r < ROWS; r++) {
        let c = 0;
        while (c < COLS) {
            if (!canMatch(r, c)) { c++; continue; }
            const type = board[r][c]; let end = c;
            while (end + 1 < COLS && canMatch(r, end + 1) && board[r][end + 1] === type) end++;
            if (end - c + 1 >= 3) {
                const group = []; for (let i = c; i <= end; i++) group.push({ row: r, col: i });
                matchGroups.push({ cells: group, length: end - c + 1, type, direction: 'h' });
            }
            c = end + 1;
        }
    }
    for (let c = 0; c < COLS; c++) {
        let r = 0;
        while (r < ROWS) {
            if (!canMatch(r, c)) { r++; continue; }
            const type = board[r][c]; let end = r;
            while (end + 1 < ROWS && canMatch(end + 1, c) && board[end + 1][c] === type) end++;
            if (end - r + 1 >= 3) {
                const group = []; for (let i = r; i <= end; i++) group.push({ row: i, col: c });
                matchGroups.push({ cells: group, length: end - r + 1, type, direction: 'v' });
            }
            r = end + 1;
        }
    }
    const matchedSet = new Set();
    matchGroups.forEach(g => g.cells.forEach(cell => matchedSet.add(`${cell.row},${cell.col}`)));
    return { matches: Array.from(matchedSet).map(s => { const [r,c] = s.split(',').map(Number); return {row:r,col:c}; }), groups: matchGroups };
}
function determineSpecials(groups) {
    const specials = [], usedPositions = new Set();
    for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
            const gi = groups[i], gj = groups[j];
            if (gi.type !== gj.type || gi.direction === gj.direction) continue;
            const setI = new Set(gi.cells.map(c => `${c.row},${c.col}`));
            const inter = gj.cells.filter(c => setI.has(`${c.row},${c.col}`));
            if (inter.length > 0) {
                const cp = inter[0], key = `${cp.row},${cp.col}`;
                if (usedPositions.has(key)) continue;
                const all = new Set([...gi.cells.map(c => `${c.row},${c.col}`), ...gj.cells.map(c => `${c.row},${c.col}`)]);
                if (all.size >= 5) { specials.push({row:cp.row,col:cp.col,type:gi.type,specialType:SPECIAL_VORTEX}); usedPositions.add(key); }
                else if (all.size >= 4) { specials.push({row:cp.row,col:cp.col,type:gi.type,specialType:SPECIAL_BOMB}); usedPositions.add(key); }
            }
        }
    }
    const sorted = [...groups].sort((a,b) => b.length - a.length);
    for (const g of sorted) {
        if (g.length >= 5) { const p = g.cells[Math.floor(g.cells.length/2)], k=`${p.row},${p.col}`; if (!usedPositions.has(k)) { specials.push({row:p.row,col:p.col,type:g.type,specialType:SPECIAL_VORTEX}); usedPositions.add(k); } }
        else if (g.length === 4) { const p = g.cells[Math.floor(g.cells.length/2)], k=`${p.row},${p.col}`; if (!usedPositions.has(k)) { specials.push({row:p.row,col:p.col,type:g.type,specialType:SPECIAL_BOMB}); usedPositions.add(k); } }
    }
    return specials;
}
function clearCells(cells) { cells.forEach(({row,col}) => { board[row][col] = -1; special[row][col] = SPECIAL_NONE; }); }
function dropTiles() {
    for (let c = 0; c < COLS; c++) {
        let e = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) { if (board[r][c] !== -1) { board[e][c] = board[r][c]; special[e][c] = special[r][c]; if (e !== r) { board[r][c] = -1; special[r][c] = SPECIAL_NONE; } e--; } }
        for (let r = e; r >= 0; r--) { board[r][c] = -1; special[r][c] = SPECIAL_NONE; }
    }
}
function fillEmpty() { for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (board[r][c] === -1) { board[r][c] = randomType(); special[r][c] = SPECIAL_NONE; } }
function makeCleanBoard() {
    board = []; special = [];
    for (let r = 0; r < ROWS; r++) { board[r] = []; special[r] = []; for (let c = 0; c < COLS; c++) { board[r][c] = (r*2+c)%TYPES; special[r][c] = SPECIAL_NONE; } }
}

// 模拟 processMatches 核心逻辑（不含 async/DOM）
function simulateProcessMatches(matchResult) {
    const { matches, groups } = matchResult;
    const triggeredBombs = matches.filter(({row,col}) => special[row][col] === SPECIAL_BOMB);
    const toRemoveSet = new Set(matches.map(m => `${m.row},${m.col}`));
    for (const bomb of triggeredBombs) { for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) { const nr=bomb.row+dr,nc=bomb.col+dc; if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS) toRemoveSet.add(`${nr},${nc}`); } }
    let hasNew = true; const processed = new Set(triggeredBombs.map(b=>`${b.row},${b.col}`));
    while (hasNew) { hasNew = false; for (const s of toRemoveSet) { const [r,c]=s.split(',').map(Number); if(special[r][c]===SPECIAL_BOMB&&!processed.has(`${r},${c}`)) { processed.add(`${r},${c}`); hasNew=true; for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){const nr=r+dr,nc=c+dc; if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS) toRemoveSet.add(`${nr},${nc}`);} } } }
    // 漩涡被波及
    const vtc = triggeredBombs.length > 0 ? board[triggeredBombs[0].row][triggeredBombs[0].col] : null;
    let hasV = false;
    for (const s of toRemoveSet) { const [r,c]=s.split(',').map(Number); if (special[r][c]===SPECIAL_VORTEX) hasV=true; }
    if (hasV && vtc !== null) { for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(board[r][c]===vtc) toRemoveSet.add(`${r},${c}`); }
    const finalRemove = Array.from(toRemoveSet).map(s=>{const[r,c]=s.split(',').map(Number);return{row:r,col:c};});
    const specialToCreate = determineSpecials(groups);
    clearCells(finalRemove);
    specialToCreate.forEach(({row,col,type,specialType})=>{board[row][col]=type;special[row][col]=specialType;});
    dropTiles(); fillEmpty();
    return { removed: finalRemove.length, specials: specialToCreate };
}

// 模拟 handleDoubleBombSwap
function simulateDoubleBomb(a, b) {
    const triggerColor = board[a.row][a.col];
    const toRemoveSet = new Set();
    for (const bomb of [a,b]) { for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) { const nr=bomb.row+dr,nc=bomb.col+dc; if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS) toRemoveSet.add(`${nr},${nc}`); } }
    const proc = new Set([`${a.row},${a.col}`,`${b.row},${b.col}`]);
    let hasNew=true;
    while(hasNew){hasNew=false;for(const s of toRemoveSet){const[r,c]=s.split(',').map(Number);if(special[r][c]===SPECIAL_BOMB&&!proc.has(`${r},${c}`)){proc.add(`${r},${c}`);hasNew=true;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const nr=r+dr,nc=c+dc;if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS)toRemoveSet.add(`${nr},${nc}`);}}}}
    let hasV=false;
    for(const s of toRemoveSet){const[r,c]=s.split(',').map(Number);if(special[r][c]===SPECIAL_VORTEX)hasV=true;}
    if(hasV){for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(board[r][c]===triggerColor)toRemoveSet.add(`${r},${c}`);}
    const finalRemove=Array.from(toRemoveSet).map(s=>{const[r,c]=s.split(',').map(Number);return{row:r,col:c};});
    clearCells(finalRemove); dropTiles(); fillEmpty();
    return { removed: finalRemove.length };
}

// 模拟 handleBombVortexSwap
function simulateBombVortexSwap(a, b) {
    const bombPos = special[a.row][a.col] === SPECIAL_BOMB ? a : b;
    const vortexPos = bombPos === a ? b : a;
    const targetColor = board[bombPos.row][bombPos.col];
    special[bombPos.row][bombPos.col] = SPECIAL_NONE;
    special[vortexPos.row][vortexPos.col] = SPECIAL_NONE;
    const toRemoveSet = new Set();
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(board[r][c]===targetColor) toRemoveSet.add(`${r},${c}`);
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){const nr=bombPos.row+dr,nc=bombPos.col+dc;if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS)toRemoveSet.add(`${nr},${nc}`);}
    toRemoveSet.add(`${vortexPos.row},${vortexPos.col}`);
    toRemoveSet.add(`${bombPos.row},${bombPos.col}`);
    const finalRemove=Array.from(toRemoveSet).map(s=>{const[r,c]=s.split(',').map(Number);return{row:r,col:c};});
    clearCells(finalRemove); dropTiles(); fillEmpty();
    return { removed: finalRemove.length };
}

// ===== 测试 =====
let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) { passed++; console.log(`  ✓ ${msg}`); } else { failed++; console.log(`  ✗ FAIL: ${msg}`); } }

// 1. 初始棋盘无匹配
console.log('\n[1] 初始棋盘无匹配');
generateBoard();
assert(findMatches().matches.length === 0, '无匹配');

// 2. 3连检测
console.log('\n[2] 3连检测');
makeCleanBoard(); board[5]=[1,1,1,2,3,4,5,0];
const r2=findMatches(); assert(r2.matches.filter(m=>m.row===5).length===3, '横向3连');
makeCleanBoard(); board[3][2]=1;board[4][2]=1;board[5][2]=1;
const r2b=findMatches(); assert(r2b.matches.filter(m=>m.col===2).length===3, '纵向3连');

// 3. 4连生成BOMB
console.log('\n[3] 4连->BOMB');
makeCleanBoard(); board[5]=[1,1,1,1,2,3,4,5];
const r3=findMatches(); const s3=determineSpecials(r3.groups);
assert(s3.length===1 && s3[0].specialType===SPECIAL_BOMB, '直线4连生成BOMB');

// 4. 5连生成VORTEX
console.log('\n[4] 5连->VORTEX');
makeCleanBoard(); board[5]=[1,1,1,1,1,2,3,4];
const r4=findMatches(); const s4=determineSpecials(r4.groups);
assert(s4.length===1 && s4[0].specialType===SPECIAL_VORTEX, '直线5连生成VORTEX');

// 5. T形(3+3=5块)->VORTEX
console.log('\n[5] T形->VORTEX');
makeCleanBoard(); board[3][2]=1;board[4][1]=1;board[4][2]=1;board[4][3]=1;board[5][2]=1;
board[3][1]=2;board[3][3]=3;board[5][1]=4;board[5][3]=5;board[2][2]=0;board[6][2]=0;board[4][0]=3;board[4][4]=2;
const r5=findMatches(); const s5=determineSpecials(r5.groups);
assert(s5.length===1 && s5[0].specialType===SPECIAL_VORTEX, 'T形5块生成VORTEX');

// 6. 漩涡不参与自动匹配
console.log('\n[6] 漩涡不参与自动匹配');
makeCleanBoard(); board[5]=[1,1,1,2,3,4,5,0]; special[5][1]=SPECIAL_VORTEX;
const r6=findMatches(); assert(r6.matches.filter(m=>m.row===5).length===0, '漩涡断开匹配');

// 7. 爆炸宝石参与匹配
console.log('\n[7] BOMB参与自动匹配');
makeCleanBoard(); board[5]=[1,1,1,2,3,4,5,0]; special[5][1]=SPECIAL_BOMB;
const r7=findMatches(); assert(r7.matches.filter(m=>m.row===5).length===3, 'BOMB正常参与');

// 8. 爆炸宝石被匹配时3x3消除
console.log('\n[8] BOMB触发3x3');
makeCleanBoard(); board[5]=[1,1,1,2,3,4,5,0]; special[5][1]=SPECIAL_BOMB;
const r8=findMatches();
const res8=simulateProcessMatches(r8);
assert(res8.removed===9, `BOMB消除范围=${res8.removed} (应为9)`);

// 9. 连锁爆炸
console.log('\n[9] 连锁爆炸');
makeCleanBoard(); board[5]=[1,1,1,2,3,4,5,0]; special[5][1]=SPECIAL_BOMB; special[4][2]=SPECIAL_BOMB; board[4][2]=3;
const r9=findMatches();
const res9=simulateProcessMatches(r9);
assert(res9.removed > 9, `连锁消除=${res9.removed} (应>9)`);

// 10. 爆炸波及漩涡 -> 触发漩涡效果
console.log('\n[10] 爆炸波及漩涡');
makeCleanBoard(); board[5]=[1,1,1,2,3,4,5,0]; special[5][1]=SPECIAL_BOMB;
special[4][0]=SPECIAL_VORTEX; board[4][0]=2; // 漩涡在爆炸范围内
// 爆炸宝石颜色=1，漩涡被波及后应消除全场颜色1 + 原始3x3
const r10=findMatches();
const res10=simulateProcessMatches(r10);
assert(res10.removed > 9, `波及漩涡后消除=${res10.removed} (应>9, 包含全场颜色1的块)`);

// 11. 双爆炸宝石交换
console.log('\n[11] 双BOMB交换');
makeCleanBoard(); special[4][3]=SPECIAL_BOMB; special[4][4]=SPECIAL_BOMB;
const res11=simulateDoubleBomb({row:4,col:3},{row:4,col:4});
// 两个相邻3x3: rows3-5 x cols2-5 = 3x4 = 12
assert(res11.removed === 12, `双爆炸消除=${res11.removed} (应=12, 3行x4列)`);

// 12. 双爆炸波及漩涡
console.log('\n[12] 双BOMB波及漩涡');
makeCleanBoard();
board[4][3]=1; special[4][3]=SPECIAL_BOMB;
board[4][4]=2; special[4][4]=SPECIAL_BOMB;
special[4][2]=SPECIAL_VORTEX; board[4][2]=3; // 漩涡在爆炸范围内
// 第一个选的是(4,3)颜色=1，漩涡被触发后消除全场颜色1
const color1count=board.flat().filter(v=>v===1).length;
const res12=simulateDoubleBomb({row:4,col:3},{row:4,col:4});
assert(res12.removed > 14, `双爆炸+漩涡消除=${res12.removed} (应>14)`);

// 13. 爆炸+漩涡交换
console.log('\n[13] BOMB+VORTEX交换');
makeCleanBoard();
board[4][3]=1; special[4][3]=SPECIAL_BOMB;
board[4][4]=2; special[4][4]=SPECIAL_VORTEX;
// 应该：漩涡消除全场颜色1 + 爆炸(4,3)的3x3范围
const color1before=board.flat().filter(v=>v===1).length;
const res13=simulateBombVortexSwap({row:4,col:3},{row:4,col:4});
assert(res13.removed >= color1before + 5, `BOMB+VORTEX消除=${res13.removed} (应>=${color1before}+几个3x3额外块)`);

// 14. 计分规则
console.log('\n[14] 计分规则');
let score=0, comboCount=0;
comboCount++; let base=3*10; score += (comboCount===1)?base:base+base*comboCount;
assert(score===30, `第1次: ${score}=30`);
comboCount++; base=4*10; score += (comboCount===1)?base:base+base*comboCount;
assert(score===150, `第2次: ${score}=150`);
comboCount++; base=3*10; score += (comboCount===1)?base:base+base*comboCount;
assert(score===270, `第3次: ${score}=270`);

// 15. 下落逻辑
console.log('\n[15] 下落逻辑');
makeCleanBoard();
board[0][3]=5; special[0][3]=SPECIAL_BOMB;
board[1][3]=-1; board[2][3]=-1;
board[3][3]=2; special[3][3]=SPECIAL_VORTEX;
dropTiles();
assert(board[2][3]===5 && special[2][3]===SPECIAL_BOMB, 'BOMB正确下落');
assert(board[3][3]===2 && special[3][3]===SPECIAL_VORTEX, 'VORTEX正确保留位置');

// 总结
console.log(`\n===== 结果: ${passed} 通过, ${failed} 失败 =====`);
process.exit(failed > 0 ? 1 : 0);
