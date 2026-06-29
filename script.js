const tg = window.Telegram.WebApp;
tg.expand();
if (tg.ready) tg.ready();

// دیتابیس لوکل و متغیرهای حالت بازی
let state = {
    score: parseInt(localStorage.getItem('b_score')) || 0,
    energy: parseInt(localStorage.getItem('b_energy')),
    totalTaps: parseInt(localStorage.getItem('b_total_taps')) || 0,
    highestScore: parseInt(localStorage.getItem('b_high_score')) || 0,
    lastTime: parseInt(localStorage.getItem('b_last_time')) || Date.now(),
    
    // لول‌های سیستم ارتقا
    upgrades: JSON.parse(localStorage.getItem('b_upgrades_lvl')) || {
        multitap: 1,
        energyCap: 1,
        recharge: 1,
        critChance: 0,
        autobot: 0
    },
    
    // وضعیت دستاوردها و بونوس روزانه
    claimedAchievements: JSON.parse(localStorage.getItem('b_claimed_ach')) || [],
    dailyStreak: parseInt(localStorage.getItem('b_daily_streak')) || 0,
    lastDailyClaim: parseInt(localStorage.getItem('b_last_daily')) || 0
};

// کانفیگ‌های داینامیک هسته بازی
const config = {
    baseMaxEnergy: 200,
    energyPerLevel: 50,
    baseRechargeRate: 1,
    dailyRewards: [100, 250, 500, 1000, 2500, 5000, 10000]
};

// متغیرهای ویژه محاسباتی سیستم آنتی‌چیت داخلی
let antiCheat = {
    lastTapTime: 0,
    tapIntervals: [],
    lastCoordinates: { x: 0, y: 0 },
    sameCoordinatesCount: 0,
    isLocked: false
};

// فیکس کردن دیتای نال شده انرژی در اولین ورود
if (isNaN(state.energy) || state.energy === null) {
    state.energy = config.baseMaxEnergy;
}

// عناصر رندر DOM
const scoreEl = document.getElementById('score');
const energyTextEl = document.getElementById('energy-text');
const energyFillEl = document.getElementById('energy-fill');
const coinEl = document.getElementById('coin');
const coinWrapper = document.getElementById('coin-wrapper');
const usernameEl = document.getElementById('username');
const userAvatarEl = document.getElementById('user-avatar');
const avatarFallbackEl = document.getElementById('user-avatar-fallback');

// راه‌اندازی مشخصات کاربر تلگرام
if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    const u = tg.initDataUnsafe.user;
    usernameEl.innerText = (u.first_name || "MEMBER").toUpperCase();
    if (u.photo_url) {
        userAvatarEl.src = u.photo_url;
        userAvatarEl.style.display = 'block';
        avatarFallbackEl.style.display = 'none';
    } else {
        avatarFallbackEl.innerText = u.first_name ? u.first_name.charAt(0).toUpperCase() : "B";
    }
} else {
    usernameEl.innerText = "DEV_SERVER";
}

// محاسبه مقادیر پویای ارتقایافته بازی
function getMaxEnergy() { return config.baseMaxEnergy + ((state.upgrades.energyCap - 1) * config.energyPerLevel); }
function getCoinsPerTap() { return state.upgrades.multitap; }
function getRechargeRate() { return config.baseRechargeRate + (state.upgrades.recharge - 1); }

// هندل کردن لرزش هوشمند امن گوشی در تلگرام
function triggerHaptic(type) {
    if (tg.HapticFeedback) {
        if (type === 'tap') tg.HapticFeedback.impactOccurred('medium');
        if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
        if (type === 'error') tg.HapticFeedback.notificationOccurred('warning');
    }
}

// فعال‌سازی پنل امنیتی قفل چیت ربات
function triggerSecurityLock(reason) {
    antiCheat.isLocked = true;
    document.getElementById('cheat-reason').innerText = reason;
    document.getElementById('security-lock').style.display = 'flex';
    triggerHaptic('error');
}

// چک کردن تقلب تغییر زمان گوشی در ورود به بازی
if (Date.now() < state.lastTime - 2000) {
    triggerSecurityLock("تغییر زمان یا دستکاری ساعت محلی گوشی شناسایی شد.");
}

