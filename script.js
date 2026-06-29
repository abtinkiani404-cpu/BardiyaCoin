const tg = window.Telegram.WebApp;
tg.expand();
if (tg.ready) tg.ready();

// هسته مدیریت استیت بازی
let state = {
    score: parseInt(localStorage.getItem('b_score')) || 0,
    lifetimeScore: parseInt(localStorage.getItem('b_lifetime')) || 0,
    energy: parseInt(localStorage.getItem('b_energy')),
    totalTaps: parseInt(localStorage.getItem('b_total_taps')) || 0,
    critsHit: parseInt(localStorage.getItem('b_crits')) || 0,
    cheatWarnings: parseInt(localStorage.getItem('b_warnings')) || 0,
    lastTime: parseInt(localStorage.getItem('b_last_time')) || Date.now(),
    
    upgrades: JSON.parse(localStorage.getItem('b_upgrades_lvl')) || { multitap: 1, energyCap: 1, recharge: 1, critChance: 0, autobot: 0 },
    claimedAchievements: JSON.parse(localStorage.getItem('b_claimed_ach')) || [],
    dailyStreak: parseInt(localStorage.getItem('b_daily_streak')) || 0,
    lastDailyClaim: parseInt(localStorage.getItem('b_last_daily')) || 0
};

// رفع باگ نال بودن انرژی
if (isNaN(state.energy) || state.energy === null) { state.energy = 200; }

const config = { baseMaxEnergy: 200, energyPerLevel: 50, baseRechargeRate: 1, dailyRewards: [100, 250, 500, 1000, 2500, 5000, 10000] };

let antiCheat = { tapTimes: [], lastCoordinates: { x: 0, y: 0 }, sameCoordinatesCount: 0, isLocked: false };

const scoreEl = document.getElementById('score');
const energyTextEl = document.getElementById('energy-text');
const energyFillEl = document.getElementById('energy-fill');
const coinEl = document.getElementById('coin');
const coinWrapper = document.getElementById('coin-wrapper');

// دریافت اطلاعات کاربر
if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    const u = tg.initDataUnsafe.user;
    document.getElementById('username').innerText = (u.first_name || "MEMBER").toUpperCase();
    if (u.photo_url) {
        document.getElementById('user-avatar').src = u.photo_url;
        document.getElementById('user-avatar').style.display = 'block';
        document.getElementById('user-avatar-fallback').style.display = 'none';
    } else {
        document.getElementById('user-avatar-fallback').innerText = u.first_name ? u.first_name.charAt(0).toUpperCase() : "B";
    }
} else { document.getElementById('username').innerText = "DEV_SERVER"; }

// فرمول‌های ارتقا
function getMaxEnergy() { return config.baseMaxEnergy + ((state.upgrades.energyCap - 1) * config.energyPerLevel); }
function getCoinsPerTap() { return state.upgrades.multitap; }
function getRechargeRate() { return config.baseRechargeRate + (state.upgrades.recharge - 1); }
function triggerHaptic(type) { if (tg.HapticFeedback) { if (type === 'tap') tg.HapticFeedback.impactOccurred('medium'); if (type === 'success') tg.HapticFeedback.notificationOccurred('success'); if (type === 'error') tg.HapticFeedback.notificationOccurred('warning'); } }

// سیستم اخطار فوق پیشرفته با قانون 3 Strike
function triggerSecurityLock(reason) {
    state.cheatWarnings++;
    saveState();
    if (state.cheatWarnings >= 3) {
        localStorage.clear();
        alert("پایان بازی! شما به دلیل ۳ اخطار تقلب بن شدید و تمام دیتای شما ریست شد! 😈");
        location.reload();
        return;
    }
    antiCheat.isLocked = true;
    document.getElementById('cheat-reason').innerText = `اخطار ${state.cheatWarnings}/3:\n\n` + reason;
    document.getElementById('security-lock').style.display = 'flex';
    triggerHaptic('error');
    updateStatsPage();
}

function unlockSecurity() {
    document.getElementById('security-lock').style.display = 'none';
    antiCheat.isLocked = false;
    antiCheat.tapTimes = [];
}

