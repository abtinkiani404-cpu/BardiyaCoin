const tg = window.Telegram.WebApp;
tg.expand();
if (tg.ready) tg.ready();

// -------------------------
// مدیریت اطلاعات بازی
// -------------------------
let state = {
    score: parseInt(localStorage.getItem('bc_score')) || 0,
    lifetimeScore: parseInt(localStorage.getItem('bc_lifetime')) || 0,
    energy: parseInt(localStorage.getItem('bc_energy')),
    totalTaps: parseInt(localStorage.getItem('bc_total_taps')) || 0,
    critsHit: parseInt(localStorage.getItem('bc_crits')) || 0,
    offlineEarnings: parseInt(localStorage.getItem('bc_offline')) || 0,
    warnings: parseInt(localStorage.getItem('bc_warnings')) || 0,
    lastTime: parseInt(localStorage.getItem('bc_last_time')) || Date.now(),
    
    // ارتقاها (اقتصاد سخت‌تر)
    upgrades: JSON.parse(localStorage.getItem('bc_upgrades')) || {
        multitap: 1,
        energyCap: 1,
        recharge: 1,
        critChance: 0,
        autobot: 0
    },
    
    claimedAchs: JSON.parse(localStorage.getItem('bc_claimed_ach')) || [],
    dailyStreak: parseInt(localStorage.getItem('bc_daily_streak')) || 0,
    lastDailyClaim: parseInt(localStorage.getItem('bc_last_daily')) || 0
};

if (isNaN(state.energy) || state.energy === null) state.energy = 200;

// کانفیگ 
const config = { 
    baseMaxEnergy: 200, 
    energyPerLevel: 100, 
    baseRechargeRate: 1, 
    dailyRewards: [100, 500, 1000, 2000, 5000, 10000, 50000] 
};

// اطلاعات فروشگاه
const upgradesData = {
    multitap: { name: "ضربه قوی‌تر", desc: "سکه بیشتر با هر کلیک", baseCost: 1000, mult: 2.2 },
    energyCap: { name: "مخزن بزرگ‌تر", desc: "افزایش ظرفیت انرژی", baseCost: 1500, mult: 2.0 },
    recharge: { name: "شارژ سریع‌تر", desc: "پر شدن سریع‌تر انرژی", baseCost: 3000, mult: 2.5 },
    critChance: { name: "ضربه شانس", desc: "احتمال ۵ برابر شدن سکه", baseCost: 10000, mult: 3.5 },
    autobot: { name: "ربات استخراج", desc: "جمع‌آوری خودکار موقع خروج", baseCost: 50000, mult: 5.0 }
};

// تولید بیش از ۵۰ جایزه به صورت خودکار بر اساس پیشرفت
function generateAchievements() {
    let list = [];
    const tapGoals = [100, 500, 1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
    tapGoals.forEach((g, i) => list.push({ id: `t_${i}`, title: `انگشت خستگی‌ناپذیر ${i+1}`, desc: `${g.toLocaleString()} بار کلیک کن`, target: g, type: 'taps', reward: g * 2 }));
    
    const scoreGoals = [5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000, 50000000, 100000000];
    scoreGoals.forEach((g, i) => list.push({ id: `s_${i}`, title: `سرمایه‌دار بزرگ ${i+1}`, desc: `${g.toLocaleString()} سکه در کل جمع کن`, target: g, type: 'score', reward: Math.floor(g * 0.1) }));
    
    for(let i=2; i<=11; i++) list.push({ id: `m_${i}`, title: `مشت آهنین لول ${i}`, desc: `ضربه قوی‌تر رو به لول ${i} برسون`, target: i, type: 'multitap', reward: i * 1500 });
    for(let i=2; i<=11; i++) list.push({ id: `e_${i}`, title: `باتری اتمی لول ${i}`, desc: `مخزن رو به لول ${i} برسون`, target: i, type: 'energyCap', reward: i * 2000 });
    for(let i=2; i<=11; i++) list.push({ id: `r_${i}`, title: `سرعت نور لول ${i}`, desc: `شارژ سریع رو به لول ${i} برسون`, target: i, type: 'recharge', reward: i * 3000 });
    
    return list;
}
const allAchievements = generateAchievements();

// -------------------------
// توابع کمکی
// -------------------------
function saveState() {
    state.lastTime = Date.now();
    localStorage.setItem('bc_score', state.score);
    localStorage.setItem('bc_lifetime', state.lifetimeScore);
    localStorage.setItem('bc_energy', state.energy);
    localStorage.setItem('bc_total_taps', state.totalTaps);
    localStorage.setItem('bc_crits', state.critsHit);
    localStorage.setItem('bc_offline', state.offlineEarnings);
    localStorage.setItem('bc_warnings', state.warnings);
    localStorage.setItem('bc_last_time', state.lastTime);
    localStorage.setItem('bc_upgrades', JSON.stringify(state.upgrades));
    localStorage.setItem('bc_claimed_ach', JSON.stringify(state.claimedAchs));
    localStorage.setItem('bc_daily_streak', state.dailyStreak);
    localStorage.setItem('bc_last_daily', state.lastDailyClaim);
}

function showModal(title, desc) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-desc').innerText = desc;
    document.getElementById('custom-modal').classList.add('show');
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
}
window.closeModal = () => document.getElementById('custom-modal').classList.remove('show');

