const tg = window.Telegram.WebApp;
tg.expand();
if (tg.ready) tg.ready();

// -------------------------
// مدیریت استیت (State)
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
    
    upgrades: JSON.parse(localStorage.getItem('bc_upgrades')) || {
        multitap: 1, energyCap: 1, recharge: 1, critChance: 0, autobot: 0
    },
    claimedAchs: JSON.parse(localStorage.getItem('bc_claimed_ach')) || [],
    dailyStreak: parseInt(localStorage.getItem('bc_daily_streak')) || 0,
    lastDailyClaim: parseInt(localStorage.getItem('bc_last_daily')) || 0
};

if (isNaN(state.energy) || state.energy === null) state.energy = 200;

const config = { baseMaxEnergy: 200, energyPerLevel: 100, baseRechargeRate: 3, dailyRewards: [200, 500, 1000, 2000, 5000, 10000, 25000] };

const upgradesData = {
    multitap: { name: "ضربه قوی‌تر", desc: "سکه بیشتر با هر کلیک", baseCost: 1000, mult: 2.2 },
    energyCap: { name: "مخزن بزرگ‌تر", desc: "افزایش ظرفیت انرژی", baseCost: 1500, mult: 2.0 },
    recharge: { name: "شارژ سریع‌تر", desc: "پر شدن سریع‌تر انرژی", baseCost: 3000, mult: 2.5 },
    critChance: { name: "ضربه شانس", desc: "احتمال ۵ برابر شدن سکه", baseCost: 10000, mult: 3.5 },
    autobot: { name: "ربات استخراج", desc: "جمع‌آوری خودکار موقع خروج", baseCost: 50000, mult: 5.0 }
};

function generateAchievements() {
    let list = [];
    const tapGoals = [100, 500, 1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
    tapGoals.forEach((g, i) => list.push({ id: `t_${i}`, title: `انگشت فولادی ${i+1}`, desc: `${g.toLocaleString()} بار کلیک کن`, target: g, type: 'taps', reward: g * 2 }));
    
    const scoreGoals = [5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000, 50000000, 100000000];
    scoreGoals.forEach((g, i) => list.push({ id: `s_${i}`, title: `سرمایه‌دار بزرگ ${i+1}`, desc: `${g.toLocaleString()} سکه در کل جمع کن`, target: g, type: 'score', reward: Math.floor(g * 0.1) }));
    
    for(let i=2; i<=11; i++) list.push({ id: `m_${i}`, title: `مشت آهنین لول ${i}`, desc: `ضربه قوی‌تر رو به لول ${i} برسون`, target: i, type: 'multitap', reward: i * 1500 });
    for(let i=2; i<=11; i++) list.push({ id: `e_${i}`, title: `باتری اتمی لول ${i}`, desc: `مخزن رو به لول ${i} برسون`, target: i, type: 'energyCap', reward: i * 2000 });
    for(let i=2; i<=11; i++) list.push({ id: `r_${i}`, title: `سرعت نور لول ${i}`, desc: `شارژ سریع رو به لول ${i} برسون`, target: i, type: 'recharge', reward: i * 3000 });
    return list;
}
const allAchievements = generateAchievements();

// -------------------------
// لود پروفایل هوشمند تلگرام
// -------------------------
function loadTelegramProfile() {
    const user = tg.initDataUnsafe?.user;
    const container = document.getElementById('avatar-container');
    if (user) {
        document.getElementById('username').innerText = user.first_name;
        if (user.photo_url) {
            container.innerHTML = `<img src="${user.photo_url}" class="avatar-img" alt="Profile">`;
        } else {
            const initial = user.first_name.charAt(0).toUpperCase();
            container.innerHTML = `<div class="avatar-text">${initial}</div>`;
        }
    } else {
        document.getElementById('username').innerText = "کاربر تست";
        container.innerHTML = `<div class="avatar-text">T</div>`;
    }
}
loadTelegramProfile();

// -------------------------
// توابع کمکی و افکت‌ها
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

function triggerConfetti() {
    if (typeof confetti !== "undefined") {
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, colors: ['#fbbf24', '#f59e0b', '#ffffff', '#10b981'] });
    }
}

// -------------------------
// آنتی چیت پیشرفته (Anti-Cheat)
// -------------------------
let tapHistory = [];
function verifyClick(e) {
    if (!e.isTrusted) return false;
    
    // اگر در پلتفرم تلگرام نیست و در موبایل بازی میکند (تشخیص بات های تحت وب)
    if (tg.platform === 'unknown' && navigator.userAgent.match(/Android|iPhone/i)) {
        return false;
    }

    const now = Date.now();
    tapHistory.push(now);
    tapHistory = tapHistory.filter(t => now - t < 1000);
    
    if (tapHistory.length > 25) { // بالای 25 کلیک در ثانیه غیرممکن است
        tapHistory = [];
        return false;
    }
    return true;
}