// ساخت لیست ۵۰ دستاورد پویا
function generateAchievementsList() {
    let list = [];
    let tapMilestones = [10, 50, 200, 500, 1000, 2500, 5000, 10000, 25000, 50000];
    tapMilestones.forEach((m, idx) => { list.push({ id: `t_${idx}`, title: `کوبنده سطح ${idx+1}`, desc: `ثبت بیش از ${m.toLocaleString()} کلیک`, type: 'taps', target: m, reward: m * 2 }); });
    let scoreMilestones = [500, 1500, 5000, 12000, 30000, 70000, 150000, 400000, 1000000, 5000000];
    scoreMilestones.forEach((m, idx) => { list.push({ id: `s_${idx}`, title: `میلیونر سطح ${idx+1}`, desc: `کسب مجموع ${m.toLocaleString()} توکن`, type: 'score', target: m, reward: Math.floor(m * 0.1) }); });
    for(let i=2; i<=11; i++) list.push({ id: `m_${i}`, title: `سیلی آتشین لول ${i}`, desc: `ارتقای قدرت تپ به لول ${i}`, type: 'multitap', target: i, reward: i * 200 });
    for(let i=2; i<=11; i++) list.push({ id: `e_${i}`, title: `معده فولادی لول ${i}`, desc: `ارتقای ظرفیت انرژی به لول ${i}`, type: 'energyCap', target: i, reward: i * 250 });
    for(let i=2; i<=11; i++) list.push({ id: `r_${i}`, title: `نوشابه مش‌قنبر لول ${i}`, desc: `ارتقای سرعت شارژ به لول ${i}`, type: 'recharge', target: i, reward: i * 300 });
    return list;
}
const globalAchievements = generateAchievementsList();

const upgradeSpecs = {
    multitap: { name: "سیلی آتشین بردیا", desc: "افزایش دریافت سکه در هر تپ انگشت", baseCost: 100, costMultiplier: 1.6 },
    energyCap: { name: "معده فولادی", desc: "افزایش سقف مجاز ظرفیت انرژی (+۵۰)", baseCost: 150, costMultiplier: 1.5 },
    recharge: { name: "نوشابه مش‌قنبر", desc: "افزایش سرعت شارژ مجدد انرژی در ثانیه", baseCost: 250, costMultiplier: 1.8 },
    critChance: { name: "شانس خرکی", desc: "افزایش شانس ضربه ۵ برابری (کریتیکال)", baseCost: 1000, costMultiplier: 2.5 },
    autobot: { name: "نوچه ماینر", desc: "استخراج اتوماتیک وقتی خوابی (تا ۳ ساعت)", baseCost: 5000, costMultiplier: 5.0 }
};

function saveState() {
    state.lastTime = Date.now();
    localStorage.setItem('b_score', state.score);
    localStorage.setItem('b_lifetime', state.lifetimeScore);
    localStorage.setItem('b_energy', state.energy);
    localStorage.setItem('b_total_taps', state.totalTaps);
    localStorage.setItem('b_crits', state.critsHit);
    localStorage.setItem('b_warnings', state.cheatWarnings);
    localStorage.setItem('b_last_time', state.lastTime);
    localStorage.setItem('b_upgrades_lvl', JSON.stringify(state.upgrades));
    localStorage.setItem('b_claimed_ach', JSON.stringify(state.claimedAchievements));
    localStorage.setItem('b_daily_streak', state.dailyStreak);
    localStorage.setItem('b_last_daily', state.lastDailyClaim);
}

function updateUI() {
    const maxE = getMaxEnergy();
    if (state.energy > maxE) state.energy = maxE;
    scoreEl.innerText = state.score.toLocaleString();
    energyTextEl.innerText = `${state.energy} / ${maxE}`;
    energyFillEl.style.width = `${(state.energy / maxE) * 100}%`;
    
    // اطمینان از اینکه لایف تایم آپدیت است
    if (state.lifetimeScore < state.score) state.lifetimeScore = state.score;
}

