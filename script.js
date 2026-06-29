const tg = window.Telegram.WebApp;
tg.expand();
if (tg.ready) tg.ready();

// تنظیمات SweetAlert برای فیکس شدن اسکرول صفحه
const swalConfig = Swal.mixin({ heightAuto: false, scrollbarPadding: false, confirmButtonText: 'تایید' });

// دیتابیس لوکال
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

const config = { baseMaxEnergy: 200, energyPerLevel: 100, baseRechargeRate: 3, dailyRewards: [500, 1000, 2500, 5000, 10000, 25000, 50000] };

const upgradesData = {
    multitap: { name: "قدرت کلیک", desc: "افزایش سکه با هر تپ", baseCost: 1500, mult: 2.5 },
    energyCap: { name: "مخزن انرژی", desc: "ظرفیت انرژی بیشتر", baseCost: 2000, mult: 2.2 },
    recharge: { name: "شارژ سریع", desc: "پر شدن سریع‌تر", baseCost: 4000, mult: 2.8 },
    critChance: { name: "ضربه جادویی", desc: "احتمال ۵ برابر شدن سکه", baseCost: 15000, mult: 4.0 },
    autobot: { name: "ربات آفلاین", desc: "استخراج موقع خروج", baseCost: 100000, mult: 5.0 }
};

// تولید مأموریت‌ها
function generateAchievements() {
    let list = [];
    const tapGoals = [100, 500, 1000, 5000, 10000, 25000, 50000, 100000];
    tapGoals.forEach((g, i) => list.push({ id: `t_${i}`, title: `تپ‌زن حرفه‌ای ${i+1}`, desc: `${g.toLocaleString()} بار ضربه بزن`, target: g, type: 'taps', reward: g * 2 }));
    
    const scoreGoals = [5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000];
    scoreGoals.forEach((g, i) => list.push({ id: `s_${i}`, title: `میلیونر ${i+1}`, desc: `${g.toLocaleString()} سکه جمع کن`, target: g, type: 'score', reward: Math.floor(g * 0.1) }));
    
    for(let i=2; i<=10; i++) list.push({ id: `m_${i}`, title: `قدرت لول ${i}`, desc: `قدرت کلیک رو به ${i} برسون`, target: i, type: 'multitap', reward: i * 2000 });
    for(let i=2; i<=10; i++) list.push({ id: `e_${i}`, title: `مخزن لول ${i}`, desc: `مخزن انرژی رو به ${i} برسون`, target: i, type: 'energyCap', reward: i * 3000 });
    return list;
}
const allAchievements = generateAchievements();

// لود پروفایل
function loadProfile() {
    const user = tg.initDataUnsafe?.user;
    const cont = document.getElementById('avatar-container');
    if (user) {
        document.getElementById('username').innerText = user.first_name;
        if (user.photo_url) cont.innerHTML = `<img src="${user.photo_url}" class="avatar-img">`;
        else cont.innerHTML = `<div class="avatar-text">${user.first_name.charAt(0)}</div>`;
    } else {
        document.getElementById('username').innerText = "توسعه دهنده";
        cont.innerHTML = `<div class="avatar-text">D</div>`;
    }
}
loadProfile();

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

// -------------------------
// آنتی چیت 
// -------------------------
let tapTimes = [];
function verifyTouch(count) {
    const now = Date.now();
    for(let i=0; i<count; i++) tapTimes.push(now);
    tapTimes = tapTimes.filter(t => now - t < 1000);
    if (tapTimes.length > 30) { tapTimes = []; return false; }
    return true;
}

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

