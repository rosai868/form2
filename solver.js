// solver.js (改良版: 人数固定・縦交換方式)

const SHIFT = {
    DAY: '日',
    EVE: '準',
    NIGHT: '夜',
    OFF: '休',
    LEAVE: '年', // 年休
    TRIP: '出', // 出張
    SUMMER: '夏' // 夏休み
};

// 制約の重み（スコア）
const WEIGHTS = {
    // ハード制約（絶対に守るべき）
    HARD: 1000000, // 固定勤務者の違反など

    // ソフト制約（極力守る）
    REQUEST: 50000, // 希望休の無視（かなり重くする）
    
    LIMIT: 10000,   // 夜勤回数オーバー
    INTERVAL: 5000, // 深夜の間隔不足
    PATTERN: 3000,  // 悪い並び（準→日、夜→日など）
    
    LEADER: 5000,   // リーダー不在
    BALANCE: 100    // チームバランスなど微調整
};

self.onmessage = function(e) {
    const { staffList, requestList, year, month } = e.data;
    const daysInMonth = new Date(year, month, 0).getDate();
    const calendar = createCalendar(year, month, daysInMonth);

    // 1. 初期解生成（人数枠にスタッフをはめる）
    let schedule = generateStrictSchedule(staffList, calendar, requestList);
    let currentScore = calculateScore(schedule, staffList, calendar, requestList);
    
    let bestSchedule = JSON.parse(JSON.stringify(schedule));
    let bestScore = currentScore;

    // 2. 最適化ループ
    const MAX_ITERATIONS = 200000; // 回数を増やす

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        // 縦方向（同日内の別人）で交換を行う
        const neighbor = swapVertical(schedule, staffList, calendar);
        const newScore = calculateScore(neighbor, staffList, calendar, requestList);

        // 山登り法（単純に良くなれば採用）
        // ※停滞を防ぐため、同じスコアでも確率で遷移させる
        if (newScore <= currentScore) {
            schedule = neighbor;
            currentScore = newScore;

            if (newScore < bestScore) {
                bestSchedule = JSON.parse(JSON.stringify(neighbor));
                bestScore = newScore;
            }
        } else {
            // 焼きなまし的アプローチ（初期は悪い手も許容）
            // 今回は実装を単純にするため省略
        }

        if (i % 1000 === 0) {
            self.postMessage({ 
                type: 'progress', 
                iteration: i, 
                max: MAX_ITERATIONS, 
                score: bestScore 
            });
        }

        if (bestScore === 0) break;
    }

    self.postMessage({ type: 'done', schedule: bestSchedule, score: bestScore });
};