function updateStatsPage() {
    document.getElementById('stat-total-taps').innerText = state.totalTaps.toLocaleString();
    document.getElementById('stat-lifetime-score').innerText = state.lifetimeScore.toLocaleString();
    document.getElementById('stat-total-upgrades').innerText = Object.values(state.upgrades).reduce((a,b)=>a+b, 0) - 3;
    document.getElementById('stat-crits').innerText = state.critsHit.toLocaleString();
    const wEl = document.getElementById('stat-warnings');
    wEl.innerText = `${state.cheatWarnings} / 3`;
    if(state.cheatWarnings > 0) wEl.classList.add('text-red');
    
    const sEl = document.getElementById('stat-cheat-status');
    if(state.cheatWarnings === 0) { sEl.innerText = "ایمن و پاک"; sEl.className = "text-green"; }
    else if(state.cheatWarnings === 1) { sEl.innerText = "مشکوک"; sEl.className = "text-gold"; sEl.style.color = "#f59e0b"; }
    else { sEl.innerText = "در خطر بن!"; sEl.className = "text-red"; }
}

// سیستم آنتی‌چیت بهبود یافته (انعطاف پذیرتر برای انسان)
function verifyAntiCheat(e, clientX, clientY) {
    if (e.isTrusted === false) { triggerSecurityLock("ربات تزریق کلیک مجاز نیست."); return false; }
    
    const now = Date.now();
    antiCheat.tapTimes.push(now);
    // نگه داشتن کلیک‌های ۱ ثانیه اخیر
    antiCheat.tapTimes = antiCheat.tapTimes.filter(t => now - t < 1000);
    // اگر در ۱ ثانیه بیش از ۲۵ کلیک کرد (غیرممکن برای انسان بدون ربات)
    if (antiCheat.tapTimes.length > 25) {
        triggerSecurityLock("سرعت کلیک شما فراانسانی است! (بیش از ۲۵ کلیک در ثانیه).");
        antiCheat.tapTimes = []; 
        return false;
    }
    
    if (antiCheat.lastCoordinates.x === clientX && antiCheat.lastCoordinates.y === clientY) {
        antiCheat.sameCoordinatesCount++;
        // انسان نمیتونه ۲۰ بار دقیقا روی ۱ پیکسل ثابت بزنه
        if (antiCheat.sameCoordinatesCount > 20) {
            triggerSecurityLock("لمس مکرر و دقیق یک پیکسل ثابت (احتمال ربات اتوکلیکر).");
            antiCheat.sameCoordinatesCount = 0;
            return false;
        }
    } else { antiCheat.sameCoordinatesCount = 0; }
    
    antiCheat.lastCoordinates = { x: clientX, y: clientY };
    return true;
}

// انیمیشن ۳ بعدی سکه بهینه شده (بدون لگ)
coinEl.addEventListener('pointerdown', (e) => {
    if (antiCheat.isLocked) return;
    if (state.energy <= 0) { triggerHaptic('error'); return; }
    if (!verifyAntiCheat(e, e.clientX, e.clientY)) return;
    
    // انیمیشن نرم سکه براساس مختصات تپ
    const rect = coinEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const tiltX = ((y - cy) / cy) * -20; 
    const tiltY = ((x - cx) / cx) * 20;

    coinEl.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(0.92)`;
    setTimeout(() => { coinEl.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)`; }, 100);
    
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
    
    triggerHaptic('tap');
    
    // پاپ آپ عدد
    const pop = document.createElement('div');
    pop.classList.add('floating-number');
    pop.innerText = `+${clickPower}`;
    if(isCrit) { pop.style.color = '#06b6d4'; pop.style.fontSize = '2.8rem'; pop.innerText += "!"; }
    pop.style.left = `${x - 15}px`; pop.style.top = `${y - 35}px`;
    coinWrapper.appendChild(pop);
    setTimeout(() => pop.remove(), 500);
    
    updateUI();
    saveState();
});

// نویگیشن بار
const navNodes = document.querySelectorAll('.nav-node');
const appTabs = document.querySelectorAll('.app-tab');
navNodes.forEach(node => {
    node.addEventListener('click', () => {
        if (antiCheat.isLocked) return;
        navNodes.forEach(n => n.classList.remove('active'));
        appTabs.forEach(t => t.classList.remove('active'));
        node.classList.add('active');
        const target = node.getAttribute('data-tab');
        document.getElementById(target).classList.add('active');
        triggerHaptic('tap');
        if(target === 'tab-upgrades') renderUpgrades();
        if(target === 'tab-achievements') { renderDailyGrid(); renderAchievements(); }
        if(target === 'tab-stats') updateStatsPage();
    });
});

