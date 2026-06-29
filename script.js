// اتصال به تلگرام
const tg = window.Telegram.WebApp;
tg.expand(); 
if (tg.ready) tg.ready();

// مقادیر اولیه بازی
let score = parseInt(localStorage.getItem('bardia_score')) || 0;
let energy = parseInt(localStorage.getItem('bardia_energy')) || 1000;
const maxEnergy = 1000;
const energyRegenRate = 1; 

// فراخوانی المان‌ها
const scoreEl = document.getElementById('score');
const energyTextEl = document.getElementById('energy-text');
const energyFillEl = document.getElementById('energy-fill');
const coinEl = document.getElementById('coin');
const coinWrapper = document.getElementById('coin-wrapper');
const usernameEl = document.getElementById('username');

// هندل کردن نام کاربر تلگرام
if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    usernameEl.innerText = tg.initDataUnsafe.user.first_name;
} else {
    usernameEl.innerText = "کاربر تست تلگرام";
}

// سیستم مدیریت تب‌ها (Navigation Bar)
const navItems = document.querySelectorAll('.nav-item');
const gameTabs = document.querySelectorAll('.game-tab');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        // حذف حالت فعال از دکمه‌ها و تب‌های قبلی
        navItems.forEach(nav => nav.classList.remove('active'));
        gameTabs.forEach(tab => tab.classList.remove('active'));

        // فعال کردن دکمه فشرده شده
        item.classList.add('active');
        
        // پیدا کردن و نمایش تب مربوطه
        const targetTabId = item.getAttribute('data-tab');
        document.getElementById(targetTabId).classList.add('active');

        // ایجاد یک فیدبک لرزشی بسیار ریز موقع جابجایی منو
        if(tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
    });
});

// به‌روزرسانی ظاهر عددی مینی‌اپ
function updateUI() {
    scoreEl.innerText = score.toLocaleString();
    energyTextEl.innerText = `${energy}/${maxEnergy}`;
    const energyPercentage = (energy / maxEnergy) * 100;
    energyFillEl.style.width = `${energyPercentage}%`;
}

// انیمیشن تپ خوردن و عدد شناور
function createFloatingNumber(x, y) {
    const floatEl = document.createElement('div');
    floatEl.classList.add('floating-number');
    floatEl.innerText = '+1';
    
    floatEl.style.left = `${x - 20}px`;
    floatEl.style.top = `${y - 40}px`;
    
    coinWrapper.appendChild(floatEl);

    setTimeout(() => {
        floatEl.remove();
    }, 800);
}

// منطق ضربه زدن روی سکه
coinEl.addEventListener('pointerdown', (e) => {
    if (energy > 0) {
        score += 1;
        energy -= 1;
        
        localStorage.setItem('bardia_score', score);
        localStorage.setItem('bardia_energy', energy);
        
        updateUI();
        
        // ویبره زدن واقعی گوشی در تلگرام
        if (tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('medium');
        }

        // محاسبه دقیق مختصات نقطه تاچ
        const rect = coinWrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        createFloatingNumber(x, y);
    } else {
        if (tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('error');
        }
    }
});

// پر شدن خودکار انرژی (بازیابی ثانیه‌ای)
setInterval(() => {
    if (energy < maxEnergy) {
        energy += energyRegenRate;
        if (energy > maxEnergy) energy = maxEnergy;
        localStorage.setItem('bardia_energy', energy);
        updateUI();
    }
}, 1000);

// لود اولیه دیتای دیتابیس محلی
updateUI();