coinEl.addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    if (state.energy < 1) return;
    
    const touches = e.changedTouches;
    const count = touches.length;
    
    if (!verifyTouch(count)) {
        state.warnings++;
        if(state.warnings >= 3) {
            localStorage.clear();
            swalConfig.fire({title:'حذف اکانت', text:'تقلب تشخیص داده شد.', icon:'error'}).then(()=>location.reload());
        } else {
            swalConfig.fire({title:'اخطار', text:'سرعت لمس غیرطبیعی است!', icon:'warning'});
        }
        return;
    }
    
    coinEl.classList.add('touch-active');
    setTimeout(() => coinEl.classList.remove('touch-active'), 50);

    for (let i = 0; i < count; i++) {
        if (state.energy < 1) break;
        
        let power = state.upgrades.multitap;
        let isCrit = false;
        if (state.upgrades.critChance > 0 && Math.random() < 0.05) { power *= 5; isCrit = true; state.critsHit++; }
        
        state.score += power; state.lifetimeScore += power;
        state.energy -= 1; state.totalTaps += 1;
        
        const rect = coinWrapper.getBoundingClientRect();
        const x = touches[i].clientX - rect.left;
        const y = touches[i].clientY - rect.top;
        
        const pop = document.createElement('div');
        pop.className = 'floating-number';
        pop.innerText = `+${power}`;
        if (isCrit) { pop.style.color = '#fbbf24'; pop.style.fontSize = '3.5rem'; pop.innerText += "!"; }
        pop.style.left = `${x - 20}px`;
        pop.style.top = `${y - 40}px`;
        coinWrapper.appendChild(pop);
        setTimeout(() => pop.remove(), 600);
    }
    
    if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    updateUI(); checkBadges();
}, {passive: false});

// -------------------------
// نوتیفیکیشن
// -------------------------
function checkBadges() {
    let show = false;
    const now = Date.now();
    if (now - state.lastDailyClaim >= 86400000) show = true;
    else {
        for (let ach of allAchievements) {
            if (!state.claimedAchs.includes(ach.id)) {
                let prog = ach.type === 'taps' ? state.totalTaps : (ach.type === 'score' ? state.lifetimeScore : state.upgrades[ach.type]);
                if(prog >= ach.target) { show = true; break; }
            }
        }
    }
    const b = document.getElementById('badge-ach');
    if (show) b.classList.add('show'); else b.classList.remove('show');
}

// -------------------------
// نویگیشن شناور
// -------------------------
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-tab');
        document.getElementById(target).classList.add('active');
        if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        
        if (target === 'tab-upgrades') renderUpgrades();
        if (target === 'tab-achievements') { renderDaily(); renderAchievements(); }
        if (target === 'tab-stats') {
            document.getElementById('stat-total-taps').innerText = state.totalTaps.toLocaleString();
            document.getElementById('stat-lifetime-score').innerText = state.lifetimeScore.toLocaleString();
            document.getElementById('stat-offline-earnings').innerText = state.offlineEarnings.toLocaleString();
            document.getElementById('stat-crits').innerText = state.critsHit.toLocaleString();
            const sEl = document.getElementById('stat-cheat-status');
            if (state.warnings === 0) { sEl.innerText = "سالم"; sEl.style.color = "#10b981"; }
            else { sEl.innerText = "اخطار تقلب"; sEl.style.color = "#ef4444"; }
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
                    <h4>${spec.name} <span class="lvl-badge">Lvl ${lvl}</span></h4>
                    <p>${spec.desc}</p>
                </div>
                <button class="btn-action ${canBuy ? 'btn-buy' : 'locked'}" ${!canBuy ? 'disabled' : ''} onclick="buyUp('${k}', ${cost})">
                    ${maxed ? 'کامل' : `خرید <span class="price">${cost.toLocaleString()}</span>`}
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
        btn.disabled = false; btn.className = 'btn-claim-large ready';
        btn.innerText = "دریافت پاداش امروز";
        btn.onclick = () => {
            const r = config.dailyRewards[state.dailyStreak];
            state.score += r; state.lifetimeScore += r;
            state.lastDailyClaim = Date.now();
            state.dailyStreak = (state.dailyStreak + 1) % 7;
            if (typeof confetti !== "undefined") confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            saveState(); updateUI(); renderDaily(); checkBadges();
        };
    } else {
        btn.disabled = true; btn.className = 'btn-claim-large';
        const tl = (state.lastDailyClaim + 86400000) - now;
        btn.innerText = `دریافت بعدی: ${Math.floor(tl / 3600000).toString().padStart(2,'0')}:${Math.floor((tl % 3600000) / 60000).toString().padStart(2,'0')}`;
    }
}

