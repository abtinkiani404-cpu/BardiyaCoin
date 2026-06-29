// اتصال به تلگرام
const tg = window.Telegram.WebApp;
tg.expand(); // باز شدن مینی‌اپ در حالت تمام صفحه

// تنظیمات اولیه بازی
let score = parseInt(localStorage.getItem('bardia_score')) || 0;
let energy = parseInt(localStorage.getItem('bardia_energy')) || 1000;
const maxEnergy = 1000;
const energyRegenRate = 1; // مقدار شارژ انرژی در هر ثانیه

// دریافت المان‌های صفحه
const scoreEl = document.getElementById('score');
const energyTextEl = document.getElementById('energy-text');
const energyFillEl = document.getElementById('energy-fill');
const coinEl = document.getElementById('coin');
const coinWrapper = document.getElementById('coin-wrapper');
const usernameEl = document.getElementById('username');

// نمایش اسم کاربر تلگرام (اگر موجود بود)
if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    usernameEl.innerText = tg.initDataUnsafe.user.first_name;
} else {
    usernameEl.innerText = "مهمان ناخوانده";
}

// تابع آپدیت کردن رابط کاربری
function updateUI() {
    scoreEl.innerText = score.toLocaleString();
    energyTextEl.innerText = `${energy} / ${maxEnergy}`;
    const energyPercentage = (energy / maxEnergy) * 100;
    energyFillEl.style.width = `${energyPercentage}%`;
}

// ایجاد انیمیشن شناور +1
function createFloatingNumber(x, y) {
    const floatEl = document.createElement('div');
    floatEl.classList.add('floating-number');
    floatEl.innerText = '+1';
    
    // تنظیم موقعیت دقیق روی جایی که کلیک شده
    floatEl.style.left = `${x - 15}px`;
    floatEl.style.top = `${y - 30}px`;
    
    coinWrapper.appendChild(floatEl);

    // حذف عنصر بعد از پایان انیمیشن تا رم گوشی پر نشه
    setTimeout(() => {
        floatEl.remove();
    }, 1000);
}

// هندل کردن رویداد کلیک/تاچ روی سکه
coinEl.addEventListener('pointerdown', (e) => {
    if (energy > 0) {
        // افزایش امتیاز و کاهش انرژی
        score += 1;
        energy -= 1;
        
        // ذخیره در مرورگر
        localStorage.setItem('bardia_score', score);
        localStorage.setItem('bardia_energy', energy);
        
        updateUI();
        
        // اجرای ویبره تلگرام (Haptic Feedback)
        tg.HapticFeedback.impactOccurred('light');

        // گرفتن مختصات کلیک برای انیمیشن
        const rect = coinWrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        createFloatingNumber(x, y);
    } else {
        // وقتی انرژی تموم میشه یه ویبره خطا میده
        tg.HapticFeedback.notificationOccurred('error');
    }
});

// پر شدن خودکار انرژی هر یک ثانیه
setInterval(() => {
    if (energy < maxEnergy) {
        energy += energyRegenRate;
        if (energy > maxEnergy) energy = maxEnergy;
        localStorage.setItem('bardia_energy', energy);
        updateUI();
    }
}, 1000);

// نمایش اولیه دیتا
updateUI();