// رندر فروشگاه
function renderUpgrades() {
    const container = document.getElementById('upgrades-container');
    container.innerHTML = '';
    Object.keys(upgradeSpecs).forEach(key => {
        const spec = upgradeSpecs[key];
        const lvl = state.upgrades[key];
        const cost = Math.floor(spec.baseCost * Math.pow(spec.costMultiplier, lvl - 1));
        const maxReached = (key === 'critChance' && lvl >= 1) || (key === 'autobot' && lvl >= 1);
        
        const card = document.createElement('div');
        card.classList.add('upgrade-card');
        card.innerHTML = `
            <div class="card-info">
                <h4>${spec.name} <span class="lvl-badge">LVL ${lvl}</span></h4>
                <p>${spec.desc}</p>
                <div class="price">${maxReached ? 'سطح حداکثر' : `<i class="fa-solid fa-coins"></i> ${cost.toLocaleString()}`}</div>
            </div>
            <button class="btn-action" ${state.score < cost || maxReached ? 'disabled' : ''} data-key="${key}" data-cost="${cost}">
                ${maxReached ? '<i class="fa-solid fa-lock"></i> MAX' : '<i class="fa-solid fa-arrow-up"></i> ارتقا'}
            </button>
        `;
        container.appendChild(card);
    });
    
    container.querySelectorAll('.btn-action').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-key');
            const cost = parseInt(btn.getAttribute('data-cost'));
            if (state.score >= cost) {
                state.score -= cost;
                state.upgrades[key]++;
                triggerHaptic('success');
                saveState();
                updateUI();
                renderUpgrades();
            }
        });
    });
}

// رندر جایزه روزانه
function renderDailyGrid() {
    const grid = document.getElementById('daily-grid');
    grid.innerHTML = '';
    const now = Date.now();
    const canClaim = now - state.lastDailyClaim >= 24 * 60 * 60 * 1000;
    const missedStreak = now - state.lastDailyClaim > 48 * 60 * 60 * 1000;
    
    if (missedStreak && state.lastDailyClaim !== 0) { state.dailyStreak = 0; }
    
    for (let i = 0; i < 7; i++) {
        const box = document.createElement('div');
        box.classList.add('daily-day-box');
        if (i < state.dailyStreak) box.classList.add('claimed');
        if (i === state.dailyStreak && canClaim) box.classList.add('active');
        box.innerHTML = `<div>روز ${i+1}</div><div style="color:#f59e0b;font-weight:700;margin-top:3px;">+${config.dailyRewards[i]}</div>`;
        grid.appendChild(box);
    }
}

document.getElementById('claim-daily-btn').addEventListener('click', () => {
    const now = Date.now();
    if (now - state.lastDailyClaim >= 24 * 60 * 60 * 1000) {
        state.score += config.dailyRewards[state.dailyStreak];
        state.lifetimeScore += config.dailyRewards[state.dailyStreak];
        state.lastDailyClaim = now;
        state.dailyStreak = (state.dailyStreak + 1) % 7;
        triggerHaptic('success');
        saveState();
        updateUI();
        renderDailyGrid();
        updateDailyCountdown();
    }
});

// مدیریت مأموریت‌ها با محو شدن پس از دریافت
function renderAchievements() {
    const container = document.getElementById('achievements-container');
    container.innerHTML = '';
    let hasRendered = false;
    
    globalAchievements.forEach(ach => {
        if (state.claimedAchievements.includes(ach.id)) return; // حذف از لیست اگر دریافت شده
        hasRendered = true;
        let currentProgress = 0;
        if(ach.type === 'taps') currentProgress = state.totalTaps;
        if(ach.type === 'score') currentProgress = state.lifetimeScore;
        if(ach.type === 'multitap' || ach.type === 'energyCap' || ach.type === 'recharge') currentProgress = state.upgrades[ach.type];
        
        const isCompleted = currentProgress >= ach.target;
        const iconHTML = isCompleted ? `<div class="ach-icon ready"><i class="fa-solid fa-gift"></i></div>` : `<div class="ach-icon locked"><i class="fa-solid fa-lock"></i></div>`;
        
        const card = document.createElement('div');
        card.classList.add('achievement-card');
        card.innerHTML = `
            ${iconHTML}
            <div class="card-info" style="margin-left:5px;">
                <h4 style="font-size:12px;">${ach.title}</h4>
                <p>${ach.desc}</p>
                <div class="price" style="color:#10b981;">+${ach.reward.toLocaleString()} توکن</div>
            </div>
            <button class="btn-action" ${!isCompleted ? 'disabled' : ''} data-id="${ach.id}" data-reward="${ach.reward}">
                ${isCompleted ? 'دریافت' : `${Math.min(100, Math.floor((currentProgress/ach.target)*100))}%`}
            </button>
        `;
        container.appendChild(card);
    });
    
    if(!hasRendered) {
        container.innerHTML = `<div style="text-align:center; padding: 20px; color:#10b981;"><i class="fa-solid fa-check-double" style="font-size:30px; margin-bottom:10px;"></i><p>شما تمام دستاوردهای موجود را دریافت کرده‌اید!</p></div>`;
    }
    
    container.querySelectorAll('.btn-action').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const reward = parseInt(btn.getAttribute('data-reward'));
            if (!state.claimedAchievements.includes(id)) {
                state.score += reward;
                state.lifetimeScore += reward;
                state.claimedAchievements.push(id);
                triggerHaptic('success');
                saveState();
                updateUI();
                renderAchievements(); // بازسازی لیست و محو کردن آیتم
            }
        });
    });
}