// カレンダー生成
function createCalendar(year, month, days) {
    const calendar = [];
    const holidays = {
        '2025-01-01': true, '2025-01-13': true, '2025-02-11': true, 
        '2025-02-23': true, '2025-02-24': true, '2025-03-20': true,
        '2025-04-29': true, '2025-05-03': true, '2025-05-04': true,
        '2025-05-05': true, '2025-05-06': true,
        // 必要に応じて年末年始を追加
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

// ■ 初期解生成（重要：ここで人数枠を確定させる）
function generateStrictSchedule(staffList, calendar, requests) {
    const schedule = {}; // { uid: [shift, shift...] }
    
    // 空の配列を準備
    staffList.forEach(s => schedule[s.uid] = new Array(calendar.length).fill(null));

    // 固定勤務者（長坂・中里・長田・白井）を先に埋める
    // これらの人は「人数枠」の一部を消費する
    staffList.forEach(staff => {
        if (staff.originalId === 31) return;

        const isFixedDay = ['長坂', '中里', '長田'].some(n => staff.name.includes(n));
        const isShirai = staff.name.includes('白井');

        if (isFixedDay) {
            calendar.forEach((day, i) => {
                schedule[staff.uid][i] = day.isHoliday ? SHIFT.OFF : SHIFT.DAY;
            });
        } else if (isShirai) {
            // 白井さんはとりあえず全部休みにしておく（後で割り当てロジックに入れるか、ここでランダム日勤にする）
            // ※今回のロジックでは「日勤専従」として扱うため、
            // 枠埋め時に考慮させる。一旦仮で埋める。
            calendar.forEach((day, i) => {
                schedule[staff.uid][i] = SHIFT.OFF; // 初期値
            });
        }
    });

    // 日ごとに枠を作り、スタッフを割り当てる
    calendar.forEach((day, dayIndex) => {
        // 1. その日の「必要なシフトの山」を作る
        let slots = [];

        if (day.isHoliday) {
            // 休日: 日勤5人(A3,B2 or A2,B3)
            const pattern = Math.random() > 0.5 ? { A:3, B:2 } : { A:2, B:3 };
            for(let i=0; i<pattern.A; i++) slots.push({ shift: SHIFT.DAY, team: 'A' });
            for(let i=0; i<pattern.B; i++) slots.push({ shift: SHIFT.DAY, team: 'B' });
        } else {
            // 平日: 日勤12人(A6, B6)
            for(let i=0; i<6; i++) slots.push({ shift: SHIFT.DAY, team: 'A' });
            for(let i=0; i<6; i++) slots.push({ shift: SHIFT.DAY, team: 'B' });
        }

        // 準夜・夜勤: 3人 (A2,B1 or A1,B2)
        [SHIFT.EVE, SHIFT.NIGHT].forEach(s => {
            const pattern = Math.random() > 0.5 ? { A:2, B:1 } : { A:1, B:2 };
            for(let i=0; i<pattern.A; i++) slots.push({ shift: s, team: 'A' });
            for(let i=0; i<pattern.B; i++) slots.push({ shift: s, team: 'B' });
        });

        // 2. スタッフをプールに分ける（固定勤務ですでに埋まっている人は除外）
        let availableA = [];
        let availableB = [];

        staffList.forEach(staff => {
            if (staff.originalId === 31) return; // 師長など除外
            
            // すでにシフトが決まっている人（固定勤務者）
            if (schedule[staff.uid][dayIndex] !== null) {
                // 白井さんは日勤可なので、もし日勤枠が余っていれば考慮したいが
                // 簡易化のため、固定勤務者は「枠外」で確定済みとする
                // ただし、固定勤務者が「日勤」の場合、上記の日勤枠（12人）に含まれるべきか？
                // → 通常は「定数内」なので、スロットからその分を減らす処理が必要
                
                const fixedShift = schedule[staff.uid][dayIndex];
                // スロットから一つ消す（マッチするものを探して削除）
                const slotIdx = slots.findIndex(s => s.shift === fixedShift && s.team === staff.team);
                if (slotIdx !== -1) {
                    slots.splice(slotIdx, 1);
                }
                return;
            }
            
            // 白井さんは特別扱い（日勤か休みのみ）
            if (staff.name.includes('白井')) {
                 // プールには入れるが、夜勤枠には入れない処理が必要
                 // ここでは簡易的にA/Bプールに入れる
            }

            if (staff.team === 'A') availableA.push(staff.uid);
            else if (staff.team === 'B') availableB.push(staff.uid);
        });

        // 3. シャッフル
        availableA = shuffle(availableA);
        availableB = shuffle(availableB);
        slots = shuffle(slots);

        // 4. 割り当て
        slots.forEach(slot => {
            let candidateUid = null;
            
            // 白井さんは夜勤・準夜に入れないガード
            if (slot.shift === SHIFT.EVE || slot.shift === SHIFT.NIGHT) {
                // 白井さん以外を探す
                if (slot.team === 'A') {
                    const idx = availableA.findIndex(uid => !getStaffName(uid, staffList).includes('白井'));
                    if (idx !== -1) candidateUid = availableA.splice(idx, 1)[0];
                } else {
                    const idx = availableB.findIndex(uid => !getStaffName(uid, staffList).includes('白井'));
                    if (idx !== -1) candidateUid = availableB.splice(idx, 1)[0];
                }
            } else {
                // 日勤なら誰でもOK
                if (slot.team === 'A') candidateUid = availableA.pop();
                else candidateUid = availableB.pop();
            }

            if (candidateUid) {
                schedule[candidateUid][dayIndex] = slot.shift;
            }
        });

        // 5. 余った人は全員「休み」
        [...availableA, ...availableB].forEach(uid => {
            schedule[uid][dayIndex] = SHIFT.OFF;
        });
    });

    // 希望休の上書き適用（最初は枠を無視してでも希望を入れる。スコア計算で調整する）
    // ただし、今回は「枠厳守」アプローチなので、
    // 「希望休」の人は、同日の「休み」の人と入れ替える処理を後で行う方が安全。
    // ここでは一旦そのままにする。

    return schedule;
}

// ヘルパー：シャッフル
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function getStaffName(uid, staffList) {
    const s = staffList.find(st => st.uid === uid);
    return s ? s.name : "";
}


// ■ 縦交換ロジック（同日内の入れ替え）
function swapVertical(currentSchedule, staffList, calendar) {
    const nextSchedule = JSON.parse(JSON.stringify(currentSchedule));
    const numDays = calendar.length;

    // ランダムな日を選ぶ
    const d = Math.floor(Math.random() * numDays);

    // その日のシフト状況を取得
    // 交換可能なペアを探す（固定勤務者を除外）
    const validStaff = staffList.filter(s => {
        if (s.originalId === 31) return false;
        if (['長坂', '中里', '長田'].some(n => s.name.includes(n))) return false;
        return true;
    });

    if (validStaff.length < 2) return nextSchedule;

    // ランダムに2人選ぶ
    const idx1 = Math.floor(Math.random() * validStaff.length);
    let idx2 = Math.floor(Math.random() * validStaff.length);
    while(idx1 === idx2) idx2 = Math.floor(Math.random() * validStaff.length);

    const staff1 = validStaff[idx1];
    const staff2 = validStaff[idx2];

    // シフトを取得
    const shift1 = nextSchedule[staff1.uid][d];
    const shift2 = nextSchedule[staff2.uid][d];

    // 同じシフトなら交換する意味がない
    if (shift1 === shift2) return nextSchedule;

    // 制約チェック
    // 白井さんは「日」か「休」しかダメ
    if (staff1.name.includes('白井') && (shift2 === SHIFT.EVE || shift2 === SHIFT.NIGHT)) return nextSchedule;
    if (staff2.name.includes('白井') && (shift1 === SHIFT.EVE || shift1 === SHIFT.NIGHT)) return nextSchedule;

    // チームが違う場合、人数枠制約を壊す可能性があるか？
    // 例: Aチーム日勤枠の人 と Bチーム休み枠の人 を入れ替える
    // -> Aチーム日勤が1減り、Bチーム日勤が1増える。これは「人数枠」としてはNG。
    // したがって、**「同じチーム同士」** または **「休みとの交換ならチーム不問（ただし人数バランスは崩れる）」**
    // 厳密に人数を守るなら、「同じチームの人同士」でしか交換できない、とするのが安全。
    // あるいは、「日勤・準・夜」はチームごとの枠が決まっているので、同チーム交換限定にする。
    
    if (staff1.team !== staff2.team) {
        // チームが違う場合、交換していいのは「両方とも休み」の場合だけ（意味ない）
        // 違うシフトを交換すると、チームごとの人数規定（A6人、B6人）が崩れる
        return nextSchedule;
    }

    // 交換実行
    nextSchedule[staff1.uid][d] = shift2;
    nextSchedule[staff2.uid][d] = shift1;

    return nextSchedule;
}


// ■ スコア計算
function calculateScore(schedule, staffList, calendar, requests) {
    let penalty = 0;
    const numDays = calendar.length;

    // 1. 日別チェック（リーダー要件のみチェック）
    // 人数は generateStrictSchedule と swapVertical で保証されているため計算不要！
    // ただし、リーダーがいるかどうかだけはチェック必要
    for (let d = 0; d < numDays; d++) {
        let leaders = {
            [SHIFT.DAY]: { A: 0, B: 0 },
            [SHIFT.EVE]: 0,
            [SHIFT.NIGHT]: 0
        };

        staffList.forEach(staff => {
            if(staff.originalId === 31) return;
            const shift = schedule[staff.uid][d];
            
            if (staff.leader) {
                if (shift === SHIFT.DAY) leaders[shift][staff.team]++;
                if (shift === SHIFT.EVE) leaders[shift]++;
                if (shift === SHIFT.NIGHT) leaders[shift]++;
            }
        });

        // リーダー不足ペナルティ
        if (leaders[SHIFT.DAY].A < 1) penalty += WEIGHTS.LEADER;
        if (leaders[SHIFT.DAY].B < 1) penalty += WEIGHTS.LEADER;
        if (leaders[SHIFT.EVE] < 1) penalty += WEIGHTS.LEADER;
        if (leaders[SHIFT.NIGHT] < 1) penalty += WEIGHTS.LEADER;
    }

    // 2. 個人別チェック
    staffList.forEach(staff => {
        if(staff.originalId === 31) return;
        const shifts = schedule[staff.uid];
        
        // 希望休
        const reqDates = requests[staff.uid]?.dates || {};
        
        // 夜勤回数カウント
        let nightCount = 0;

        for (let d = 0; d < numDays; d++) {
            const shift = shifts[d];
            const dateStr = calendar[d].dateStr;

            // 希望チェック
            if (reqDates[dateStr]) {
                // 希望があるのに、違うシフトが入っている
                // ※希望が「休」なのにシフトが入ってる、またはその逆
                if (reqDates[dateStr] !== shift) {
                    penalty += WEIGHTS.REQUEST;
                }
            }

            if (shift === SHIFT.EVE || shift === SHIFT.NIGHT) nightCount++;
        }

        // 夜勤回数上限
        if (nightCount > 8) penalty += (nightCount - 8) * WEIGHTS.LIMIT;

        // 並びチェック
        for (let d = 0; d < numDays - 1; d++) {
            const s1 = shifts[d];
            const s2 = shifts[d+1];
            
            // 夜・準 → 日勤 (禁止)
            if ((s1 === SHIFT.NIGHT || s1 === SHIFT.EVE) && s2 === SHIFT.DAY) {
                penalty += WEIGHTS.HARD;
            }

            // 準 → 準以外 (準の次は準か休)
            if (s1 === SHIFT.EVE && s2 !== SHIFT.EVE && s2 !== SHIFT.OFF) {
                penalty += WEIGHTS.PATTERN;
            }
            // 夜 → 夜以外 (夜の次は夜か休)
            if (s1 === SHIFT.NIGHT && s2 !== SHIFT.NIGHT && s2 !== SHIFT.OFF) {
                penalty += WEIGHTS.PATTERN;
            }
            
            // 5連勤以上は罰則
            // (簡易実装: 5日連続で休みなしならペナルティ)
            if (d < numDays - 5) {
                const slice = shifts.slice(d, d+5);
                if (!slice.includes(SHIFT.OFF)) {
                    penalty += WEIGHTS.BALANCE;
                }
            }
        }
    });

    return penalty;
}
