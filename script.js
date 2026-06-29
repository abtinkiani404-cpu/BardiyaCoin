const tg = window.Telegram.WebApp;
tg.expand();
if (tg.ready) tg.ready();

// ----------------------------------------------------
// Core State Management
// ----------------------------------------------------
let state = {
    score: parseInt(localStorage.getItem('b_score')) || 0,
    lifetimeScore: parseInt(localStorage.getItem('b_lifetime')) || 0,
    energy: parseInt(localStorage.getItem('b_energy')),
    totalTaps: parseInt(localStorage.getItem('b_total_taps')) || 0,
    energySpent: parseInt(localStorage.getItem('b_energy_spent')) || 0,
    critsHit: parseInt(localStorage.getItem('b_crits')) || 0,
    offlineEarningsTotal: parseInt(localStorage.getItem('b_offline_total')) || 0,
    cheatWarnings: parseInt(localStorage.getItem('b_warnings')) || 0,
    lastTime: parseInt(localStorage.getItem('b_last_time')) || Date.now(),
    
    // ارتقاهای مهندسی شده و سخت
    upgrades: JSON.parse(localStorage.getItem('b_upgrades')) || {
        multitap: 1,      // ماژول پردازش لمس
        energyCap: 1,     // باتری گرافن
        recharge: 1,      // رآکتور خنک‌کننده
        critChance: 0,    // الگوریتم بلاک بحرانی
        autobot: 0,       // نود پردازشگر آفلاین
        blockchain: 0     // شتاب‌دهنده شبکه (درآمد پسیو در ثانیه)
    },
    
    claimedAchievements: JSON.parse(localStorage.getItem('b_claimed_ach')) || [],
    dailyStreak: parseInt(localStorage.getItem('b_daily_streak')) || 0,
    lastDailyClaim: parseInt(localStorage.getItem('b_last_daily')) || 0
};

if (isNaN(state.energy) || state.energy === null) state.energy = 200;

// کانفیگ اقتصادی (بازی سخت‌تر شده)
const config = { 
    baseMaxEnergy: 200, 
    energyPerLevel: 100, 
    baseRechargeRate: 1, 
    dailyRewards: [200, 500, 1000, 2500, 5000, 10000, 25000] 
};

// ----------------------------------------------------
// Upgrade & Achievement Specs
// ----------------------------------------------------
const upgradeSpecs = {
    multitap: { name: "ماژول پردازش لمس", desc: "افزایش استخراج توکن در هر کلیک", baseCost: 500, mult: 1.8 },
    energyCap: { name: "باتری گرافنی", desc: "افزایش سقف ظرفیت انرژی (+۱۰۰)", baseCost: 800, mult: 1.6 },
    recharge: { name: "رآکتور خنک‌کننده", desc: "افزایش سرعت بازیابی توان در ثانیه", baseCost: 1500, mult: 2.0 },
    critChance: { name: "الگوریتم بلاک بحرانی", desc: "شانس ۵٪ برای ضریب درآمد ۵ برابری کلیک", baseCost: 5000, mult: 3.0 },
    autobot: { name: "نود پردازشگر آفلاین", desc: "استخراج اتوماتیک شبکه هنگام خروج (تا ۳ ساعت)", baseCost: 15000, mult: 4.0 },
    blockchain: { name: "شتاب‌دهنده بلاک‌چین", desc: "تولید توکن ثابت در هر ثانیه به صورت خودکار", baseCost: 25000, mult: 2.5 }
};

function generateAchievements() {
    return [
        { id: 't_1', title: "کارآموز ماینینگ", desc: "ثبت بیش از ۱,۰۰۰ کلیک", type: 'taps', target: 1000, reward: 2000 },
        { id: 't_2', title: "اپراتور شبکه", desc: "ثبت بیش از ۱۰,۰۰۰ کلیک", type: 'taps', target: 10000, reward: 15000 },
        { id: 't_3', title: "خدای انگشتان", desc: "ثبت بیش از ۱۰۰,۰۰۰ کلیک", type: 'taps', target: 100000, reward: 100000 },
        
        { id: 's_1', title: "اولین سرمایه", desc: "کسب مجموع ۱۰,۰۰۰ توکن", type: 'score', target: 10000, reward: 5000 },
        { id: 's_2', title: "نهنگ خرد", desc: "کسب مجموع ۱۰۰,۰۰۰ توکن", type: 'score', target: 100000, reward: 25000 },
        { id: 's_3', title: "رئیس بلاک‌چین", desc: "کسب مجموع ۱,۰۰۰,۰۰۰ توکن", type: 'score', target: 1000000, reward: 200000 },
        
        { id: 'c_1', title: "خوش‌شانس", desc: "ثبت ۵۰ بلاک بحرانی (Crit)", type: 'crits', target: 50, reward: 10000 }
    ];
}
const globalAchievements = generateAchievements();