function triggerConfetti() {
    if (typeof confetti !== "undefined") {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#fbbf24', '#f59e0b', '#ffffff'] });
    }
}

// -------------------------
// آنتی چیت ساده و روان
// -------------------------
let tapHistory = [];
function isCheat(e) {
    if (!e.isTrusted) return true;
    const now = Date.now();
    tapHistory.push(now);
    tapHistory = tapHistory.filter(t => now - t < 1000);
    // اگر کسی بالای ۳۵ کلیک در ثانیه کرد یعنی اتوکلیکره
    if (tapHistory.length > 35) {
        tapHistory = [];
        return true;
    }
    return false;
}

// -------------------------
// منطق اصلی بازی (Main)
// -------------------------
function updateUI() {
    const maxE = config.baseMaxEnergy + ((state.upgrades.energyCap - 1) * config.energyPerLevel);
    if (state.energy > maxE) state.energy = maxE;
    
    document.getElementById('score').innerText = state.score.toLocaleString();
    document.getElementById('energy-text').innerText = `${Math.floor(state.energy)} / ${maxE}`;
    document.getElementById('energy-fill').style.width = `${(state.energy / maxE) * 100}%`;
    
    if (state.score > state.lifetimeScore) state.lifetimeScore = state.score;
}

// حل مشکل مختصات انیمیشن +1
const coinEl = document.getElementById('coin');
const coinWrapper = document.getElementById('coin-wrapper');

coinEl.addEventListener('pointerdown', (e) => {
    if (state.energy < 1) return;
    
    if (isCheat(e)) {
        state.warnings++;
        if(state.warnings >= 3) {
            localStorage.clear();
            alert("اکانت شما به دلیل استفاده از نرم‌افزارهای تقلب پاک شد.");
            window.location.reload();
        } else {
            showModal("اخطار تقلب!", `کلیک غیرطبیعی شناسایی شد. (اخطار ${state.warnings} از 3)`);
        }
        return;
    }
    
    let power = state.upgrades.multitap;
    let isCrit = false;
    if (state.upgrades.critChance > 0 && Math.random() < 0.05) {
        power *= 5;
        isCrit = true;
        state.critsHit++;
    }
    
    state.score += power;
    state.lifetimeScore += power;
    state.energy -= 1;
    state.totalTaps += 1;
    
    if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    
    // فیکس دقیق نقطه لمس نسبت به نگهدارنده
    const rect = coinWrapper.getBoundingClientRect();
    let cx = e.clientX; let cy = e.clientY;
    if (cx === undefined && e.touches) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
    
    const x = cx - rect.left;
    const y = cy - rect.top;
    
    const pop = document.createElement('div');
    pop.className = 'floating-number';
    pop.innerText = `+${power}`;
    if (isCrit) { pop.style.color = '#fbbf24'; pop.style.fontSize = '3.5rem'; pop.innerText += "!"; }
    pop.style.left = `${x - 20}px`;
    pop.style.top = `${y - 40}px`;
    coinWrapper.appendChild(pop);
    setTimeout(() => pop.remove(), 600);
    
    updateUI();
});

