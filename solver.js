{\rtf1\ansi\ansicpg932\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 // solver.js (\uc0\u20445 \u23384 \u21517 )\
\
// \uc0\u9632  \u35373 \u23450 \u12539 \u23450 \u25968 \
const SHIFT = \{\
    DAY: '\uc0\u26085 ',\
    EVE: '\uc0\u28310 ',\
    NIGHT: '\uc0\u22812 ',\
    OFF: '\uc0\u20241 ',\
    LEAVE: '\uc0\u24180 ',\
    TRIP: '\uc0\u20986 ',\
    SUMMER: '\uc0\u22799 ',\
    AM: 'AM',\
    PM: 'PM',\
    SP: '\uc0\u29305 '\
\};\
\
// \uc0\u21046 \u32004 \u12398 \u37325 \u12415 \u65288 \u12506 \u12490 \u12523 \u12486 \u12451 \u28857 \u25968 \u65289 \
const WEIGHTS = \{\
    HARD: 100000,   // \uc0\u32118 \u23550 \u31105 \u27490 \u65288 \u20154 \u25968 \u19981 \u36275 \u12289 \u22266 \u23450 \u21220 \u21209 \u36949 \u21453 \u65289 \
    REQUEST: 5000,  // \uc0\u24076 \u26395 \u28961 \u35222 \
    LIMIT: 2000,    // \uc0\u22812 \u21220 \u22238 \u25968 \u12458 \u12540 \u12496 \u12540 (8\u22238 \u36229 )\
    PATTERN: 500,   // \uc0\u12471 \u12501 \u12488 \u20006 \u12403 \u12398 \u24746 \u12373 \
    INTERVAL: 1000, // \uc0\u28145 \u22812 \u12392 \u28145 \u22812 \u12398 \u38291 \u38548 \u19981 \u36275 \
    BALANCE: 100    // \uc0\u12481 \u12540 \u12512 \u12496 \u12521 \u12531 \u12473 \u12289 \u24179 \u31561 \u24615 \
\};\
\
// \uc0\u9632  \u12513 \u12452 \u12531 \u20966 \u29702 \
self.onmessage = function(e) \{\
    const \{ staffList, requestList, year, month \} = e.data;\
    const daysInMonth = new Date(year, month, 0).getDate();\
    const calendar = createCalendar(year, month, daysInMonth);\
\
    // 1. \uc0\u21021 \u26399 \u35299 \u29983 \u25104 \
    let schedule = generateInitialSchedule(staffList, calendar, requestList);\
    let currentScore = calculateScore(schedule, staffList, calendar, requestList);\
    \
    let bestSchedule = JSON.parse(JSON.stringify(schedule));\
    let bestScore = currentScore;\
\
    // 2. \uc0\u26368 \u36969 \u21270 \u12523 \u12540 \u12503 \u65288 \u22238 \u25968 \u12399 PC\u24615 \u33021 \u12395 \u21512 \u12431 \u12379 \u12390 \u22679 \u12420 \u12375 \u12390 OK\u65289 \
    const MAX_ITERATIONS = 100000; \
\
    for (let i = 0; i < MAX_ITERATIONS; i++) \{\
        // \uc0\u12521 \u12531 \u12480 \u12512 \u22793 \u26356 \
        const neighbor = swapRandomShifts(schedule, staffList, calendar);\
        const newScore = calculateScore(neighbor, staffList, calendar, requestList);\
\
        // \uc0\u12473 \u12467 \u12450 \u12364 \u33391 \u12367 \u12394 \u12428 \u12400 \u25505 \u29992 \u65288 \u12414 \u12383 \u12399 \u21516 \u12376 \u12473 \u12467 \u12450 \u12391 \u12418 \u30906 \u29575 \u12391 \u25505 \u29992 \u12375 \u12390 \u20572 \u28382 \u12434 \u38450 \u12368 \u65289 \
        if (newScore <= currentScore) \{\
            schedule = neighbor;\
            currentScore = newScore;\
\
            if (newScore < bestScore) \{\
                bestSchedule = JSON.parse(JSON.stringify(neighbor));\
                bestScore = newScore;\
            \}\
        \} else \{\
            // \uc0\u28988 \u12365 \u12394 \u12414 \u12375 \u27861 \u65288 \u30906 \u29575 \u30340 \u12395 \u24746 \u12356 \u25163 \u12418 \u35377 \u23481 \u12377 \u12427 \u65289 \u12434 \u23566 \u20837 \u12377 \u12427 \u12392 \u12424 \u12426 \u33391 \u12356 \u12391 \u12377 \u12364 \u12289 \
            // \uc0\u12414 \u12378 \u12399 \u21336 \u32020 \u12394 \u23665 \u30331 \u12426 \u27861 \u12391 \u23455 \u35013 \u12375 \u12414 \u12377 \
        \}\
\
        // 1000\uc0\u22238 \u12372 \u12392 \u12395 \u36914 \u25431 \u36865 \u20449 \
        if (i % 1000 === 0) \{\
            self.postMessage(\{ \
                type: 'progress', \
                iteration: i, \
                max: MAX_ITERATIONS, \
                score: bestScore \
            \});\
        \}\
\
        if (bestScore === 0) break;\
    \}\
\
    self.postMessage(\{ type: 'done', schedule: bestSchedule, score: bestScore \});\
\};\
\
// \uc0\u12459 \u12524 \u12531 \u12480 \u12540 \u29983 \u25104 \
function createCalendar(year, month, days) \{\
    const calendar = [];\
    // \uc0\u31069 \u26085 \u12522 \u12473 \u12488 \u65288 \u31777 \u26131 \u29256 \u65306 \u24517 \u35201 \u12395 \u24540 \u12376 \u12390 \u36861 \u21152 \u12375 \u12390 \u12367 \u12384 \u12373 \u12356 \u65289 \
    const holidays = \{\
        '2025-01-01': true, '2025-01-13': true, '2025-02-11': true, \
        '2025-02-23': true, '2025-02-24': true, '2025-03-20': true,\
        '2025-04-29': true, '2025-05-03': true, '2025-05-04': true,\
        '2025-05-05': true, '2025-05-06': true\
    \};\
\
    for (let d = 1; d <= days; d++) \{\
        const dateObj = new Date(year, month - 1, d);\
        const dateStr = `$\{year\}-$\{String(month).padStart(2, '0')\}-$\{String(d).padStart(2, '0')\}`;\
        const dayOfWeek = dateObj.getDay(); // 0:\uc0\u26085 \
        const isHoliday = (dayOfWeek === 0 || dayOfWeek === 6 || holidays[dateStr]);\
        calendar.push(\{ date: d, dateStr, dayOfWeek, isHoliday \}); \
    \}\
    return calendar;\
\}\
\
// \uc0\u21021 \u26399 \u35299 \u29983 \u25104 \
function generateInitialSchedule(staffList, calendar, requests) \{\
    const schedule = \{\};\
\
    staffList.forEach(staff => \{\
        // 31\uc0\u30058 \u12399 \u38500 \u22806 \
        if(staff.originalId === 31) return;\
\
        schedule[staff.uid] = [];\
        \
        // \uc0\u22266 \u23450 \u21220 \u21209 \u32773 \u12398 \u21028 \u23450 \
        const isFixedDayOnly = ['\uc0\u38263 \u22338 ', '\u20013 \u37324 ', '\u38263 \u30000 '].some(n => staff.name.includes(n));\
        const isShirai = staff.name.includes('\uc0\u30333 \u20117 ');\
\
        calendar.forEach(day => \{\
            // \uc0\u12377 \u12391 \u12395 \u24076 \u26395 \u12364 \u12354 \u12427 \u12363 \u65311 \
            const staffReq = requests[staff.uid]?.dates || \{\};\
            const reqShift = staffReq[day.dateStr];\
\
            if (reqShift) \{\
                schedule[staff.uid].push(reqShift);\
                return;\
            \}\
\
            // \uc0\u22266 \u23450 \u21220 \u21209 \u12398 \u12525 \u12472 \u12483 \u12463 \
            if (isFixedDayOnly) \{\
                // \uc0\u38263 \u22338 \u12539 \u20013 \u37324 \u12539 \u38263 \u30000 \u65306 \u24179 \u26085 \u26085 \u21220 \u12289 \u22303 \u26085 \u20241 \u12415 \
                schedule[staff.uid].push(day.isHoliday ? SHIFT.OFF : SHIFT.DAY);\
                return;\
            \}\
            if (isShirai) \{\
                // \uc0\u30333 \u20117 \u65306 \u26085 \u21220 \u12398 \u12415 \u65288 \u22303 \u26085 \u12418 \u21487 \u65289 \u8594  \u12521 \u12531 \u12480 \u12512 \u12391 \u26085 \u21220 \u12363 \u20241 \u12415 \
                schedule[staff.uid].push(Math.random() > 0.3 ? SHIFT.DAY : SHIFT.OFF);\
                return;\
            \}\
\
            // \uc0\u12381 \u12398 \u20182 \u12398 \u12473 \u12479 \u12483 \u12501 \u65306 \u12521 \u12531 \u12480 \u12512 \
            const shifts = [SHIFT.DAY, SHIFT.EVE, SHIFT.NIGHT, SHIFT.OFF];\
            schedule[staff.uid].push(shifts[Math.floor(Math.random() * shifts.length)]);\
        \});\
    \});\
    return schedule;\
\}\
\
// \uc0\u12473 \u12527 \u12483 \u12503 \u20966 \u29702 \
function swapRandomShifts(currentSchedule, staffList, calendar) \{\
    const nextSchedule = JSON.parse(JSON.stringify(currentSchedule));\
    \
    // \uc0\u22793 \u26356 \u23550 \u35937 \u12398 \u12473 \u12479 \u12483 \u12501 \u12434 \u36984 \u12406 \u65288 \u22266 \u23450 \u21220 \u21209 \u32773 \u12399 \u38500 \u22806 \u65289 \
    const availableStaff = staffList.filter(s => \
        s.originalId !== 31 && \
        !['\uc0\u38263 \u22338 ', '\u20013 \u37324 ', '\u38263 \u30000 '].some(n => s.name.includes(n))\
    );\
    if (availableStaff.length === 0) return nextSchedule;\
\
    const targetStaff = availableStaff[Math.floor(Math.random() * availableStaff.length)];\
    const shifts = nextSchedule[targetStaff.uid];\
    \
    // 2\uc0\u12388 \u12398 \u26085 \u20184 \u12434 \u36984 \u12435 \u12391 \u20837 \u12428 \u26367 \u12360 \
    const d1 = Math.floor(Math.random() * shifts.length);\
    const d2 = Math.floor(Math.random() * shifts.length);\
\
    // \uc0\u30333 \u20117 \u12373 \u12435 \u12399 \u12300 \u28310 \u12301 \u12300 \u22812 \u12301 \u12364 \u20837 \u12425 \u12394 \u12356 \u12424 \u12358 \u12395 \u12460 \u12540 \u12489 \
    if (targetStaff.name.includes('\uc0\u30333 \u20117 ')) \{\
        // \uc0\u30333 \u20117 \u12373 \u12435 \u12399  \u26085 \u8660 \u20241  \u12398 \u12415 \u20837 \u12428 \u26367 \u12360 OK\u12290 \u12381 \u12428 \u20197 \u22806 \u12364 \u20837 \u12387 \u12390 \u12375 \u12414 \u12387 \u12383 \u12425 \u24375 \u21046 \u20462 \u27491 \
        // \uc0\u65288 \u31777 \u26131 \u23455 \u35013 \u12392 \u12375 \u12390 \u12289 \u24375 \u21046 \u30340 \u12395 \u26085 \u12363 \u20241 \u12395 \u12377 \u12427 \u65289 \
        shifts[d1] = Math.random() > 0.3 ? SHIFT.DAY : SHIFT.OFF;\
        shifts[d2] = Math.random() > 0.3 ? SHIFT.DAY : SHIFT.OFF;\
    \} else \{\
        // \uc0\u36890 \u24120 \u12398 \u20837 \u12428 \u26367 \u12360 \
        [shifts[d1], shifts[d2]] = [shifts[d2], shifts[d1]];\
    \}\
\
    return nextSchedule;\
\}\
\
// \uc0\u9733 \u12473 \u12467 \u12450 \u35336 \u31639 \u65288 \u12371 \u12371 \u12364 \u24515 \u33235 \u37096 \u65289 \
function calculateScore(schedule, staffList, calendar, requests) \{\
    let penalty = 0;\
    const numDays = calendar.length;\
\
    // --- 1. \uc0\u26085 \u27598 \u12398 \u20154 \u25968 \u12481 \u12455 \u12483 \u12463  ---\
    for (let d = 0; d < numDays; d++) \{\
        const dayInfo = calendar[d];\
        let count = \{\
            [SHIFT.DAY]: \{ A: 0, B: 0, L_A: 0, L_B: 0, Total: 0 \},\
            [SHIFT.EVE]: \{ A: 0, B: 0, L_Total: 0, Total: 0 \},\
            [SHIFT.NIGHT]: \{ A: 0, B: 0, L_Total: 0, Total: 0 \}\
        \};\
\
        staffList.forEach(staff => \{\
            if(staff.originalId === 31) return;\
            const shift = schedule[staff.uid][d];\
            \
            if ([SHIFT.DAY, SHIFT.EVE, SHIFT.NIGHT].includes(shift)) \{\
                count[shift].Total++;\
                if (staff.team === 'A') count[shift].A++;\
                if (staff.team === 'B') count[shift].B++;\
                \
                if (staff.leader) \{\
                    count[shift].L_Total++;\
                    if (staff.team === 'A') count[shift].L_A++;\
                    if (staff.team === 'B') count[shift].L_B++;\
                \}\
            \}\
        \});\
\
        // \uc0\u24179 \u26085 \u12398 \u26085 \u21220 : 12\u20154  (A6, B6), \u12522 \u12540 \u12480 \u12540 \u21508 1\u20197 \u19978 \
        if (!dayInfo.isHoliday) \{\
            if (count[SHIFT.DAY].A !== 6) penalty += WEIGHTS.HARD;\
            if (count[SHIFT.DAY].B !== 6) penalty += WEIGHTS.HARD;\
            if (count[SHIFT.DAY].L_A < 1) penalty += WEIGHTS.HARD;\
            if (count[SHIFT.DAY].L_B < 1) penalty += WEIGHTS.HARD;\
        \} \
        // \uc0\u20241 \u26085 \u12398 \u26085 \u21220 : 5\u20154  (A3+B2 or A2+B3), \u12522 \u12540 \u12480 \u12540 \u21508 1\u20197 \u19978 \
        else \{\
            if (count[SHIFT.DAY].Total !== 5) penalty += WEIGHTS.HARD;\
            const diff = Math.abs(count[SHIFT.DAY].A - count[SHIFT.DAY].B); // \uc0\u24046 \u12399 1\u12391 \u12354 \u12427 \u12409 \u12365 (3-2=1)\
            if (diff !== 1) penalty += WEIGHTS.HARD; \
            if (count[SHIFT.DAY].L_A < 1) penalty += WEIGHTS.HARD;\
            if (count[SHIFT.DAY].L_B < 1) penalty += WEIGHTS.HARD;\
        \}\
\
        // \uc0\u28310 \u22812 \u12539 \u22812 \u21220 : 3\u20154  (A2+B1 or A1+B2), \u12522 \u12540 \u12480 \u12540 1\u20197 \u19978 \
        [SHIFT.EVE, SHIFT.NIGHT].forEach(s => \{\
            if (count[s].Total !== 3) penalty += WEIGHTS.HARD;\
            const diff = Math.abs(count[s].A - count[s].B);\
            if (diff !== 1) penalty += WEIGHTS.HARD; \
            if (count[s].L_Total < 1) penalty += WEIGHTS.HARD;\
        \});\
    \}\
\
    // --- 2. \uc0\u12473 \u12479 \u12483 \u12501 \u20491 \u20154 \u21029 \u12481 \u12455 \u12483 \u12463  ---\
    staffList.forEach(staff => \{\
        if(staff.originalId === 31) return;\
        const shifts = schedule[staff.uid];\
        \
        // \uc0\u24076 \u26395 \u20241 \u12481 \u12455 \u12483 \u12463 \
        const reqDates = requests[staff.uid]?.dates || \{\};\
        calendar.forEach((day, idx) => \{\
            if (reqDates[day.dateStr] && reqDates[day.dateStr] !== shifts[idx]) \{\
                penalty += WEIGHTS.REQUEST;\
            \}\
        \});\
\
        // \uc0\u22812 \u21220 \u22238 \u25968 \u65288 \u28310 +\u22812  <= 8\u65289 \
        const nightCount = shifts.filter(s => s === SHIFT.EVE || s === SHIFT.NIGHT).length;\
        if (nightCount > 8) penalty += (nightCount - 8) * WEIGHTS.LIMIT;\
\
        // \uc0\u12471 \u12501 \u12488 \u20006 \u12403 \
        for (let i = 0; i < numDays - 1; i++) \{\
            const s1 = shifts[i];\
            const s2 = shifts[i+1];\
            const s3 = shifts[i+2] || '';}