// ----------------------------------------------------
// UI Elements & Helpers
// ----------------------------------------------------
const scoreEl = document.getElementById('score');
const energyTextEl = document.getElementById('energy-text');
const energyFillEl = document.getElementById('energy-fill');
const coinEl = document.getElementById('coin');
const coinWrapper = document.getElementById('coin-wrapper');
let antiCheat = { tapTimes: [], lastCoords: {x:0, y:0}, sameCoordsCount: 0, locked: false };

if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    document.getElementById('username').innerText = (tg.initDataUnsafe.user.first_name).toUpperCase();
    if (tg.initDataUnsafe.user.photo_url) document.getElementById('user-avatar').src = tg.initDataUnsafe.user.photo_url;
}

function getMaxEnergy() { return config.baseMaxEnergy + ((state.upgrades.energyCap - 1) * config.energyPerLevel); }
function getCoinsPerTap() { return state.upgrades.multitap; }
function getRechargeRate() { return config.baseRechargeRate + (state.upgrades.recharge - 1); }
function getPassiveIncome() { return state.upgrades.blockchain * 2; } // هر لول ۲ سکه در ثانیه
function triggerHaptic(type) { if(tg.HapticFeedback) { if(type==='tap') tg.HapticFeedback.impactOccurred('medium'); if(type==='success') tg.HapticFeedback.notificationOccurred('success'); if(type==='error') tg.HapticFeedback.notificationOccurred('error'); } }

function saveState() {
    state.lastTime = Date.now();
    localStorage.setItem('b_score', state.score);
    localStorage.setItem('b_lifetime', state.lifetimeScore);
    localStorage.setItem('b_energy', state.energy);
    localStorage.setItem('b_total_taps', state.totalTaps);
    localStorage.setItem('b_energy_spent', state.energySpent);
    localStorage.setItem('b_crits', state.critsHit);
    localStorage.setItem('b_offline_total', state.offlineEarningsTotal);
    localStorage.setItem('b_warnings', state.cheatWarnings);
    localStorage.setItem('b_last_time', state.lastTime);
    localStorage.setItem('b_upgrades', JSON.stringify(state.upgrades));
    localStorage.setItem('b_claimed_ach', JSON.stringify(state.claimedAchievements));
    localStorage.setItem('b_daily_streak', state.dailyStreak);
    localStorage.setItem('b_last_daily', state.lastDailyClaim);
}

// ----------------------------------------------------
// Custom In-App Modals
// ----------------------------------------------------
let modalCallback = null;
function showModal(title, desc, iconClass, btnClass, callback = null) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-desc').innerText = desc;
    document.getElementById('modal-icon').className = `fa-solid ${iconClass}`;
    const btn = document.getElementById('modal-btn');
    btn.className = btnClass;
    modalCallback = callback;
    document.getElementById('custom-modal').classList.add('show');
    triggerHaptic(btnClass.includes('danger') ? 'error' : 'success');
}

window.closeModal = function() {
    document.getElementById('custom-modal').classList.remove('show');
    if (modalCallback) modalCallback();
}

// ----------------------------------------------------
// Anti-Cheat Engine (3 Strikes = Reset)
// ----------------------------------------------------
function handleCheatDetection(reason) {
    state.cheatWarnings++;
    saveState();
    antiCheat.locked = true;
    
    if (state.cheatWarnings >= 3) {
        // ریست کامل دیتابیس
        localStorage.clear();
        showModal("حساب مسدود شد", "به دلیل ۳ بار تخلف امنیتی (استفاده از اتوکلیکر یا تغییر ساعت)، تمام اطلاعات، سکه‌ها و ارتقاهای شما برای همیشه پاک شد.", "fa-ban", "modal-btn-danger", () => {
            window.location.reload();
        });
    } else {
        showModal(`اخطار امنیتی (${state.cheatWarnings}/3)`, `${reason}\nدر صورت رسیدن اخطارها به عدد ۳، حساب شما کاملا ریست خواهد شد!`, "fa-triangle-exclamation", "modal-btn-danger", () => {
            antiCheat.locked = false;
            antiCheat.tapTimes = [];
            updateStatsPage();
        });
    }
}

