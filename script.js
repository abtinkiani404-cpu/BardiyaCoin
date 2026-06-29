// اتصال امن به API تلگرام وب‌اپ
const tg = window.Telegram.WebApp;
tg.expand(); 
if (tg.ready) tg.ready();

// تنظیمات انرژی روی ۲۰۰ برای شروع و بهینه‌سازی سرعت بازی
const maxEnergy = 200;
const energyRegenRate = 1; // شارژ مجدد ۱ واحد در ثانیه

let score = parseInt(localStorage.getItem('bardia_cute_score')) || 0;
let energy = parseInt(localStorage.getItem('bardia_cute_energy'));

// اگر دفعه اول بود یا دیتایی نبود انرژی روی ۲۰۰ تنظیم بشه
if (isNaN(energy) || energy === null) {
    energy = maxEnergy;
}

// المان‌های DOM مینی‌اپ
const scoreEl = document.getElementById('score');
const energyTextEl = document.getElementById('energy-text');
const energyFillEl = document.getElementById('energy-fill');
const coinEl = document.getElementById('coin');
const coinWrapper = document.getElementById('coin-wrapper');
const usernameEl = document.getElementById('username');
const userAvatarEl = document.getElementById('user-avatar');

// دریافت و قرار دادن نام و عکس واقعی پروفایل از تلگرام
if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    const user = tg.initDataUnsafe.user;
    
    // ست کردن اسم کوچک کاربر
    usernameEl.innerText = user.first_name || "کاربر تلگرام";
    
    // دریافت هوشمند آواتار واقعی تلگرام
    if (user.photo_url) {
        userAvatarEl.src = user.photo_url;
    }
} else {
    usernameEl.innerText = "طراح ربات (تست)";
}

// سیستم پیشرفته مدیریت تب‌های پایینی
const navBtns = document.querySelectorAll('.nav-btn');
const gameTabs = document.querySelectorAll('.game-tab');

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        gameTabs.forEach(t => t.classList.remove('active'));

        btn.classList.add('active');
        const targetTab = btn.getAttribute('data-tab');
        document.getElementById(targetTab).classList.add('active');

        // ویبره حبابی و نرم تلگرام موقع جابجایی تب‌ها
        if(tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
    });
});

// به‌روزرسانی رابط کاربری (UI) با محاسبات بهینه
function updateUI() {
    scoreEl.innerText = score.toLocaleString();
    energyTextEl.innerText = `${energy} / ${maxEnergy}`;
    
    // محاسبه درصد پیشرفت نوار انرژی
    const energyPercentage = (energy / maxEnergy) * 100;
    energyFillEl.style.width = `${energyPercentage}%`;
}

// ساخت حباب شناور +1 پاستلی
function createCuteNumber(x, y) {
    const floatNumber = document.createElement('div');
    floatNumber.classList.add('floating-number');
    floatNumber.innerText = '+1';
    
    floatNumber.style.left = `${x - 20}px`;
    floatNumber.style.top = `${y - 40}px`;
    
    coinWrapper.appendChild(floatNumber);

    // حذف حباب از DOM پس از پایان انیمیشن برای بهینه‌سازی رم گوشی
    setTimeout(() => {
        floatNumber.remove();
    }, 700);
}

// رویداد تپ روی صورت بردیا (با پشتیبانی از Pointer برای سرعت بالاتر)
coinEl.addEventListener('pointerdown', (e) => {
    if (energy > 0) {
        score += 1;
        energy -= 1;
        
        localStorage.setItem('bardia_cute_score', score);
        localStorage.setItem('bardia_cute_energy', energy);
        
        updateUI();
        
        // ویبره جذاب ضربه‌ای میان‌رده تلگرام (حس لمس دکمه ژله‌ای)
        if (tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('medium');
        }

        // موقعیت‌یابی دقیق تپ انگشت
        const rect = coinWrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const "y" = e.clientY - rect.top;
        
        createCuteNumber(x, y);
    } else {
        // ویبره اخطار در صورت تمام شدن انرژی
        if (tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('error');
        }
    }
});

// سیستم ريجنریت (شارژ خودکار ثانیه‌ای) انرژی بدون افت فریم
setInterval(() => {
    if (energy < maxEnergy) {
        energy += energyRegenRate;
        if (energy > maxEnergy) energy = maxEnergy;
        localStorage.setItem('bardia_cute_energy', energy);
        updateUI();
    }
}, 1000);

// لود نهایی در اولین اجرا
updateUI();
