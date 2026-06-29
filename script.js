// دریافت امن متغیر وب‌اپ تلگرام
const tg = window.Telegram.WebApp;
tg.expand(); 
if (tg.ready) tg.ready();

// بهینه‌سازی دیتای انرژی روی ۲۰۰ واحد طبق درخواست شما
const maxEnergy = 200;
const energyRegenRate = 1; 

let score = parseInt(localStorage.getItem('bardia_pro_score')) || 0;
let energy = parseInt(localStorage.getItem('bardia_pro_energy'));

if (isNaN(energy) || energy === null) {
    energy = maxEnergy;
}

// رندر دام (DOM Elements)
const scoreEl = document.getElementById('score');
const energyTextEl = document.getElementById('energy-text');
const energyFillEl = document.getElementById('energy-fill');
const coinEl = document.getElementById('coin');
const coinWrapper = document.getElementById('coin-wrapper');
const usernameEl = document.getElementById('username');
const userAvatarEl = document.getElementById('user-avatar');
const avatarFallbackEl = document.getElementById('user-avatar-fallback');

// منطق هوشمند بارگذاری هویت کاربر واقعی تلگرام
if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    const user = tg.initDataUnsafe.user;
    usernameEl.innerText = (user.first_name || "MEMBER").toUpperCase();
    
    if (user.photo_url) {
        userAvatarEl.src = user.photo_url;
        userAvatarEl.style.display = 'block';
        avatarFallbackEl.style.display = 'none';
    } else {
        // ایجاد خودکار آواتار با کاراکتر اول نام کاربر در صورت عدم وجود آواتار تلگرامی
        const initial = user.first_name ? user.first_name.charAt(0).toUpperCase() : "U";
        avatarFallbackEl.innerText = initial;
    }
} else {
    usernameEl.innerText = "DEV_MODE";
}

// اصلاح سیستم سوئیچ منوها (Navigation Bar) - کاملاً عملیاتی
const navNodes = document.querySelectorAll('.nav-node');
const appTabs = document.querySelectorAll('.app-tab');

navNodes.forEach(node => {
    node.addEventListener('click', () => {
        navNodes.forEach(n => n.classList.remove('active'));
        appTabs.forEach(t => t.classList.remove('active'));

        node.classList.add('active');
        const targetTabId = node.getAttribute('data-tab');
        document.getElementById(targetTabId).classList.add('active');

        // بازخورد لرزشی کلیک منو در تلگرام موبایل
        if(tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
    });
});

// به‌روزرسانی آنی و روان دیتای رابط کاربری
function updateUI() {
    scoreEl.innerText = score.toLocaleString();
    energyTextEl.innerText = `${energy} / ${maxEnergy}`;
    
    const energyPercentage = (energy / maxEnergy) * 100;
    energyFillEl.style.width = `${energyPercentage}%`;
}

// ساخت انیمیشن پاپ‌آپ عدد استخراج طلایی (فیکس کامل متغیر y)
function createTechNumber(x, y) {
    const floatNumber = document.createElement('div');
    floatNumber.classList.add('floating-number');
    floatNumber.innerText = '+1';
    
    floatNumber.style.left = `${x - 15}px`;
    floatNumber.style.top = `${y - 35}px`;
    
    coinWrapper.appendChild(floatNumber);

    setTimeout(() => {
        floatNumber.remove();
    }, 600);
}

// رویداد تپ استخراج (Pointerdown برای پاسخ‌دهی صدم‌ثانیه‌ای بدون لنگ زدن)
coinEl.addEventListener('pointerdown', (e) => {
    if (energy > 0) {
        score += 1;
        energy -= 1;
        
        localStorage.setItem('bardia_pro_score', score);
        localStorage.setItem('bardia_pro_energy', energy);
        
        updateUI();
        
        // بازخورد لرزشی ضربه میان‌رده تلگرام
        if (tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('medium');
        }

        // مختصات‌گیری کاملاً مهندسی شده و بدون خطا
        const rect = coinWrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top; // فیکس اساسی اشکال تایپی قبلی
        
        createTechNumber(x, y);
    } else {
        if (tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('error');
        }
    }
});

// موتور ریکاوری و شارژ هسته انرژی (ثانیه‌ای ۱ واحد)
setInterval(() => {
    if (energy < maxEnergy) {
        energy += energyRegenRate;
        if (energy > maxEnergy) energy = maxEnergy;
        localStorage.setItem('bardia_pro_energy', energy);
        updateUI();
    }
}, 1000);

// اجرای لود اولیه بدون تاخیر
updateUI();
