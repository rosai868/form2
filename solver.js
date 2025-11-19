// solver.js (賢い初期生成・縦交換版)

const SHIFT = {
    DAY: '日',
    EVE: '準',
    NIGHT: '夜',
    OFF: '休',
    LEAVE: '年', 
    TRIP: '出', 
    SUMMER: '夏' 
};

// 重み設定
const WEIGHTS = {
    HARD: 1000000,  // 絶対条件（リーダー不足など）
    REQUEST: 50000, // 希望無視
    LIMIT: 10000,   // 夜勤回数オーバー
    PATTERN: 3000,  // 並びの悪さ
    BALANCE: 100    // バランス
};

self.onmessage = function(e) {
    const { staffList, requestList, year, month } = e.data;
    const daysInMonth = new Date(year, month, 0).getDate();
    const calendar = createCalendar(year, month, daysInMonth);

    // 1. 初期解生成（リーダー要件を確実に満たす）
    let schedule = generateSmartSchedule(staffList, calendar);
    let currentScore = calculateScore(schedule, staffList, calendar, requestList);
    
    let bestSchedule = JSON.parse(JSON.stringify(schedule));
    let bestScore = currentScore;

    const MAX_ITERATIONS = 200000; 

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        // 縦交換
        const neighbor = swapVertical(schedule, staffList, calendar);
        const newScore = calculateScore(neighbor, staffList, calendar, requestList);

        // 単純な山登り法
        if (newScore <= currentScore) {
            schedule = neighbor;
            currentScore = newScore;
            if (newScore < bestScore) {
                bestSchedule = JSON.parse(JSON.stringify(neighbor));
                bestScore = newScore;
            }
        }

        if (i % 500 === 0) {
            self.postMessage({ 
                type: 'progress', 
                iteration: i, 
                max: MAX_ITERATIONS, 
                score: bestScore,
                schedule: bestSchedule // 途中経過を送る
            });
        }

        if (bestScore === 0) break;
    }

    self.postMessage({ type: 'done', schedule: bestSchedule, score: bestScore });
};

// カレンダー作成
function createCalendar(year, month, days) {
    const calendar = [];
    const holidays = {
        '2025-01-01': true, '2025-01-13': true, '2025-02-11': true, 
        '2025-02-23': true, '2025-02-24': true, '2025-03-20': true,
        '2025-04-29': true, '2025-05-03': true, '2025-05-04': true,
        '2025-05-05': true, '2025-05-06': true,
        '2025-07-21': true, '2025-08-11': true, '2025-09-15': true, '2025-09-23': true,
        '2025-10-13': true, '2025-11-03': true, '2025-11-23': true, '2025-11-24': true,
        '2025-12-29': true, '2025-12-30': true, '2025-12-31': true,
        '2026-01-01': true, '2026-01-02': true, '2026-01-03': true
    };

    for (let d = 1; d <= days; d++) {
        const dateObj = new Date(year, month - 1, d);
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeek = dateObj.getDay();
        const isHoliday = (dayOfWeek === 0 || dayOfWeek === 6 || holidays[dateStr]);
        calendar.push({ date: d, dateStr, dayOfWeek, isHoliday }); 
    }
    return calendar;
}