function verifyClick(e) {
    if (!e.isTrusted) { handleCheatDetection("ربات نرم‌افزاری تزریق کلیک شناسایی شد."); return false; }
    
    const now = Date.now();
    antiCheat.tapTimes.push(now);
    antiCheat.tapTimes = antiCheat.tapTimes.filter(t => now - t < 1000);
    // حداکثر ۲۵ کلیک در ثانیه مجاز است
    if (antiCheat.tapTimes.length > 25) {
        handleCheatDetection("سرعت کلیک غیرطبیعی شبکه را مختل کرد.");
        antiCheat.tapTimes = [];
        return false;
    }
    
    // بررسی کلیک دقیق روی یک پیکسل
    if (antiCheat.lastCoords.x === e.clientX && antiCheat.lastCoords.y === e.clientY) {
        antiCheat.sameCoordsCount++;
        if (antiCheat.sameCoordsCount > 15) {
            handleCheatDetection("لمس مکرر و رباتیک یک پیکسل ثابت ردیابی شد.");
            antiCheat.sameCoordsCount = 0;
            return false;
        }
    } else { antiCheat.sameCoordsCount = 0; }
    
    antiCheat.lastCoords = { x: e.clientX, y: e.clientY };
    return true;
}

// ----------------------------------------------------
// Main Mining Logic
// ----------------------------------------------------
function updateUI() {
    const maxE = getMaxEnergy();
    if (state.energy > maxE) state.energy = maxE;
    scoreEl.innerText = state.score.toLocaleString();
    energyTextEl.innerText = `${state.energy} / ${maxE}`;
    energyFillEl.style.width = `${(state.energy / maxE) * 100}%`;
    document.getElementById('lb-user-score').innerHTML = `${state.score.toLocaleString()} <i class="fa-solid fa-coins"></i>`;
}

coinEl.addEventListener('pointerdown', (e) => {
    if (antiCheat.locked) return;
    if (state.energy <= 0) { triggerHaptic('error'); return; }
    if (!verifyClick(e)) return;
    
    let clickPower = getCoinsPerTap();
    let isCrit = false;
    if (state.upgrades.critChance > 0 && Math.random() < 0.05) {
        clickPower *= 5;
        isCrit = true;
        state.critsHit++;
    }
    
    state.score += clickPower;
    state.lifetimeScore += clickPower;
    state.energy -= 1;
    state.totalTaps += 1;
    state.energySpent += 1;
    
    triggerHaptic('tap');
    
    const rect = coinEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const pop = document.createElement('div');
    pop.classList.add('floating-number');
    pop.innerText = `+${clickPower}`;
    if(isCrit) { pop.style.color = 'var(--neon-cyan)'; pop.style.fontSize = '2.6rem'; pop.innerText += "!"; }
    pop.style.left = `${x - 10}px`; pop.style.top = `${y - 20}px`;
    coinWrapper.appendChild(pop);
    setTimeout(() => pop.remove(), 500);
    
    updateUI();
});

// ----------------------------------------------------
// Navigation & Sections Rendering
// ----------------------------------------------------
const navNodes = document.querySelectorAll('.nav-node');
const appTabs = document.querySelectorAll('.app-tab');

navNodes.forEach(node => {
    node.addEventListener('click', () => {
        if (antiCheat.locked) return;
        navNodes.forEach(n => n.classList.remove('active'));
        appTabs.forEach(t => t.classList.remove('active'));
        node.classList.add('active');
        const target = node.getAttribute('data-tab');
        document.getElementById(target).classList.add('active');
        triggerHaptic('tap');
        
        if(target === 'tab-upgrades') renderUpgrades();
        if(target === 'tab-achievements') { renderDaily(); renderAchievements(); }
        if(target === 'tab-stats') updateStatsPage();
    });
});

