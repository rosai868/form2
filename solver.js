const SHIFT = {
    DAY: '日',
    EVE: '準',
    NIGHT: '夜',
    OFF: '休',
    LEAVE: '年',
    TRIP: '出',
    SUMMER: '夏',
    AM: 'AM',
    PM: 'PM',
    SP: '特'
};

const WEIGHTS = {
    HARD: 100000,
    REQUEST: 5000,
    LIMIT: 2000,
    PATTERN: 500,
    INTERVAL: 1000,
    BALANCE: 100
};

self.onmessage = function(e) {
    const { staffList, requestList, year, month } = e.data;
    const daysInMonth = new Date(year, month, 0).getDate();
    const calendar = createCalendar(year, month, daysInMonth);

    let schedule = generateInitialSchedule(staffList, calendar, requestList);
    let currentScore = calculateScore(schedule, staffList, calendar, requestList);
    
    let bestSchedule = JSON.parse(JSON.stringify(schedule));
    let bestScore = currentScore;

    const MAX_ITERATIONS = 100000; 

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        const neighbor = swapRandomShifts(schedule, staffList, calendar);
        const newScore = calculateScore(neighbor, staffList, calendar, requestList);

        if (newScore <= currentScore) {
            schedule = neighbor;
            currentScore = newScore;

            if (newScore < bestScore) {
                bestSchedule = JSON.parse(JSON.stringify(neighbor));
                bestScore = newScore;
            }
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

function createCalendar(year, month, days) {
    const calendar = [];
    const holidays = {
        '2025-01-01': true, '2025-01-13': true, '2025-02-11': true, 
        '2025-02-23': true, '2025-02-24': true, '2025-03-20': true,
        '2025-04-29': true, '2025-05-03': true, '2025-05-04': true,
        '2025-05-05': true, '2025-05-06': true
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

function generateInitialSchedule(staffList, calendar, requests) {
    const schedule = {};

    staffList.forEach(staff => {
        if(staff.originalId === 31) return;

        schedule[staff.uid] = [];
        
        const isFixedDayOnly = ['長坂', '中里', '長田'].some(n => staff.name.includes(n));
        const isShirai = staff.name.includes('白井');

        calendar.forEach(day => {
            const staffReq = requests[staff.uid]?.dates || {};
            const reqShift = staffReq[day.dateStr];

            if (reqShift) {
                schedule[staff.uid].push(reqShift);
                return;
            }

            if (isFixedDayOnly) {
                schedule[staff.uid].push(day.isHoliday ? SHIFT.OFF : SHIFT.DAY);
                return;
            }
            if (isShirai) {
                schedule[staff.uid].push(Math.random() > 0.3 ? SHIFT.DAY : SHIFT.OFF);
                return;
            }

            const shifts = [SHIFT.DAY, SHIFT.EVE, SHIFT.NIGHT, SHIFT.OFF];
            schedule[staff.uid].push(shifts[Math.floor(Math.random() * shifts.length)]);
        });
    });
    return schedule;
}

function swapRandomShifts(currentSchedule, staffList, calendar) {
    const nextSchedule = JSON.parse(JSON.stringify(currentSchedule));
    
    const availableStaff = staffList.filter(s => 
        s.originalId !== 31 && 
        !['長坂', '中里', '長田'].some(n => s.name.includes(n))
    );
    if (availableStaff.length === 0) return nextSchedule;

    const targetStaff = availableStaff[Math.floor(Math.random() * availableStaff.length)];
    const shifts = nextSchedule[targetStaff.uid];
    
    const d1 = Math.floor(Math.random() * shifts.length);
    const d2 = Math.floor(Math.random() * shifts.length);

    if (targetStaff.name.includes('白井')) {
        shifts[d1] = Math.random() > 0.3 ? SHIFT.DAY : SHIFT.OFF;
        shifts[d2] = Math.random() > 0.3 ? SHIFT.DAY : SHIFT.OFF;
    } else {
        [shifts[d1], shifts[d2]] = [shifts[d2], shifts[d1]];
    }

    return nextSchedule;
}

function calculateScore(schedule, staffList, calendar, requests) {
    let penalty = 0;
    const numDays = calendar.length;

    for (let d = 0; d < numDays; d++) {
        const dayInfo = calendar[d];
        let count = {
            [SHIFT.DAY]: { A: 0, B: 0, L_A: 0, L_B: 0, Total: 0 },
            [SHIFT.EVE]: { A: 0, B: 0, L_Total: 0, Total: 0 },
            [SHIFT.NIGHT]: { A: 0, B: 0, L_Total: 0, Total: 0 }
        };

        staffList.forEach(staff => {
            if(staff.originalId === 31) return;
            const shift = schedule[staff.uid][d];
            
            if ([SHIFT.DAY, SHIFT.EVE, SHIFT.NIGHT].includes(shift)) {
                count[shift].Total++;
                if (staff.team === 'A') count[shift].A++;
                if (staff.team === 'B') count[shift].B++;
                
                if (staff.leader) {
                    count[shift].L_Total++;
                    if (staff.team === 'A') count[shift].L_A++;
                    if (staff.team === 'B') count[shift].L_B++;
                }
            }
        });

        if (!dayInfo.isHoliday) {
            if (count[SHIFT.DAY].A !== 6) penalty += WEIGHTS.HARD;
            if (count[SHIFT.DAY].B !== 6) penalty += WEIGHTS.HARD;
            if (count[SHIFT.DAY].L_A < 1) penalty += WEIGHTS.HARD;
            if (count[SHIFT.DAY].L_B < 1) penalty += WEIGHTS.HARD;
        } 
        else {
            if (count[SHIFT.DAY].Total !== 5) penalty += WEIGHTS.HARD;
            const diff = Math.abs(count[SHIFT.DAY].A - count[SHIFT.DAY].B); 
            if (diff !== 1) penalty += WEIGHTS.HARD; 
            if (count[SHIFT.DAY].L_A < 1) penalty += WEIGHTS.HARD;
            if (count[SHIFT.DAY].L_B < 1) penalty += WEIGHTS.HARD;
        }

        [SHIFT.EVE, SHIFT.NIGHT].forEach(s => {
            if (count[s].Total !== 3) penalty += WEIGHTS.HARD;
            const diff = Math.abs(count[s].A - count[s].B);
            if (diff !== 1) penalty += WEIGHTS.HARD; 
            if (count[s].L_Total < 1) penalty += WEIGHTS.HARD;
        });
    }

    staffList.forEach(staff => {
        if(staff.originalId === 31) return;
        const shifts = schedule[staff.uid];
        
        const reqDates = requests[staff.uid]?.dates || {};
        calendar.forEach((day, idx) => {
            if (reqDates[day.dateStr] && reqDates[day.dateStr] !== shifts[idx]) {
                penalty += WEIGHTS.REQUEST;
            }
        });

        const nightCount = shifts.filter(s => s === SHIFT.EVE || s === SHIFT.NIGHT).length;
        if (nightCount > 8) penalty += (nightCount - 8) * WEIGHTS.LIMIT;

        for (let i = 0; i < numDays - 1; i++) {
            const s1 = shifts[i];
            const s2 = shifts[i+1];
            
            if ((s1 === SHIFT.NIGHT || s1 === SHIFT.EVE) && s2 === SHIFT.DAY) {
                penalty += WEIGHTS.HARD;
            }

            if (s1 === SHIFT.EVE && ![SHIFT.EVE, SHIFT.OFF].includes(s2)) penalty += WEIGHTS.PATTERN;
            if (s1 === SHIFT.NIGHT && ![SHIFT.NIGHT, SHIFT.OFF].includes(s2)) penalty += WEIGHTS.PATTERN;
        }
    });

    return penalty;
}