function renderAchievements() {
    const cont = document.getElementById('achievements-container');
    cont.innerHTML = '';
    let found = false;
    allAchievements.forEach(ach => {
        if (state.claimedAchs.includes(ach.id)) return;
        found = true;
        let prog = ach.type === 'taps' ? state.totalTaps : (ach.type === 'score' ? state.lifetimeScore : state.upgrades[ach.type]);
        const done = prog >= ach.target;
        
        cont.innerHTML += `
            <div class="list-item">
                <div class="item-info">
                    <h4>${ach.title}</h4>
                    <p>${ach.desc}</p>
                </div>
                <button class="btn-action ${done ? 'btn-claim' : 'locked'}" ${!done ? 'disabled' : ''} onclick="claimAch('${ach.id}', ${ach.reward})">
                    ${done ? `دریافت <span class="reward">+${ach.reward.toLocaleString()}</span>` : `${Math.min(100, Math.floor((prog/ach.target)*100))}%`}
                </button>
            </div>
        `;
    });
    if (!found) cont.innerHTML = '<p style="text-align:center; color:#10b981; padding:20px; font-size:12px;">شما تمام جوایز را گرفتید!</p>';
}
window.claimAch = function(id, reward) {
    state.score += reward; state.lifetimeScore += reward; state.claimedAchs.push(id);
    if (typeof confetti !== "undefined") confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    saveState(); updateUI(); renderAchievements(); checkBadges();
}

// -------------------------
// سیستم‌های پیش‌زمینه
// -------------------------
window.devResetGame = function() {
    swalConfig.fire({
        title: 'ریست اکانت؟', text: 'دیتای شما کاملا پاک میشود.', icon: 'warning',
        showCancelButton: true, confirmButtonText: 'بله، پاک کن', cancelButtonText: 'انصراف'
    }).then((res) => { if(res.isConfirmed){ localStorage.clear(); location.reload(); }});
}

function processOffline() {
    const now = Date.now();
    if (state.upgrades.autobot > 0 && state.lastTime) {
        const elap = Math.floor((now - state.lastTime) / 1000);
        if (elap > 60) {
            const earned = Math.floor(Math.min(elap, 10800) * 0.5 * state.upgrades.multitap);
            if (earned > 0) {
                state.score += earned; state.lifetimeScore += earned; state.offlineEarnings += earned;
                swalConfig.fire({ title: 'گزارش ربات', text: `${earned.toLocaleString()} سکه در غیاب شما جمع شد!`, icon: 'success' });
            }
        }
    }
}

setInterval(() => {
    const btn = document.getElementById('claim-daily-btn');
    if (btn && btn.disabled) {
        const tl = (state.lastDailyClaim + 86400000) - Date.now();
        if (tl <= 0) { renderDaily(); checkBadges(); }
    }
    const diff = new Date("2026-07-05T00:00:00Z").getTime() - Date.now();
    if (diff > 0) {
        document.getElementById('cd-d').innerText = Math.floor(diff / 86400000).toString().padStart(2,'0');
        document.getElementById('cd-h').innerText = Math.floor((diff % 86400000) / 3600000).toString().padStart(2,'0');
        document.getElementById('cd-m').innerText = Math.floor((diff % 3600000) / 60000).toString().padStart(2,'0');
        document.getElementById('cd-s').innerText = Math.floor((diff % 60000) / 1000).toString().padStart(2,'0');
    }
    saveState();
}, 1000);

// پر شدن انرژی هر ۳ ثانیه
setInterval(() => {
    const maxE = config.baseMaxEnergy + ((state.upgrades.energyCap - 1) * config.energyPerLevel);
    if (state.energy < maxE) {
        state.energy += (config.baseRechargeRate + (state.upgrades.recharge - 1)) * 3; 
        if(state.energy > maxE) state.energy = maxE; 
        updateUI(); 
    }
}, 3000);

processOffline(); updateUI(); checkBadges();