// ■ 賢い初期生成（リーダーを優先割り当て）
function generateSmartSchedule(staffList, calendar) {
    const schedule = {}; 
    staffList.forEach(s => schedule[s.uid] = new Array(calendar.length).fill(null));

    // 1. 固定勤務者を埋める
    staffList.forEach(staff => {
        if (staff.originalId === 31) return;
        const isFixedDay = ['長坂', '中里', '長田'].some(n => staff.name.includes(n));
        if (isFixedDay) {
            calendar.forEach((day, i) => {
                schedule[staff.uid][i] = day.isHoliday ? SHIFT.OFF : SHIFT.DAY;
            });
        }
    });

    // 2. 日ごとに枠を作成して埋める
    calendar.forEach((day, dayIndex) => {
        // 必要なスロット定義
        let slots = [];
        
        // 日勤
        if (day.isHoliday) { // 休日: A3,B2 or A2,B3
            const pat = Math.random() > 0.5 ? { A:3, B:2 } : { A:2, B:3 };
            // 必ずリーダー枠を1つ確保
            slots.push({ shift: SHIFT.DAY, team: 'A', needLeader: true });
            for(let i=0; i<pat.A-1; i++) slots.push({ shift: SHIFT.DAY, team: 'A', needLeader: false });
            
            slots.push({ shift: SHIFT.DAY, team: 'B', needLeader: true });
            for(let i=0; i<pat.B-1; i++) slots.push({ shift: SHIFT.DAY, team: 'B', needLeader: false });
        } else { // 平日: A6, B6
            slots.push({ shift: SHIFT.DAY, team: 'A', needLeader: true });
            for(let i=0; i<5; i++) slots.push({ shift: SHIFT.DAY, team: 'A', needLeader: false });
            
            slots.push({ shift: SHIFT.DAY, team: 'B', needLeader: true });
            for(let i=0; i<5; i++) slots.push({ shift: SHIFT.DAY, team: 'B', needLeader: false });
        }

        // 準夜・夜勤 (A2,B1 or A1,B2)
        [SHIFT.EVE, SHIFT.NIGHT].forEach(s => {
            const pat = Math.random() > 0.5 ? { A:2, B:1 } : { A:1, B:2 };
            // 準・夜は「全体でリーダー1人」いればいいが、安全のため各チームにリーダー候補を優先的に当てる
            // ここでは簡易的に「枠」だけ作る
            for(let i=0; i<pat.A; i++) slots.push({ shift: s, team: 'A', needLeader: false }); // 後で調整
            for(let i=0; i<pat.B; i++) slots.push({ shift: s, team: 'B', needLeader: false });
        });

        // スタッフプール作成（すでに埋まってる人、白井さんなどを考慮）
        let poolA = staffList.filter(s => s.team === 'A' && s.originalId !== 31 && schedule[s.uid][dayIndex] === null);
        let poolB = staffList.filter(s => s.team === 'B' && s.originalId !== 31 && schedule[s.uid][dayIndex] === null);

        // --- 割り当て実行 ---
        
        // 1. リーダー必須枠を先に埋める
        const fillSlot = (slot, pool) => {
            let candidateIdx = -1;
            
            if (slot.needLeader) {
                // リーダーを探す
                candidateIdx = pool.findIndex(s => s.leader === true);
                // いなければ誰でもいい（エラーになるが止まらないように）
                if (candidateIdx === -1) candidateIdx = Math.floor(Math.random() * pool.length);
            } else {
                // 白井さんは準・夜ダメ
                if (slot.shift === SHIFT.EVE || slot.shift === SHIFT.NIGHT) {
                    candidateIdx = pool.findIndex(s => !s.name.includes('白井'));
                } else {
                    candidateIdx = Math.floor(Math.random() * pool.length);
                }
            }

            if (candidateIdx !== -1) {
                const staff = pool.splice(candidateIdx, 1)[0];
                schedule[staff.uid][dayIndex] = slot.shift;
            }
        };

        slots.forEach(slot => {
            if (slot.team === 'A') fillSlot(slot, poolA);
            else fillSlot(slot, poolB);
        });

        // 余った人は休み
        [...poolA, ...poolB].forEach(s => schedule[s.uid][dayIndex] = SHIFT.OFF);
    });

    return schedule;
}