// -------------------------
// نویگیشن و صفحات
// -------------------------
document.querySelectorAll('.nav-item, .nav-node').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item, .nav-node').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-tab');
        document.getElementById(target).classList.add('active');
        
        if (target === 'tab-upgrades') renderUpgrades();
        if (target === 'tab-achievements') { renderDaily(); renderAchievements(); }
        if (target === 'tab-stats') {
            document.getElementById('stat-total-taps').innerText = state.totalTaps.toLocaleString();
            document.getElementById('stat-lifetime-score').innerText = state.lifetimeScore.toLocaleString();
            document.getElementById('stat-offline-earnings').innerText = state.offlineEarnings.toLocaleString();
            document.getElementById('stat-crits').innerText = state.critsHit.toLocaleString();
            if (state.warnings > 0) {
                const sEl = document.getElementById('stat-cheat-status');
                sEl.innerText = "مشکوک به تقلب"; sEl.style.color = "#ef4444";
            }
        }
    });
});

// -------------------------
// فروشگاه
// -------------------------
function renderUpgrades() {
    const cont = document.getElementById('upgrades-container');
    cont.innerHTML = '';
    Object.keys(upgradesData).forEach(k => {
        const spec = upgradesData[k];
        const lvl = state.upgrades[k];
        const cost = Math.floor(spec.baseCost * Math.pow(spec.mult, lvl - 1));
        const maxed = (k === 'critChance' || k === 'autobot') && lvl >= 1;
        
        const canBuy = state.score >= cost && !maxed;
        
        cont.innerHTML += `
            <div class="list-item">
                <div class="item-info">
                    <h4>${spec.name} <span class="lvl-badge">سطح ${lvl}</span></h4>
                    <p>${spec.desc}</p>
                    <div class="item-price">${maxed ? 'حداکثر' : cost.toLocaleString() + ' سکه'}</div>
                </div>
                <button class="action-btn ${canBuy ? 'can-buy' : ''}" ${!canBuy ? 'disabled' : ''} onclick="buyUp('${k}', ${cost})">
                    ${maxed ? 'کامل' : 'خرید'}
                </button>
            </div>
        `;
    });
}

window.buyUp = function(k, cost) {
    if (state.score >= cost) {
        state.score -= cost;
        state.upgrades[k]++;
        if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        saveState(); updateUI(); renderUpgrades();
    }
}

// -------------------------
// جوایز روزانه و پیشرفت
// -------------------------
function renderDaily() {
    const grid = document.getElementById('daily-grid');
    const btn = document.getElementById('claim-daily-btn');
    grid.innerHTML = '';
    const now = Date.now();
    const canClaim = now - state.lastDailyClaim >= 86400000;
    if (now - state.lastDailyClaim > 172800000 && state.lastDailyClaim !== 0) state.dailyStreak = 0;
    
    for (let i = 0; i < 7; i++) {
        let cls = 'day-box';
        if (i < state.dailyStreak) cls += ' claimed';
        if (i === state.dailyStreak && canClaim) cls += ' active';
        grid.innerHTML += `<div class="${cls}"><span>روز ${i+1}</span><strong>+${config.dailyRewards[i]}</strong></div>`;
    }
    
    if (canClaim) {
        btn.disabled = false; btn.className = 'main-btn ready';
        btn.innerText = "دریافت جایزه امروز";
        btn.onclick = () => {
            const r = config.dailyRewards[state.dailyStreak];
            state.score += r; state.lifetimeScore += r;
            state.lastDailyClaim = Date.now();
            state.dailyStreak = (state.dailyStreak + 1) % 7;
            triggerConfetti();
            saveState(); updateUI(); renderDaily();
        };
    } else {
        btn.disabled = true; btn.className = 'main-btn';
        const tl = (state.lastDailyClaim + 86400000) - now;
        const h = Math.floor(tl / 3600000).toString().padStart(2,'0');
        const m = Math.floor((tl % 3600000) / 60000).toString().padStart(2,'0');
        btn.innerText = `دریافت بعدی: ${h}:${m}`;
    }
}