function updateStatsPage() {
    document.getElementById('stat-total-taps').innerText = state.totalTaps.toLocaleString();
    document.getElementById('stat-lifetime-score').innerText = state.lifetimeScore.toLocaleString();
    document.getElementById('stat-offline-earnings').innerText = state.offlineEarningsTotal.toLocaleString();
    document.getElementById('stat-crits').innerText = state.critsHit.toLocaleString();
    document.getElementById('stat-energy-spent').innerText = state.energySpent.toLocaleString();
    document.getElementById('stat-total-upgrades').innerText = Object.values(state.upgrades).reduce((a,b)=>a+b, 0) - Object.keys(state.upgrades).length;
    
    const wEl = document.getElementById('stat-warnings');
    wEl.innerText = `${state.cheatWarnings} / 3`;
    const sEl = document.getElementById('stat-cheat-status');
    if(state.cheatWarnings === 0) { sEl.innerText = "ایمن و پاک"; sEl.className = "text-green"; wEl.className = "stat-val text-green"; }
    else if(state.cheatWarnings === 1) { sEl.innerText = "مشکوک"; sEl.className = "text-gold"; wEl.className = "stat-val text-gold"; wEl.style.color = "#fbbf24"; }
    else { sEl.innerText = "خطر تعلیق اکانت!"; sEl.className = "text-red"; wEl.className = "stat-val text-red"; }
}

function renderUpgrades() {
    const container = document.getElementById('upgrades-container');
    container.innerHTML = '';
    Object.keys(upgradeSpecs).forEach(key => {
        const spec = upgradeSpecs[key];
        const lvl = state.upgrades[key];
        const cost = Math.floor(spec.baseCost * Math.pow(spec.mult, lvl - 1));
        const maxReached = (key === 'critChance' || key === 'autobot') && lvl >= 1;
        
        container.innerHTML += `
            <div class="pro-card-item">
                <div class="card-info">
                    <h4>${spec.name} <span class="lvl-badge">LVL ${lvl}</span></h4>
                    <p>${spec.desc}</p>
                    <div class="card-price">${maxReached ? 'حداکثر ارتقا' : `<i class="fa-solid fa-coins"></i> ${cost.toLocaleString()}`}</div>
                </div>
                <button class="btn-action" ${state.score < cost || maxReached ? 'disabled' : ''} onclick="buyUpgrade('${key}', ${cost})">
                    ${maxReached ? '<i class="fa-solid fa-lock"></i> MAX' : 'ارتقا'}
                </button>
            </div>
        `;
    });
}

window.buyUpgrade = function(key, cost) {
    if (state.score >= cost) {
        state.score -= cost;
        state.upgrades[key]++;
        triggerHaptic('success');
        saveState(); updateUI(); renderUpgrades();
    }
}

function renderDaily() {
    const grid = document.getElementById('daily-grid');
    const claimBtn = document.getElementById('claim-daily-btn');
    grid.innerHTML = '';
    const now = Date.now();
    const canClaim = now - state.lastDailyClaim >= 86400000; // 24h
    if (now - state.lastDailyClaim > 172800000 && state.lastDailyClaim !== 0) state.dailyStreak = 0; // Reset after 48h
    
    for (let i = 0; i < 7; i++) {
        let cls = 'daily-day-box';
        if (i < state.dailyStreak) cls += ' claimed';
        if (i === state.dailyStreak && canClaim) cls += ' active';
        grid.innerHTML += `<div class="${cls}"><div>روز ${i+1}</div><div style="color:var(--gold);font-weight:bold;margin-top:4px;">+${config.dailyRewards[i]}</div></div>`;
    }
    
    if (canClaim) {
        claimBtn.disabled = false; claimBtn.className = 'action-btn-wide ready';
        claimBtn.innerHTML = `<i class="fa-solid fa-gift"></i> دریافت قرارداد روزانه`;
        claimBtn.onclick = () => {
            const rew = config.dailyRewards[state.dailyStreak];
            state.score += rew; state.lifetimeScore += rew;
            state.lastDailyClaim = Date.now();
            state.dailyStreak = (state.dailyStreak + 1) % 7;
            triggerHaptic('success'); saveState(); updateUI(); renderDaily();
            showModal("قرارداد تایید شد", `مبلغ ${rew.toLocaleString()} توکن به حساب شما واریز شد. فردا مجددا سر بزنید!`, "fa-check-circle", "modal-btn-primary");
        };
    } else {
        claimBtn.disabled = true; claimBtn.className = 'action-btn-wide';
        updateTimerLoop(); // Start visual timer update
    }
}