function handleCheat() {
    state.warnings++;
    if(state.warnings >= 3) {
        localStorage.clear();
        Swal.fire({ title: 'حساب مسدود شد!', text: 'به دلیل تقلب، اکانت شما پاک شد.', icon: 'error', confirmButtonText: 'شروع مجدد' }).then(() => { window.location.reload(); });
    } else {
        Swal.fire({ title: 'اخطار امنیتی!', text: `فعالیت غیرطبیعی شناسایی شد. (اخطار ${state.warnings} از 3)`, icon: 'warning', confirmButtonText: 'متوجه شدم' });
    }
    saveState();
}

// -------------------------
// سیستم اصلی بازی
// -------------------------
function updateUI() {
    const maxE = config.baseMaxEnergy + ((state.upgrades.energyCap - 1) * config.energyPerLevel);
    if (state.energy > maxE) state.energy = maxE;
    
    document.getElementById('score').innerText = state.score.toLocaleString();
    document.getElementById('energy-text').innerText = `${Math.floor(state.energy)} / ${maxE}`;
    document.getElementById('energy-fill').style.width = `${(state.energy / maxE) * 100}%`;
    
    if (state.score > state.lifetimeScore) state.lifetimeScore = state.score;
}

const coinEl = document.getElementById('coin');
const coinWrapper = document.getElementById('coin-wrapper');

// راه‌اندازی VanillaTilt
if (typeof VanillaTilt !== 'undefined') {
    VanillaTilt.init(coinEl, { max: 15, speed: 400, glare: true, "max-glare": 0.4 });
}

coinEl.addEventListener('pointerdown', (e) => {
    if (state.energy < 1) return;
    
    if (!verifyClick(e)) { handleCheat(); return; }
    
    let power = state.upgrades.multitap;
    let isCrit = false;
    if (state.upgrades.critChance > 0 && Math.random() < 0.05) {
        power *= 5; isCrit = true; state.critsHit++;
    }
    
    state.score += power; state.lifetimeScore += power;
    state.energy -= 1; state.totalTaps += 1;
    
    if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    
    const rect = coinWrapper.getBoundingClientRect();
    let cx = e.clientX || (e.touches && e.touches[0].clientX);
    let cy = e.clientY || (e.touches && e.touches[0].clientY);
    
    const pop = document.createElement('div');
    pop.className = 'floating-number';
    pop.innerText = `+${power}`;
    if (isCrit) { pop.style.color = '#fbbf24'; pop.style.fontSize = '3.5rem'; pop.innerText += "!"; }
    pop.style.left = `${(cx - rect.left) - 20}px`;
    pop.style.top = `${(cy - rect.top) - 40}px`;
    coinWrapper.appendChild(pop);
    setTimeout(() => pop.remove(), 600);
    
    updateUI(); checkBadges();
});

// -------------------------
// Badge هوشمند جوایز
// -------------------------
function checkBadges() {
    let hasUnclaimed = false;
    const now = Date.now();
    // چک جایزه روزانه
    if (now - state.lastDailyClaim >= 86400000) hasUnclaimed = true;
    
    // چک دستاوردها
    if (!hasUnclaimed) {
        for (let ach of allAchievements) {
            if (!state.claimedAchs.includes(ach.id)) {
                let prog = 0;
                if(ach.type === 'taps') prog = state.totalTaps;
                if(ach.type === 'score') prog = state.lifetimeScore;
                if(['multitap','energyCap','recharge'].includes(ach.type)) prog = state.upgrades[ach.type];
                if(prog >= ach.target) { hasUnclaimed = true; break; }
            }
        }
    }
    
    const badge = document.getElementById('badge-ach');
    if (hasUnclaimed) badge.classList.add('show');
    else badge.classList.remove('show');
}