// ربات آفلاین
function processOfflineMining() {
    const now = Date.now();
    if (state.upgrades.autobot > 0 && state.lastTime) {
        const elapsedSeconds = Math.floor((now - state.lastTime) / 1000);
        if (elapsedSeconds > 60) {
            const cappedSeconds = Math.min(elapsedSeconds, 3 * 60 * 60);
            const offlineEarnings = Math.floor(cappedSeconds * 0.2 * getCoinsPerTap());
            if (offlineEarnings > 0) {
                state.score += offlineEarnings;
                state.lifetimeScore += offlineEarnings;
                setTimeout(() => { tg.showAlert(`ربات "نوچه ماینر" در غیاب شما ${offlineEarnings.toLocaleString()} توکن برای شما استخراج کرد! 🚀`); }, 1000);
            }
        }
    }
}

// تایمر پاداش روزانه
function updateDailyCountdown() {
    const claimBtn = document.getElementById('claim-daily-btn');
    if(!claimBtn) return;
    const now = Date.now();
    const timeSinceLastClaim = now - state.lastDailyClaim;
    const cooldown = 24 * 60 * 60 * 1000;
    
    if (timeSinceLastClaim >= cooldown) {
        claimBtn.disabled = false;
        claimBtn.classList.add('ready-glow');
        claimBtn.innerHTML = `<i class="fa-solid fa-gift"></i> دریافت پاداش امروز`;
    } else {
        const timeLeft = cooldown - timeSinceLastClaim;
        const h = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((timeLeft % (1000 * 60)) / 1000);
        claimBtn.disabled = true;
        claimBtn.classList.remove('ready-glow');
        claimBtn.innerHTML = `<i class="fa-solid fa-clock"></i> در دسترس تا: ${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }
}

// حلقه اصلی بازی (هر ۱ ثانیه)
setInterval(() => {
    if (antiCheat.isLocked) return;
    
    // شارژ انرژی
    const maxE = getMaxEnergy();
    if (state.energy < maxE) {
        state.energy += getRechargeRate();
        if (state.energy > maxE) state.energy = maxE;
        updateUI();
    }
    
    updateDailyCountdown();
    
    // شمارش معکوس لیستینگ (۱۴ تیر ۱۴۰۵ = 5 July 2026, 00:00:00)
    const listingDate = new Date("2026-07-05T00:00:00+03:30").getTime();
    const diff = listingDate - Date.now();
    if (diff > 0) {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        
        document.getElementById('cd-d').innerText = d.toString().padStart(2,'0');
        document.getElementById('cd-h').innerText = h.toString().padStart(2,'0');
        document.getElementById('cd-m').innerText = m.toString().padStart(2,'0');
        document.getElementById('cd-s').innerText = s.toString().padStart(2,'0');
    } else {
        const cdContainer = document.getElementById('countdown-container');
        if(cdContainer) cdContainer.innerHTML = "<h2 style='color:#10b981; font-size: 24px;'><i class='fa-solid fa-check-circle'></i> لیست شد!</h2>";
    }

    saveState();
}, 1000);

// اجرا در استارت
processOfflineMining();
updateUI();
updateStatsPage();