function renderAchievements() {
    const container = document.getElementById('achievements-container');
    container.innerHTML = '';
    let rendered = false;
    
    globalAchievements.forEach(ach => {
        if (state.claimedAchievements.includes(ach.id)) return;
        rendered = true;
        let progress = 0;
        if(ach.type === 'taps') progress = state.totalTaps;
        if(ach.type === 'score') progress = state.lifetimeScore;
        if(ach.type === 'crits') progress = state.critsHit;
        
        const isDone = progress >= ach.target;
        const icon = isDone ? `<div class="ach-icon ready"><i class="fa-solid fa-gift"></i></div>` : `<div class="ach-icon locked"><i class="fa-solid fa-lock"></i></div>`;
        
        container.innerHTML += `
            <div class="pro-card-item">
                ${icon}
                <div class="card-info" style="margin-right:10px;">
                    <h4 style="font-size:12px;">${ach.title}</h4>
                    <p>${ach.desc}</p>
                    <div class="card-price" style="color:var(--success);">+${ach.reward.toLocaleString()} B-COIN</div>
                </div>
                <button class="btn-action" ${!isDone ? 'disabled' : ''} onclick="claimAch('${ach.id}', ${ach.reward})">
                    ${isDone ? 'دریافت' : `${Math.min(100, Math.floor((progress/ach.target)*100))}%`}
                </button>
            </div>
        `;
    });
    
    if(!rendered) container.innerHTML = `<div style="text-align:center; padding: 20px; color:var(--success);"><i class="fa-solid fa-check-double" style="font-size:30px; margin-bottom:10px;"></i><p>همه قراردادها تکمیل شده است!</p></div>`;
}

window.claimAch = function(id, reward) {
    state.score += reward; state.lifetimeScore += reward;
    state.claimedAchievements.push(id);
    triggerHaptic('success'); saveState(); updateUI(); renderAchievements();
}

// ----------------------------------------------------
// System Loops (Offline, Timer, Listing)
// ----------------------------------------------------
function processOfflineMining() {
    const now = Date.now();
    if (state.upgrades.autobot > 0 && state.lastTime) {
        const elap = Math.floor((now - state.lastTime) / 1000);
        if (elap > 60) {
            const capped = Math.min(elap, 3 * 60 * 60); // Max 3 hours
            const earned = Math.floor(capped * 0.5 * getCoinsPerTap());
            if (earned > 0) {
                state.score += earned; state.lifetimeScore += earned; state.offlineEarningsTotal += earned;
                showModal("گزارش نود آفلاین", `ربات پردازشگر آفلاین شما در زمان عدم حضور، موفق به استخراج ${earned.toLocaleString()} توکن شد!`, "fa-robot", "modal-btn-primary");
            }
        }
    }
}

function updateTimerLoop() {
    const btn = document.getElementById('claim-daily-btn');
    if(!btn || !btn.disabled) return;
    const tl = (state.lastDailyClaim + 86400000) - Date.now();
    if (tl <= 0) { renderDaily(); return; }
    const h = Math.floor(tl / 3600000).toString().padStart(2,'0');
    const m = Math.floor((tl % 3600000) / 60000).toString().padStart(2,'0');
    const s = Math.floor((tl % 60000) / 1000).toString().padStart(2,'0');
    btn.innerHTML = `<i class="fa-solid fa-clock"></i> در دسترس تا: ${h}:${m}:${s}`;
}

// حلقه ۱ ثانیه ای
setInterval(() => {
    if (antiCheat.locked) return;
    const now = Date.now();
    
    // محافظت در برابر دستکاری زمان گوشی
    if (now < state.lastTime - 2000) { handleCheatDetection("سیستم متوجه تغییر زمان دستگاه شما شد."); return; }
    
    // شارژ انرژی
    const maxE = getMaxEnergy();
    if (state.energy < maxE) { state.energy += getRechargeRate(); if(state.energy > maxE) state.energy = maxE; updateUI(); }
    
    // درآمد پسیو (بلاک‌چین)
    const passive = getPassiveIncome();
    if (passive > 0) { state.score += passive; state.lifetimeScore += passive; updateUI(); }
    
    updateTimerLoop();
    
    // شمارش معکوس لیستینگ (۱۴ تیر ۱۴۰۵ = 5 Jul 2026)
    const targetDate = new Date("2026-07-05T00:00:00Z").getTime();
    const diff = targetDate - now;
    if (diff > 0) {
        document.getElementById('cd-d').innerText = Math.floor(diff / 86400000).toString().padStart(2,'0');
        document.getElementById('cd-h').innerText = Math.floor((diff % 86400000) / 3600000).toString().padStart(2,'0');
        document.getElementById('cd-m').innerText = Math.floor((diff % 3600000) / 60000).toString().padStart(2,'0');
        document.getElementById('cd-s').innerText = Math.floor((diff % 60000) / 1000).toString().padStart(2,'0');
    }
    
    saveState();
}, 1000);

processOfflineMining();
updateUI();