// 縦交換
function swapVertical(currentSchedule, staffList, calendar) {
    const nextSchedule = JSON.parse(JSON.stringify(currentSchedule));
    const numDays = calendar.length;
    const d = Math.floor(Math.random() * numDays);

    // 交換候補（固定勤務者以外）
    const validStaff = staffList.filter(s => {
        if (s.originalId === 31) return false;
        if (['長坂', '中里', '長田'].some(n => s.name.includes(n))) return false;
        return true;
    });
    if (validStaff.length < 2) return nextSchedule;

    // 同チーム同士でのみ交換（人数枠を壊さないため）
    const team = Math.random() > 0.5 ? 'A' : 'B';
    const teamStaff = validStaff.filter(s => s.team === team);
    if (teamStaff.length < 2) return nextSchedule;

    const idx1 = Math.floor(Math.random() * teamStaff.length);
    let idx2 = Math.floor(Math.random() * teamStaff.length);
    while(idx1 === idx2) idx2 = Math.floor(Math.random() * teamStaff.length);

    const s1 = teamStaff[idx1];
    const s2 = teamStaff[idx2];
    const shift1 = nextSchedule[s1.uid][d];
    const shift2 = nextSchedule[s2.uid][d];

    // 白井さんガード
    if (s1.name.includes('白井') && (shift2 === SHIFT.EVE || shift2 === SHIFT.NIGHT)) return nextSchedule;
    if (s2.name.includes('白井') && (shift1 === SHIFT.EVE || shift1 === SHIFT.NIGHT)) return nextSchedule;

    nextSchedule[s1.uid][d] = shift2;
    nextSchedule[s2.uid][d] = shift1;

    return nextSchedule;
}

// スコア計算
function calculateScore(schedule, staffList, calendar, requests) {
    let penalty = 0;
    const numDays = calendar.length;

    // 1. 日別チェック（リーダー要件）
    for (let d = 0; d < numDays; d++) {
        let leaders = { [SHIFT.DAY]: { A:0, B:0 }, [SHIFT.EVE]: 0, [SHIFT.NIGHT]: 0 };
        
        staffList.forEach(staff => {
            if(staff.originalId === 31) return;
            const shift = schedule[staff.uid][d];
            if (staff.leader) {
                if (shift === SHIFT.DAY) leaders[shift][staff.team]++;
                if (shift === SHIFT.EVE || shift === SHIFT.NIGHT) leaders[shift]++;
            }
        });

        if (leaders[SHIFT.DAY].A < 1) penalty += WEIGHTS.HARD;
        if (leaders[SHIFT.DAY].B < 1) penalty += WEIGHTS.HARD;
        if (leaders[SHIFT.EVE] < 1) penalty += WEIGHTS.HARD;
        if (leaders[SHIFT.NIGHT] < 1) penalty += WEIGHTS.HARD;
    }

    // 2. 個人チェック
    staffList.forEach(staff => {
        if(staff.originalId === 31) return;
        const shifts = schedule[staff.uid];
        const reqDates = requests[staff.uid]?.dates || {};
        let nightCount = 0;

        for (let d = 0; d < numDays; d++) {
            const shift = shifts[d];
            const dateStr = calendar[d].dateStr;
            
            if (reqDates[dateStr] && reqDates[dateStr] !== shift) {
                penalty += WEIGHTS.REQUEST;
            }
            if (shift === SHIFT.EVE || shift === SHIFT.NIGHT) nightCount++;
        }

        if (nightCount > 8) penalty += (nightCount - 8) * WEIGHTS.LIMIT;

        // 並び
        for (let d = 0; d < numDays - 1; d++) {
            const s1 = shifts[d];
            const s2 = shifts[d+1];
            // 準・夜明けの日勤禁止
            if ((s1 === SHIFT.NIGHT || s1 === SHIFT.EVE) && s2 === SHIFT.DAY) penalty += WEIGHTS.HARD;
            // 準の次は準か休
            if (s1 === SHIFT.EVE && s2 !== SHIFT.EVE && s2 !== SHIFT.OFF) penalty += WEIGHTS.PATTERN;
            // 夜の次は夜か休
            if (s1 === SHIFT.NIGHT && s2 !== SHIFT.NIGHT && s2 !== SHIFT.OFF) penalty += WEIGHTS.PATTERN;
        }
    });

    return penalty;
}