// -------------------------
// نویگیشن و تب‌ها
// -------------------------
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
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
            document.getElementById('stat-warnings').innerText = `${state.warnings} / 3`;
            const sEl = document.getElementById('stat-cheat-status');
            if (state.warnings === 0) { sEl.innerText = "سالم"; sEl.className = "text-success"; }
            else { sEl.innerText = "مشکوک"; sEl.className = "text-danger"; }
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
                    <div class="item-price">${maxed ? 'حداکثر ارتقا' : cost.toLocaleString() + ' B-COIN'}</div>
                </div>
                <button class="action-btn ${canBuy ? 'can-buy' : ''}" ${!canBuy ? 'disabled' : ''} onclick="buyUp('${k}', ${cost})">
                    ${maxed ? '<i class="fa-solid fa-lock"></i>' : 'خرید'}
                </button>
            </div>
        `;
    });
}

window.buyUp = function(k, cost) {
    if (state.score >= cost) {
        state.score -= cost; state.upgrades[k]++;
        if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        saveState(); updateUI(); renderUpgrades(); checkBadges();
    }
}

// -------------------------
// جوایز
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
        btn.innerHTML = "<i class='fa-solid fa-gift'></i> دریافت جایزه امروز";
        btn.onclick = () => {
            const r = config.dailyRewards[state.dailyStreak];
            state.score += r; state.lifetimeScore += r;
            state.lastDailyClaim = Date.now();
            state.dailyStreak = (state.dailyStreak + 1) % 7;
            triggerConfetti(); saveState(); updateUI(); renderDaily(); checkBadges();
            Swal.fire({ title: 'عالی بود!', text: `${r.toLocaleString()} سکه به حسابت واریز شد.`, icon: 'success', confirmButtonText: 'مرسی' });
        };
    } else {
        btn.disabled = true; btn.className = 'main-btn';
        const tl = (state.lastDailyClaim + 86400000) - now;
        const h = Math.floor(tl / 3600000).toString().padStart(2,'0');
        const m = Math.floor((tl % 3600000) / 60000).toString().padStart(2,'0');
        btn.innerHTML = `<i class='fa-solid fa-clock'></i> دریافت بعدی: ${h}:${m}`;
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
                    <div class="item-price" style="color:var(--success);">+${ach.reward.toLocaleString()} سکه</div>
                </div>
                <button class="action-btn ${done ? 'can-buy' : ''}" ${!done ? 'disabled' : ''} onclick="claimAch('${ach.id}', ${ach.reward})">
                    ${done ? 'دریافت' : Math.floor(Math.min(100, (prog/ach.target)*100)) + '%'}
                </button>
            </div>
        `;
    });
    
    if (!found) cont.innerHTML = '<p style="text-align:center; color:var(--success); padding:20px;">شما تمام جوایز را گرفته‌اید!</p>';
}

window.claimAch = function(id, reward) {
    state.score += reward; state.lifetimeScore += reward;
    state.claimedAchs.push(id);
    triggerConfetti(); saveState(); updateUI(); renderAchievements(); checkBadges();
}

// -------------------------
// ابزارهای سیستم
// -------------------------
window.devResetGame = function() {
    Swal.fire({
        title: 'ریست اکانت؟',
        text: 'آیا مطمئن هستید که می‌خواهید کل بازی را از صفر شروع کنید؟ این عمل غیرقابل بازگشت است!',
        icon: 'warning', showCancelButton: true, confirmButtonText: 'بله، ریست کن', cancelButtonText: 'نه، انصراف',
        confirmButtonColor: '#ef4444'
    }).then((result) => {
        if (result.isConfirmed) { localStorage.clear(); window.location.reload(); }
    });
}

function processOffline() {
    const now = Date.now();
    if (state.upgrades.autobot > 0 && state.lastTime) {
        const elap = Math.floor((now - state.lastTime) / 1000);
        if (elap > 60) {
            const capped = Math.min(elap, 3 * 3600);
            const earned = Math.floor(capped * 0.5 * state.upgrades.multitap);
            if (earned > 0) {
                state.score += earned; state.lifetimeScore += earned; state.offlineEarnings += earned;
                Swal.fire({ title: 'گزارش ربات', text: `ربات استخراج وقتی نبودی ${earned.toLocaleString()} سکه برات جمع کرد!`, icon: 'info', confirmButtonText: 'دمش گرم' });
            }
        }
    }
}

// -------------------------
// حلقه‌های اصلی بازی
// -------------------------

// حلقه ۱ ثانیه ای برای آپدیت تایمرها و لیستینگ
setInterval(() => {
    // تایمر جایزه روزانه
    const btn = document.getElementById('claim-daily-btn');
    if (btn && btn.disabled) {
        const tl = (state.lastDailyClaim + 86400000) - Date.now();
        if (tl <= 0) { renderDaily(); checkBadges(); }
        else {
            const h = Math.floor(tl / 3600000).toString().padStart(2,'0');
            const m = Math.floor((tl % 3600000) / 60000).toString().padStart(2,'0');
            btn.innerHTML = `<i class='fa-solid fa-clock'></i> دریافت بعدی: ${h}:${m}`;
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

// چرخه شارژ انرژی: هر ۳ ثانیه یک‌بار انجام می‌شود
setInterval(() => {
    const maxE = config.baseMaxEnergy + ((state.upgrades.energyCap - 1) * config.energyPerLevel);
    if (state.energy < maxE) {
        // مقدار شارژ بر اساس ارتقای recharge محاسبه شده و هر 3 ثانیه اضافه می‌شود
        let recoveryAmount = (config.baseRechargeRate + (state.upgrades.recharge - 1)) * 3;
        state.energy += recoveryAmount; 
        if(state.energy > maxE) state.energy = maxE; 
        updateUI(); 
    }
}, 3000);

// اجرای اولیه
processOffline();
updateUI();
checkBadges();