// دیتابیس پویای ۵۰ دستاورد مختلف بازی برای بهینه‌سازی حجم کامپایل
function generateAchievementsList() {
    let list = [];
    // ۱۰ دستاورد تعداد تپ
    let tapMilestones = [10, 50, 200, 500, 1000, 2500, 5000, 10000, 25000, 50000];
    tapMilestones.forEach((m, idx) => {
        list.push({ id: `t_${idx}`, title: `کوبنده سطح ${idx+1}`, desc: `ثبت بیش از ${m} کلیک در بازی`, type: 'taps', target: m, reward: m * 2 });
    });
    // ۱۰ دستاورد موجودی توکن
    let scoreMilestones = [500, 1500, 5000, 12000, 30000, 70000, 150000, 400000, 1000000, 5000000];
    scoreMilestones.forEach((m, idx) => {
        list.push({ id: `s_${idx}`, title: `میلیونر سطح ${idx+1}`, desc: `رسیدن به موجودی ${m} توکن`, type: 'score', target: m, reward: Math.floor(m * 0.1) });
    });
    // ۱۰ دستاورد لول مولتی تپ
    for(let i=2; i<=11; i++) {
        list.push({ id: `m_${i}`, title: `انگشت فولادی لول ${i}`, desc: `ارتقای ماژول مولتی تپ به لول ${i}`, type: 'multitap', target: i, reward: i * 200 });
    }
    // ۱۰ دستاورد لول خازن انرژی
    for(let i=2; i<=11; i++) {
        list.push({ id: `e_${i}`, title: `مخزن پلاسما لول ${i}`, desc: `ارتقای ظرفیت انرژی به لول ${i}`, type: 'energyCap', target: i, reward: i * 250 });
    }
    // ۱۰ دستاورد سرعت شارژ
    for(let i=2; i<=11; i++) {
        list.push({ id: `r_${i}`, title: `رآکتور اتمی لول ${i}`, desc: `ارتقای رآکتور شارژ به لول ${i}`, type: 'recharge', target: i, reward: i * 300 });
    }
    return list;
}
const globalAchievements = generateAchievementsList();

// مشخصات فنی سیستم ارتقای فروشگاه ربات
const upgradeSpecs = {
    multitap: { name: "ماژول Multi-Tap", desc: "افزایش تعداد توکن دریافتی در هر تپ", baseCost: 100, costMultiplier: 1.6 },
    energyCap: { name: "ظرفیت خازن هسته", desc: "افزایش سقف مجاز ذخیره انرژی (+۵۰ واحد)", baseCost: 150, costMultiplier: 1.5 },
    recharge: { name: "رآکتور بازیابی", desc: "افزایش نرخ شارژ مجدد انرژی در ثانیه", baseCost: 250, costMultiplier: 1.8 },
    critChance: { name: "شتاب بحرانی تپ", desc: "اضافه شدن شانس ۵٪ برای دریافت پاداش ضربدر ۴", baseCost: 1000, costMultiplier: 2.5 },
    autobot: { name: "ربات استخراج آفلاین", desc: "استخراج خودکار سکه زمان خروج از برنامه (تا ۳ ساعت)", baseCost: 5000, costMultiplier: 5.0 }
};

// ذخیره‌سازی جامع پایداری دیتای بازی
function saveState() {
    state.lastTime = Date.now();
    localStorage.setItem('b_score', state.score);
    localStorage.setItem('b_energy', state.energy);
    localStorage.setItem('b_total_taps', state.totalTaps);
    localStorage.setItem('b_high_score', state.highestScore);
    localStorage.setItem('b_last_time', state.lastTime);
    localStorage.setItem('b_upgrades_lvl', JSON.stringify(state.upgrades));
    localStorage.setItem('b_claimed_ach', JSON.stringify(state.claimedAchievements));
    localStorage.setItem('b_daily_streak', state.dailyStreak);
    localStorage.setItem('b_last_daily', state.lastDailyClaim);
}