function renderAchievements() {
    const cont = document.getElementById('achievements-container');
    cont.innerHTML = '';
    let found = false;
    
    allAchievements.forEach(ach => {
        if (state.claimedAchs.includes(ach.id)) return;
        found = true;
        let prog = 0;
        if(ach.type === 'taps') prog = state.totalTaps;
        if(ach.type === 'score') prog = state.lifetimeScore;
        if(['multitap','energyCap','recharge'].includes(ach.type)) prog = state.upgrades[ach.type];
        
        const done = prog >= ach.target;
        cont.innerHTML += `
            <div class="list-item">
                <div class="item-info">
                    <h4>${ach.title}</h4>
                    <p>${ach.desc}</p>
                    <div class="item-price" style="color:#10b981;">+${ach.reward.toLocaleString()} سکه جایزه</div>
                </div>
                <button class="action-btn ${done ? 'can-buy' : ''}" ${!done ? 'disabled' : ''} onclick="claimAch('${ach.id}', ${ach.reward})">
                    ${done ? 'دریافت' : Math.floor(Math.min(100, (prog/ach.target)*100)) + '%'}
                </button>
            </div>
        `;
    });
    
    if (!found) cont.innerHTML = '<p style="text-align:center; color:#10b981; padding:20px;">همه جوایز را دریافت کرده‌اید!</p>';
}

window.claimAch = function(id, reward) {
    state.score += reward; state.lifetimeScore += reward;
    state.claimedAchs.push(id);
    triggerConfetti();
    saveState(); updateUI(); renderAchievements();
}

// -------------------------
// سیستم‌های خودکار
// -------------------------
function processOffline() {
    const now = Date.now();
    if (state.upgrades.autobot > 0 && state.lastTime) {
        const elap = Math.floor((now - state.lastTime) / 1000);
        if (elap > 60) {
            const capped = Math.min(elap, 3 * 3600); // ۳ ساعت
            const earned = Math.floor(capped * 0.5 * state.upgrades.multitap);
            if (earned > 0) {
                state.score += earned; state.lifetimeScore += earned; state.offlineEarnings += earned;
                showModal("خوش برگشتی!", `ربات استخراج وقتی نبودی ${earned.toLocaleString()} سکه برات جمع کرد.`);
            }
        }
    }
}

// دکمه مخفی ریست بازی برای تست
window.devResetGame = function() {
    if(confirm("آیا مطمئن هستید که می‌خواهید کل اطلاعات بازی را پاک کنید؟")) {
        localStorage.clear();
        window.location.reload();
    }
}

// حلقه بازی
setInterval(() => {
    // شارژ انرژی
    const maxE = config.baseMaxEnergy + ((state.upgrades.energyCap - 1) * config.energyPerLevel);
    if (state.energy < maxE) { 
        state.energy += config.baseRechargeRate + (state.upgrades.recharge - 1); 
        if(state.energy > maxE) state.energy = maxE; 
        updateUI(); 
    }
    
    // تایمر جایزه روزانه
    const btn = document.getElementById('claim-daily-btn');
    if (btn && btn.disabled) {
        const tl = (state.lastDailyClaim + 86400000) - Date.now();
        if (tl <= 0) renderDaily();
        else {
            const h = Math.floor(tl / 3600000).toString().padStart(2,'0');
            const m = Math.floor((tl % 3600000) / 60000).toString().padStart(2,'0');
            btn.innerText = `دریافت بعدی: ${h}:${m}`;
        }
    }

    // تایمر لیستینگ
    const target = new Date("2026-07-05T00:00:00Z").getTime();
    const diff = target - Date.now();
    if (diff > 0) {
        document.getElementById('cd-d').innerText = Math.floor(diff / 86400000).toString().padStart(2,'0');
        document.getElementById('cd-h').innerText = Math.floor((diff % 86400000) / 3600000).toString().padStart(2,'0');
        document.getElementById('cd-m').innerText = Math.floor((diff % 3600000) / 60000).toString().padStart(2,'0');
        document.getElementById('cd-s').innerText = Math.floor((diff % 60000) / 1000).toString().padStart(2,'0');
    }
    
    saveState();
}, 1000);

processOffline();
updateUI();
if(tg.initDataUnsafe && tg.initDataUnsafe.user) document.getElementById('username').innerText = tg.initDataUnsafe.user.first_name;