// به‌روزرسانی نهایی دیتای گرافیکی صفحه
function updateUI() {
    const maxE = getMaxEnergy();
    if (state.energy > maxE) state.energy = maxE;
    
    scoreEl.innerText = state.score.toLocaleString();
    energyTextEl.innerText = `${state.energy} / ${maxE}`;
    energyFillEl.style.width = `${(state.energy / maxE) * 100}%`;
    
    if(state.score > state.highestScore) state.highestScore = state.score;
    
    // آپدیت آمارهای زنده دکمه تب آمار
    document.getElementById('stat-total-taps').innerText = state.totalTaps.toLocaleString();
    document.getElementById('stat-total-upgrades').innerText = Object.values(state.upgrades).reduce((a,b)=>a+b, 0) - 3;
    document.getElementById('stat-highest-score').innerText = state.highestScore.toLocaleString();
}

// رندر ۳ بعدی فوق روان حرکتی سکه براساس زاویه دید انگشت
coinEl.addEventListener('pointermove', (e) => {
    if (antiCheat.isLocked) return;
    const rect = coinEl.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width/2;
    const y = e.clientY - rect.top - rect.height/2;
    // چرخش ۳ بعدی بسیار شیک حول محورهای مختصات سکه
    const rotX = -(y / rect.height) * 25;
    const rotY = (x / rect.width) * 25;
    coinEl.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(0.98)`;
});

coinEl.addEventListener('pointerleave', () => {
    coinEl.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
});

// بدنه اصلی سیستم تشخیص فوق هوشمند اتوکلیکر و تقلب
function verifyAntiCheat(e) {
    // ۱. بررسی معتبر بودن رویداد از سمت کلاینت واقعی سیستم‌عامل
    if (e.isTrusted === false) {
        triggerSecurityLock("نرم‌افزار تزریق کلیک مجاز (Virtual Clicker) شناسایی شد.");
        return false;
    }
    
    const now = Date.now();
    // ۲. بررسی فرکانس سرعت کلیکینگ (زیر ۳۵ میلی‌ثانیه فیزیکی غیرممکن است)
    if (antiCheat.lastTapTime !== 0) {
        const interval = now - antiCheat.lastTapTime;
        antiCheat.tapIntervals.push(interval);
        if (antiCheat.tapIntervals.length > 8) antiCheat.tapIntervals.shift();
        
        const rapidTaps = antiCheat.tapIntervals.filter(t => t < 35).length;
        if (rapidTaps >= 3) {
            triggerSecurityLock("سرعت کلیک غیرطبیعی (Macro Auto-Clicker) ردیابی شد.");
            return false;
        }
    }
    antiCheat.lastTapTime = now;
    
    // ۳. بررسی مختصات دقیق پیکسل (انسان هیچگاه دقیقاً یک پیکسل ثابت را متوالی تپ نمی‌کند)
    if (antiCheat.lastCoordinates.x === e.clientX && antiCheat.lastCoordinates.y === e.clientY) {
        antiCheat.sameCoordinatesCount++;
        if (antiCheat.sameCoordinatesCount >= 6) {
            triggerSecurityLock("کلیک در پوزیشن نقطه ثابت ریاضی (Static Tap Bot) مسدود شد.");
            return false;
        }
    } else {
        antiCheat.sameCoordinatesCount = 0;
    }
    antiCheat.lastCoordinates = { x: e.clientX, y: e.clientY };
    return true;
}

// ساخت انیمیشن پاپ آپ عدد استخراج روی مانیتور
function createNumberPopup(x, y, amount, isCrit) {
    const pop = document.createElement('div');
    pop.classList.add('floating-number');
    pop.innerText = `+${amount}`;
    if(isCrit) {
        pop.style.color = '#06b6d4';
        pop.style.fontSize = '2.8rem';
    }
    pop.style.left = `${x - 15}px`;
    pop.style.top = `${y - 35}px`;
    coinWrapper.appendChild(pop);
    setTimeout(() => pop.remove(), 450);
}

// عملیات کلیک روی ماژول استخراج سکه
coinEl.addEventListener('pointerdown', (e) => {
    if (antiCheat.isLocked) return;
    if (state.energy <= 0) {
        triggerHaptic('error');
        return;
    }
    if (!verifyAntiCheat(e)) return;
    
    let clickPower = getCoinsPerTap();
    let isCrit = false;
    
    // اعمال ضرب شتاب بحرانی (Critical Chance Upgrade)
    if (state.upgrades.critChance > 0 && Math.random() < 0.05) {
        clickPower *= 4;
        isCrit = true;
    }
    
    // کسر انرژی و اضافه به موجودی
    state.score += clickPower;
    state.energy -= 1;
    state.totalTaps += 1;
    
    triggerHaptic('tap');
    
    const rect = coinWrapper.getBoundingClientRect();
    createNumberPopup(e.clientX - rect.left, e.clientY - rect.top, clickPower, isCrit);
    
    updateUI();
    saveState();
});

// سیستم هوشمند سوئیچینگ تب‌های نویگیشن بار پایینی بدون باگ
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
        
        // بازخوانی مجدد رندر تب‌های فروشگاه یا جوایز زمان سوئیچ
        if(target === 'tab-upgrades') renderUpgrades();
        if(target === 'tab-achievements') { renderDailyGrid(); renderAchievements(); }
    });
});

// رندر هوشمند لیست ماژول‌های فروشگاه ارتقا
function renderUpgrades() {
    const container = document.getElementById('upgrades-container');
    container.innerHTML = '';
    
    Object.keys(upgradeSpecs).forEach(key => {
        const spec = upgradeSpecs[key];
        const lvl = state.upgrades[key];
        
        // فرمول افزایش قیمت تصاعدی مهندسی شده
        const cost = Math.floor(spec.baseCost * Math.pow(spec.costMultiplier, lvl - 1));
        const maxReached = (key === 'critChance' && lvl >= 1) || (key === 'autobot' && lvl >= 1);
        
        const card = document.createElement('div');
        card.classList.add('upgrade-card');
        card.innerHTML = `
            <div class="card-details">
                <h4>${spec.name} (لول ${lvl})</h4>
                <p>${spec.desc}</p>
                <div class="price">${maxReached ? 'سطح حداکثر' : `<i class="fa-solid fa-coins"></i> ${cost.toLocaleString()}`}</div>
            </div>
            <button class="btn-buy" ${state.score < cost || maxReached ? 'disabled' : ''} data-key="${key}" data-cost="${cost}">
                ${maxReached ? 'قفل' : 'ارتقا'}
            </button>
        `;
        container.appendChild(card);
    });
    
    // ایونت کلیک دکمه خرید ارتقا
    container.querySelectorAll('.btn-buy').forEach(btn => {
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

// رندر تقویم سیستم پاداش روزانه متوالی ۲۴ ساعته
function renderDailyGrid() {
    const grid = document.getElementById('daily-grid');
    grid.innerHTML = '';
    
    const now = Date.now();
    const canClaim = now - state.lastDailyClaim >= 24 * 60 * 60 * 1000; // دقیقاً ۲۴ ساعت بعد
    const missedStreak = now - state.lastDailyClaim > 48 * 60 * 60 * 1000; // ریست استریک در صورت تاخیر بیش از ۴۸ ساعت
    
    if (missedStreak && state.lastDailyClaim !== 0) {
        state.dailyStreak = 0;
    }
    
    for (let i = 0; i < 7; i++) {
        const box = document.createElement('div');
        box.classList.add('daily-day-box');
        if (i < state.dailyStreak) box.classList.add('claimed');
        if (i === state.dailyStreak && canClaim) box.classList.add('active');
        box.innerHTML = `<div>روز ${i+1}</div><div style="color:#f59e0b;font-weight:700;margin-top:3px;">+${config.dailyRewards[i]}</div>`;
        grid.appendChild(box);
    }
    
    const claimBtn = document.getElementById('claim-daily-btn');
    claimBtn.disabled = !canClaim;
}

document.getElementById('claim-daily-btn').addEventListener('click', () => {
    const now = Date.now();
    if (now - state.lastDailyClaim >= 24 * 60 * 60 * 1000) {
        const reward = config.dailyRewards[state.dailyStreak];
        state.score += reward;
        state.lastDailyClaim = now;
        state.dailyStreak = (state.dailyStreak + 1) % 7;
        triggerHaptic('success');
        saveState();
        updateUI();
        renderDailyGrid();
    }
});

// رندر داینامیک لیست ۵۰ دستاورد با بررسی وضعیت قفل یا دریافت پاداش
function renderAchievements() {
    const container = document.getElementById('achievements-container');
    container.innerHTML = '';
    
    globalAchievements.forEach(ach => {
        let currentProgress = 0;
        if(ach.type === 'taps') currentProgress = state.totalTaps;
        if(ach.type === 'score') currentProgress = state.score;
        if(ach.type === 'multitap' || ach.type === 'energyCap' || ach.type === 'recharge') currentProgress = state.upgrades[ach.type];
        
        const isCompleted = currentProgress >= ach.target;
        const isClaimed = state.claimedAchievements.includes(ach.id);
        
        const card = document.createElement('div');
        card.classList.add('achievement-card');
        card.innerHTML = `
            <div class="card-details">
                <h4>${ach.title}</h4>
                <p>${ach.desc} (${currentProgress.toLocaleString()}/${ach.target.toLocaleString()})</p>
                <div class="price" style="color:#10b981;"><i class="fa-solid fa-gift"></i> +${ach.reward}</div>
            </div>
            <button class="btn-status ${isClaimed ? 'claimed' : ''}" ${!isCompleted || isClaimed ? 'disabled' : ''} data-id="${ach.id}" data-reward="${ach.reward}">
                ${isClaimed ? 'دریافت شده' : (isCompleted ? 'دریافت پاداش' : 'قفل است')}
            </button>
        `;
        container.appendChild(card);
    });
    
    container.querySelectorAll('.btn-status').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const reward = parseInt(btn.getAttribute('data-reward'));
            
            if (!state.claimedAchievements.includes(id)) {
                state.score += reward;
                state.claimedAchievements.push(id);
                triggerHaptic('success');
                saveState();
                updateUI();
                renderAchievements();
            }
        });
    });
}

// محاسبه و پردازش ماژول استخراج پاداش آفلاین ربات (AutoBot Offline Mining)
function processOfflineMining() {
    const now = Date.now();
    if (state.upgrades.autobot > 0 && state.lastTime) {
        const elapsedSeconds = Math.floor((now - state.lastTime) / 1000);
        if (elapsedSeconds > 30) {
            // حداکثر سقف ۳ ساعت استخراج آفلاین (۱۰۸۰۰ ثانیه)
            const cappedSeconds = Math.min(elapsedSeconds, 3 * 60 * 60);
            const offlineEarnings = Math.floor(cappedSeconds * 0.2 * getCoinsPerTap());
            if (offlineEarnings > 0) {
                state.score += offlineEarnings;
                setTimeout(() => {
                    tg.showAlert(`ربات استخراج آفلاین در غیاب شما ${offlineEarnings.toLocaleString()} توکن برای شما ماین کرد!`);
                }, 1000);
            }
        }
    }
}

// رآکتور زمان‌بندی ثانیه‌ای پردازش موتور بازیابی انرژی + آنتی‌چیت مداوم زمان کلاینت
let lastIntervalCheck = Date.now();
setInterval(() => {
    if (antiCheat.isLocked) return;
    
    const now = Date.now();
    // چک کردن دستکاری تایم به صورت زنده زمان باز بودن بازی
    if (now < lastIntervalCheck - 100) {
        triggerSecurityLock("سیستم امنیتی تغییر دیتای فرکانس ساعت کلاینت را مهار کرد.");
        return;
    }
    lastIntervalCheck = now;
    
    // شارژ خودکار انرژی بر اساس رآکتور بازیابی لول‌آپ شده
    const maxE = getMaxEnergy();
    if (state.energy < maxE) {
        state.energy += getRechargeRate();
        if (state.energy > maxE) state.energy = maxE;
        updateUI();
    }
    saveState();
}, 1000);

// استارت نهایی و لود اولیه توابع بازی
processOfflineMining();
updateUI();
