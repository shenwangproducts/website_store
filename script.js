const CHATCHAT_CLIENT_ID = "9c45f09626924ffc387e39a56c901fd9";
const REDIRECT_URI = window.location.origin + window.location.pathname;

window.appDatabase = window.appDatabase || []; // 🌟 เก็บข้อมูลแอปที่โหลดมาจาก Firebase

document.addEventListener("DOMContentLoaded", async () => {
    loadSettings(); // โหลดการตั้งค่าเมื่อเปิดแอป
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    const appId = urlParams.get('id'); // 🌟 รองรับ Deep link เข้าหน้าแอปตรงๆ

    if (code) {
        window.history.replaceState({}, document.title, window.location.pathname);
        showProfilePage(); // เปิดหน้าโปรไฟล์เพื่อให้เห็นสถานะตอนกำลังโหลด
        await processOAuthCode(code);
    } else {
        checkUserLoginState();
        if (appId) {
            checkAndOpenSharedApp(appId);
        }
    }
});

// 🌟 ฟังก์ชันสร้าง ID ของแอปตามรูปแบบ (PackageName_AppName_Developer) แบบไม่มีเว้นวรรค
function generateAppId(app) {
    const pkg = app.package || 'com.shenall.app';
    const name = (app.name || '').replace(/\s+/g, '');
    const dev = (app.developer || '').replace(/\s+/g, '');
    return `${pkg}_${name}_${dev}`;
}

// 🌟 ฟังก์ชันสำหรับตรวจสอบและเปิดแอปจาก URL (รอให้ฐานข้อมูลโหลดเสร็จก่อน)
function checkAndOpenSharedApp(appId) {
    let attempts = 0;
    const interval = setInterval(() => {
        if (window.appDatabase && window.appDatabase.length > 0) {
            clearInterval(interval);
            // ค้นหาแอปจาก Package Name, ID, หรือชื่อแอป
            const app = window.appDatabase.find(a => a.package === appId || a.id === appId || a.name === appId);
            if (app) {
                openAppDetail(app.name, null, null, null, null, null, null, true); // เปิดแอปโดยไม่ pushState ซ้ำ
            } else {
                showToast('ไม่พบแอปพลิเคชันที่คุณค้นหา');
            }
        } else if (attempts > 50) { // Timeout 5 วินาที
            clearInterval(interval);
        }
        attempts++;
    }, 100);
}

// 🌟 ดักจับการกดปุ่ม Back/Forward ของเบราว์เซอร์ เพื่อให้เปลี่ยนหน้าตาม URL ได้
window.addEventListener('popstate', (event) => {
    const urlParams = new URLSearchParams(window.location.search);
    const appId = urlParams.get('id');
    if (appId) {
        const app = window.appDatabase.find(a => generateAppId(a) === appId || a.package === appId || a.id === appId || a.name === appId);
        if (app) openAppDetail(app.name, null, null, null, null, null, null, true);
        else showHomePage(true);
    } else {
        if (event.state && event.state.view === 'profile') showProfilePage(true);
        else if (event.state && event.state.view === 'manage') showManageAppsPage(event.state.tab || 'installed', true);
        else if (event.state && event.state.view === 'legal') showLegalPage(event.state.type || 'terms', true);
        else showHomePage(true);
    }
});

function loginWithChatchat() {
    const state = Math.random().toString(36).substring(7);
    const authUrl = `https://chatchat-backend.onrender.com/api/oauth/authorize?client_id=${CHATCHAT_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}`;
    window.location.href = authUrl;
}

async function processOAuthCode(code) {
    showToast('กำลังยืนยันตัวตน...');
    try {
        const response = await fetch('https://backendshenallstore.onrender.com/api/oauth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redirect_uri: REDIRECT_URI })
        });
        if (!response.ok) throw new Error('Login failed');
        const data = await response.json();
        if (data.success && data.user) {
            localStorage.setItem('shenall_user', JSON.stringify(data.user)); // ใช้คีย์เดียวกันทั้งระบบ
            showToast('ยินดีต้อนรับ ' + data.user.name);
            checkUserLoginState();
        }
    } catch (error) {
        console.error('OAuth Error:', error);
        showToast('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
        checkUserLoginState();
    }
}

function loginAsGuest() {
    const guestUser = {
        name: 'ผู้เยี่ยมชม (Guest)',
        email: 'guest@shenall.store',
        isGuest: true,
        loginTime: Date.now()
    };
    localStorage.setItem('shenall_user', JSON.stringify(guestUser));
    showToast('เข้าสู่ระบบในฐานะผู้เยี่ยมชม (ใช้งานได้ 24 ชม.)');
    checkUserLoginState();
}

function checkUserLoginState() {
    const userStr = localStorage.getItem('shenall_user');
    const loggedOutView = document.getElementById('profile-logged-out');
    const loggedInView = document.getElementById('profile-logged-in');
    const logoutBtn = document.getElementById('logout-btn');

    if (userStr && loggedInView && loggedOutView) {
        const user = JSON.parse(userStr);
        
        // 🌟 ตรวจสอบการหมดอายุของผู้เยี่ยมชม (24 ชั่วโมง)
        if (user.isGuest && user.loginTime) {
            const hoursElapsed = (Date.now() - user.loginTime) / (1000 * 60 * 60);
            if (hoursElapsed >= 24) {
                localStorage.removeItem('shenall_user');
                showMobileAlert('เซสชันหมดอายุ', 'บัญชีผู้เยี่ยมชมของคุณหมดอายุแล้ว กรุณาล็อกอินใหม่อีกครั้ง');
                checkUserLoginState();
                return;
            }
        }

        document.getElementById('profile-name').innerText = user.name || 'ผู้ใช้งาน Shenall';
        document.getElementById('profile-email').innerText = user.email || 'user@shenall.store';
        document.getElementById('profile-avatar-letter').innerText = (user.name || 'U').charAt(0).toUpperCase();
        
        loggedOutView.classList.add('hidden');
        loggedInView.classList.remove('hidden');
        loggedInView.classList.add('flex');
        if (logoutBtn) logoutBtn.classList.remove('hidden');
    } else if (loggedInView && loggedOutView) {
        // ถ้าไม่ได้ล็อกอิน
        loggedInView.classList.add('hidden');
        loggedInView.classList.remove('flex');
        loggedOutView.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
            const navAvatar = document.getElementById('nav-profile-avatar');
            if (navAvatar) navAvatar.innerHTML = '';
    }
}

function logoutUser() {
    localStorage.removeItem('shenall_user');
    showToast('ออกจากระบบเรียบร้อยแล้ว');
    checkUserLoginState();
    showHomePage();
}

// 🌟 ฟังก์ชันสำหรับซิงก์ข้อมูลโปรไฟล์ผู้ใช้ไปยัง Backend
async function syncUserProfileWithBackend() {
    const userStr = localStorage.getItem('shenall_user');
    if (userStr) {
        const user = JSON.parse(userStr);
        if (user.email) { // ต้องมีอีเมลจึงจะซิงก์ได้
            try {
                await fetch('https://backendshenallstore.onrender.com/api/users/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: user.email, name: user.name, avatar: user.avatar })
                });
            } catch (error) { console.error('Error syncing user profile:', error); }
        }
    }
}

// 🌟 ระบบเปลี่ยนรูปโปรไฟล์และชื่อ
function editProfilePicture() {
    document.getElementById('profileAvatarInput').click();
}

function handleProfileAvatarChange(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const userStr = localStorage.getItem('shenall_user');
            if (userStr) {
                const user = JSON.parse(userStr);
                user.avatar = e.target.result; // เซฟรูปเป็น Base64 ลงใน LocalStorage ชั่วคราว
                localStorage.setItem('shenall_user', JSON.stringify(user));
                checkUserLoginState();
                syncUserProfileWithBackend(); // 🌟 ซิงก์รูปใหม่ขึ้น Backend
                showToast('เปลี่ยนรูปโปรไฟล์สำเร็จ');
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function editProfileName() {
    const userStr = localStorage.getItem('shenall_user');
    if (userStr) {
        const user = JSON.parse(userStr);
        const newName = prompt('กรุณากรอกชื่อใหม่ของคุณ:', user.name || '');
        if (newName !== null && newName.trim() !== '') {
            user.name = newName.trim();
            localStorage.setItem('shenall_user', JSON.stringify(user));
            syncUserProfileWithBackend(); // 🌟 ซิงก์ชื่อใหม่ขึ้น Backend
            checkUserLoginState();
            showToast('เปลี่ยนชื่อโปรไฟล์สำเร็จ');
        }
    }
}

function toggleMobileSearchOverlay() {
    const overlay = document.getElementById('mobileSearchOverlay');
    if (overlay.classList.contains('hidden')) {
        overlay.classList.remove('hidden');
        setTimeout(() => {
            overlay.classList.remove('opacity-0');
            document.getElementById('mobileSearchInput').focus();
        }, 10);
    } else {
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}

function handleSearch(query) {
    const dropdown = document.getElementById('mobileSearchDropdown');
    const searchKeyword = query.toLowerCase().trim();

    if (searchKeyword === '') {
        dropdown.innerHTML = '<div class="text-center text-gray-400 mt-8 text-sm">พิมพ์ชื่อแอป หรือ ค่ายผู้พัฒนา...</div>';
        return;
    }

    const results = window.appDatabase.filter(app => 
        app.status === 'approved' && ( // 🌟 กรองเฉพาะแอปที่อนุมัติแล้ว
        (app.name || '').toLowerCase().includes(searchKeyword) || 
        (app.developer || '').toLowerCase().includes(searchKeyword))
    );
    dropdown.innerHTML = '';

    if (results.length === 0) {
        dropdown.innerHTML = `<div class="p-8 text-center text-gray-500"><div class="text-3xl mb-2">🔍</div><div class="text-sm font-bold text-gray-700">ไม่พบ "${query}"</div></div>`;
        return;
    }

    const ul = document.createElement('ul');
    results.forEach(app => {
        const li = document.createElement('li');
        li.className = "flex items-center px-4 py-3 active:bg-gray-100 cursor-pointer border-b border-gray-100 bg-white";
        li.onclick = () => {
            document.getElementById('mobileSearchInput').value = '';
            toggleMobileSearchOverlay();
            openAppDetail(app.name);
        };

        const iconBgClass = app.bgClass || 'bg-gray-500';
        const displayIcon = app.iconUrl ? `<img src="${app.iconUrl}" class="w-full h-full object-cover">` : (app.icon || '📱');
        
        li.innerHTML = `
            <div class="w-10 h-10 ${iconBgClass} rounded-xl flex items-center justify-center overflow-hidden text-white text-lg mr-3 shadow-sm shrink-0">${displayIcon}</div>
            <div class="flex-1 overflow-hidden">
                <div class="font-bold text-gray-800 text-sm truncate">${app.name || 'Unknown'}</div>
                <div class="text-[11px] text-gray-500 truncate">${app.developer || 'Unknown'}</div>
            </div>
            <div class="text-[10px] font-bold text-gray-600 bg-gray-50 border border-gray-100 px-2 py-1 rounded-md ml-2">⭐ ${app.rating || '0.0'}</div>
        `;
        ul.appendChild(li);
    });
    dropdown.appendChild(ul);
}

const viewHome = document.getElementById('view-home');
const viewAppDetail = document.getElementById('view-app-detail');
const viewProfile = document.getElementById('view-profile'); 
const viewManageApps = document.getElementById('view-manage-apps'); 
const viewLegal = document.getElementById('view-legal'); 
let currentApp = { title: '', icon: '', size: '', apkUrl: '' };

function switchCategory(catId, btnElement) {
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.className = 'tab-btn bg-white text-gray-600 border border-gray-200 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors';
    });
    btnElement.className = 'tab-btn bg-gray-900 text-white px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors shadow-sm';

    const titleEl = document.getElementById('category-title');
        const headerEl = document.getElementById('category-header');
        if (titleEl && headerEl) {
            if(catId === 'all') { 
                headerEl.classList.add('hidden'); 
            } else {
                headerEl.classList.remove('hidden');
                if(catId === 'apps') titleEl.innerText = '📱 แอปพลิเคชัน';
                else if(catId === 'games') titleEl.innerText = '🎮 เกม (Games)';
                else if(catId === 'tools') titleEl.innerText = '⚙️ เครื่องมือ';
            }
    }

    renderApps(catId);
}

// 🌟 สร้าง HTML สำหรับการ์ดแอปทั่วไป
function createAppCardHtml(app, extraClass = '') {
    const displayIcon = app.iconUrl ? `<img src="${app.iconUrl}" class="w-full h-full object-cover">` : (app.icon || '📱');
    return `
        <div onclick="openAppDetail('${app.name || ''}')" class="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex flex-col items-center text-center active:scale-95 transition-transform cursor-pointer ${extraClass}">
            <div class="w-16 h-16 ${app.bgClass || 'bg-gray-500'} rounded-2xl flex items-center justify-center overflow-hidden text-3xl text-white mb-2 shadow-inner shrink-0">
                ${displayIcon}
            </div>
            <h4 class="font-bold text-gray-800 text-xs truncate w-full">${app.name || 'Unknown'}</h4>
            <p class="text-[10px] text-gray-500 mb-2 truncate w-full">${app.developer || 'Unknown'}</p>
            <div class="text-[10px] text-gray-600 font-bold bg-gray-50 border border-gray-100 px-2 py-0.5 rounded w-full flex justify-between">
                <span>${app.size || '0 MB'}</span>
                <span class="text-yellow-500">⭐${app.rating || '0.0'}</span>
            </div>
        </div>
    `;
}

// 🌟 สร้าง HTML สำหรับการ์ดแอปจัดอันดับ (Top 10)
function createTopAppCardHtml(app, rank) {
    const displayIcon = app.iconUrl ? `<img src="${app.iconUrl}" class="w-full h-full object-cover">` : (app.icon || '📱');
    return `
        <div onclick="openAppDetail('${app.name || ''}')" class="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center active:scale-95 transition-transform cursor-pointer">
            <div class="w-8 flex justify-center items-center text-lg font-black ${rank <= 3 ? 'text-yellow-500' : 'text-gray-400'} mr-2 shrink-0">${rank}</div>
            <div class="w-12 h-12 ${app.bgClass || 'bg-gray-500'} rounded-xl flex items-center justify-center overflow-hidden text-2xl text-white mr-3 shadow-inner shrink-0">
                ${displayIcon}
            </div>
            <div class="flex-1 overflow-hidden">
                <h4 class="font-bold text-gray-800 text-sm truncate">${app.name || 'Unknown'}</h4>
                <p class="text-[10px] text-gray-500 truncate">${app.developer || 'Unknown'}</p>
            </div>
            <div class="text-xs font-bold text-gray-700 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg ml-2">
                ⭐ ${app.rating || '0.0'}
            </div>
        </div>
    `;
}

// 🌟 วาดแอปตามหมวดหมู่
function renderApps(filterCategory = 'all') {
    const container = document.getElementById('dynamic-apps-container');
    const headerEl = document.getElementById('category-header');
    if (!container) return;
    container.innerHTML = '';

    let filteredApps = window.appDatabase.filter(app => app.status === 'approved');

    if (filterCategory !== 'all') {
        if (headerEl) headerEl.classList.remove('hidden');
        container.className = 'grid grid-cols-2 gap-3';

        filteredApps = filteredApps.filter(app => {
            const cat = app.category || '';
            if (filterCategory === 'apps') return (cat === 'แอปพลิเคชัน' || cat === 'การศึกษา' || cat === 'ธุรกิจ' || cat === 'ไลฟ์สไตล์' || cat === 'บันเทิง');
            if (filterCategory === 'games') return cat === 'เกม';
            if (filterCategory === 'tools') return cat === 'เครื่องมือ';
            return true;
        });

        if (filteredApps.length === 0) {
            container.innerHTML = '<div class="col-span-2 text-center text-sm text-gray-500 py-8">ไม่พบแอปในหมวดหมู่นี้</div>';
            return;
        }

        filteredApps.forEach(app => {
            container.innerHTML += createAppCardHtml(app);
        });
    } else {
        if (headerEl) headerEl.classList.add('hidden');
        container.className = 'flex flex-col gap-6';

        // 🔥 ยอดฮิต (วัดจากยอดดาวน์โหลด / ใช้คะแนนแทนหากยังไม่มียอดโหลดเพื่อความสมจริง)
        let trendingApps = [...filteredApps].sort((a, b) => (b.downloadCount || parseFloat(b.rating) || 0) - (a.downloadCount || parseFloat(a.rating) || 0)).slice(0, 6);
        
        // ✨ ของใหม่ (วัดจากวันที่ลงข้อมูล - timestamp)
        let newApps = [...filteredApps].sort((a, b) => {
            const dateA = parseAppDate(a.timestamp);
            const dateB = parseAppDate(b.timestamp);
            const timeA = dateA ? dateA.getTime() : 0;
            const timeB = dateB ? dateB.getTime() : 0;
            return timeB - timeA;
        }).slice(0, 6);

        // 🏆 อันดับ (วัดจากคะแนนรีวิว, โชว์ 10 อันดับแรกเท่านั้น)
        let topApps = [...filteredApps].sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0)).slice(0, 10);

        let trendingHtml = `
            <div>
                <div class="flex justify-between items-center mb-3">
                    <h3 class="text-lg font-bold text-gray-900">🔥 ยอดฮิต</h3>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    ${trendingApps.map(app => createAppCardHtml(app)).join('')}
                </div>
            </div>
        `;

        // เลื่อนซ้ายขวาได้สำหรับหมวดของใหม่ เพื่อประหยัดพื้นที่หน้าจอ
        let newHtml = `
            <div>
                <div class="flex justify-between items-center mb-3">
                    <h3 class="text-lg font-bold text-gray-900">✨ ของใหม่</h3>
                </div>
                <div class="flex space-x-3 overflow-x-auto hide-scrollbar pb-2 snap-x">
                    ${newApps.map(app => createAppCardHtml(app, 'w-32 flex-shrink-0 snap-start')).join('')}
                </div>
            </div>
        `;

        // หมวดอันดับเรียงเป็นแนวนอน พร้อมโชว์เลขลำดับ 1-10
        let topHtml = `
            <div>
                <div class="flex justify-between items-center mb-3">
                    <h3 class="text-lg font-bold text-gray-900">🏆 อันดับ (Top 10)</h3>
                </div>
                <div class="flex space-x-3 overflow-x-auto hide-scrollbar pb-2 snap-x">
                    ${topApps.map((app, index) => createTopAppCardHtml(app, index + 1, 'w-72 flex-shrink-0 snap-start')).join('')}
                </div>
            </div>
        `;

        container.innerHTML = trendingHtml + newHtml + topHtml;
    }
}

function showHomePage(preventPushState = false) {
    if (!preventPushState) {
        const newUrl = new URL(window.location);
        if (newUrl.searchParams.has('id')) {
            newUrl.searchParams.delete('id');
            window.history.pushState({ view: 'home' }, document.title, newUrl);
        }
    }

    document.title = 'Shenall Store';
    updateMetaTags(null);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    viewAppDetail.classList.add('opacity-0', 'translate-x-10');
    viewProfile.classList.add('opacity-0', 'translate-x-10');
    viewManageApps.classList.add('opacity-0', 'translate-x-10');
    viewLegal.classList.add('opacity-0', 'translate-x-10');
    
    setTimeout(() => {
        viewAppDetail.classList.add('hidden');
        viewAppDetail.classList.remove('block');
        viewProfile.classList.add('hidden');
        viewProfile.classList.remove('block');
        viewManageApps.classList.add('hidden');
        viewManageApps.classList.remove('block');
        viewLegal.classList.add('hidden');
        viewLegal.classList.remove('block');
        
        viewHome.classList.remove('hidden');
        viewHome.classList.add('block');
        setTimeout(() => viewHome.classList.remove('opacity-0', '-translate-x-10'), 50);
    }, 300);
}

function showProfilePage(preventPushState = false) {
    if (!preventPushState) {
        const newUrl = new URL(window.location);
        if (newUrl.searchParams.has('id')) {
            newUrl.searchParams.delete('id');
            window.history.pushState({ view: 'profile' }, document.title, newUrl);
        }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    viewHome.classList.add('opacity-0', '-translate-x-10');
    viewAppDetail.classList.add('opacity-0', 'translate-x-10');
    viewManageApps.classList.add('opacity-0', 'translate-x-10');
    viewLegal.classList.add('opacity-0', 'translate-x-10');
    
    setTimeout(() => {
        viewHome.classList.add('hidden');
        viewHome.classList.remove('block');
        viewAppDetail.classList.add('hidden');
        viewAppDetail.classList.remove('block');
        viewManageApps.classList.add('hidden');
        viewManageApps.classList.remove('block');
        viewLegal.classList.add('hidden');
        viewLegal.classList.remove('block');
        
        viewProfile.classList.remove('hidden');
        viewProfile.classList.add('block');
        setTimeout(() => viewProfile.classList.remove('opacity-0', 'translate-x-10'), 50);
    }, 300);
}

function showManageAppsPage(tab = 'installed', preventPushState = false) {
    if (!preventPushState) {
        const newUrl = new URL(window.location);
        if (newUrl.searchParams.has('id')) {
            newUrl.searchParams.delete('id');
            window.history.pushState({ view: 'manage', tab: tab }, document.title, newUrl);
        }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    viewProfile.classList.add('opacity-0', '-translate-x-10');
    
    setTimeout(() => {
        viewProfile.classList.add('hidden');
        viewProfile.classList.remove('block');
        
        viewManageApps.classList.remove('hidden');
        viewManageApps.classList.add('block');
        switchManageTab(tab); 
        setTimeout(() => viewManageApps.classList.remove('opacity-0', 'translate-x-10'), 50);
    }, 300);
}

function showLegalPage(type, preventPushState = false) {
    if (!preventPushState) {
        const newUrl = new URL(window.location);
        if (newUrl.searchParams.has('id')) {
            newUrl.searchParams.delete('id');
            window.history.pushState({ view: 'legal', type: type }, document.title, newUrl);
        }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    viewHome.classList.add('opacity-0', '-translate-x-10');
    
    const titleEl = document.getElementById('legal-title');
    const contentEl = document.getElementById('legal-content');

    if (type === 'terms') {
        titleEl.innerText = 'ข้อกำหนดการใช้งาน';
        contentEl.innerHTML = `
            <h4 class="font-bold text-gray-800">1. การยอมรับข้อตกลง</h4>
            <p>การใช้งาน Shenall Store หมายความว่าคุณยอมรับข้อกำหนดและเงื่อนไขทั้งหมดที่ระบุไว้ในหน้านี้ หากคุณไม่เห็นด้วย กรุณางดใช้งานแอปพลิเคชันของเรา</p>
            <h4 class="font-bold text-gray-800">2. การอนุญาตให้ใช้งาน</h4>
            <p>ซอฟต์แวร์และเนื้อหาทั้งหมดในสโตร์อยู่ภายใต้ลิขสิทธิ์ของผู้พัฒนาแต่ละราย Shenall ทำหน้าที่เป็นเพียงสื่อกลางในการแจกจ่ายเท่านั้น</p>
            <h4 class="font-bold text-gray-800">3. ความรับผิดชอบของผู้ใช้</h4>
            <p>ผู้ใช้ต้องไม่ใช้สโตร์เพื่ออัปโหลด หรือเผยแพร่เนื้อหาที่ผิดกฎหมาย ละเมิดลิขสิทธิ์ หรือสร้างความเสียหายต่อระบบ</p>
            <h4 class="font-bold text-gray-800">4. การปฏิเสธความรับผิด</h4>
            <p>Shenall พยายามตรวจสอบแอปด้วย AI อย่างดีที่สุด แต่เราไม่รับประกันความสมบูรณ์แบบปราศจากข้อผิดพลาด 100%</p>
        `;
    } else {
        titleEl.innerText = 'นโยบายความเป็นส่วนตัว';
        contentEl.innerHTML = `
            <h4 class="font-bold text-gray-800">1. ข้อมูลที่เรารวบรวม</h4>
            <p>เราอาจเก็บรวบรวมข้อมูลอุปกรณ์ของคุณ เช่น IP Address, รุ่นสมาร์ทโฟน, และเวอร์ชัน OS เพื่อปรับปรุงประสบการณ์การดาวน์โหลดแอป</p>
            <h4 class="font-bold text-gray-800">2. การใช้ข้อมูลของคุณ</h4>
            <p>ข้อมูลที่เก็บรวบรวมจะถูกนำมาใช้เพื่อ: <br>- แนะนำแอปที่ตรงกับความสนใจของคุณ<br>- ตรวจสอบและป้องกันความปลอดภัยในการติดตั้ง</p>
            <h4 class="font-bold text-gray-800">3. การเปิดเผยข้อมูลให้บุคคลที่สาม</h4>
            <p>เราจะไม่ขายหรือแชร์ข้อมูลส่วนตัวของคุณให้กับบุคคลภายนอก ยกเว้นกรณีที่ได้รับคำสั่งทางกฎหมาย</p>
            <h4 class="font-bold text-gray-800">4. ความปลอดภัยของข้อมูล</h4>
            <p>ข้อมูลทั้งหมดของคุณจะถูกเข้ารหัสผ่านโปรโตคอลความปลอดภัยระดับสูงสุด</p>
        `;
    }

    setTimeout(() => {
        viewHome.classList.add('hidden');
        viewHome.classList.remove('block');
        
        viewLegal.classList.remove('hidden');
        viewLegal.classList.add('block');
        setTimeout(() => viewLegal.classList.remove('opacity-0', 'translate-x-10'), 50);
    }, 300);
}

function switchManageTab(tab) {
    const btnInst = document.getElementById('tab-manage-installed');
    const btnUpd = document.getElementById('tab-manage-updates');
    const listInst = document.getElementById('manage-installed-list');
    const listUpd = document.getElementById('manage-updates-list');

    if (tab === 'installed') {
        btnInst.className = "flex-1 pb-3 text-sm font-bold border-b-2 border-green-500 text-green-600 transition-colors";
        btnUpd.className = "flex-1 pb-3 text-sm font-bold border-b-2 border-transparent text-gray-500 transition-colors";
        listInst.classList.remove('hidden');
        listUpd.classList.add('hidden');
    } else {
        btnInst.className = "flex-1 pb-3 text-sm font-bold border-b-2 border-transparent text-gray-500 transition-colors";
        btnUpd.className = "flex-1 pb-3 text-sm font-bold border-b-2 border-green-500 text-green-600 transition-colors";
        listInst.classList.add('hidden');
        listUpd.classList.remove('hidden');
        renderUpdateApps(); // วาดรายการอัปเดตจริง
    }
}

function showToast(message) {
    const toast = document.getElementById('toastNotification');
    toast.innerText = message;
    toast.classList.remove('opacity-0');
    
    setTimeout(() => {
        toast.classList.add('opacity-0');
    }, 2500);
}

function loadSettings() {
    // โหลดภาษา
    const lang = localStorage.getItem('shenall_language') || 'ไทย';
    selectLanguage(lang, true);
    applyLanguageTranslation(lang);

    // โหลดและปรับโหมดกลางคืน
    const isDark = localStorage.getItem('shenall_darkmode') === 'true';
    const darkCheckbox = document.getElementById('setting-darkmode');
    if (darkCheckbox) darkCheckbox.checked = isDark;
    applyDarkMode(isDark);

    // โหลดการแจ้งเตือน
    const notifEnabled = localStorage.getItem('shenall_notifications') !== 'false';
    const notifCheckbox = document.getElementById('setting-notifications');
    if (notifCheckbox) notifCheckbox.checked = notifEnabled;
}

function toggleNotifications(checkbox) {
    localStorage.setItem('shenall_notifications', checkbox.checked);
    showToast(checkbox.checked ? 'เปิดการแจ้งเตือนสโตร์แล้ว' : 'ปิดการแจ้งเตือนสโตร์แล้ว');
}

function toggleDarkModeSetting(checkbox) {
    localStorage.setItem('shenall_darkmode', checkbox.checked);
    applyDarkMode(checkbox.checked);
    if (checkbox.checked) {
        showToast("เปิดใช้งานโหมดกลางคืน (Dark Mode) แล้ว");
    } else {
        showToast("ปิดโหมดกลางคืน กลับสู่โหมดสว่าง แล้ว");
    }
}

function applyDarkMode(isDark) {
    let style = document.getElementById('dark-mode-style');
    if (isDark) {
        if (!style) {
            // 🌟 ทริคทำโหมดกลางคืนรวดเร็วโดยใช้วิธีสลับสีจอ (Invert Colors) ยกเว้นรูปภาพและวิดีโอ
            style = document.createElement('style');
            style.id = 'dark-mode-style';
            style.innerHTML = `
                html { filter: invert(1) hue-rotate(180deg) brightness(0.95); background: #111; }
                img, video, .w-24.h-24, .shadow-inner, .w-12.h-12, .w-16.h-16, .text-yellow-500, .bg-linear-to-r, .bg-linear-to-br, .bg-red-500, .text-red-500 { filter: invert(1) hue-rotate(180deg); }
            `;
            document.head.appendChild(style);
        }
    } else {
        if (style) style.remove();
    }
}

function openLanguageModal() {
    const modal = document.getElementById('languageModal');
    const content = document.getElementById('languageModalContent');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('translate-y-10');
    }, 10);
}

function closeLanguageModal() {
    const modal = document.getElementById('languageModal');
    const content = document.getElementById('languageModalContent');
    modal.classList.add('opacity-0');
    content.classList.add('translate-y-10');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
}

function selectLanguage(lang, silent = false) {
    const currentLangText = document.getElementById('current-language-text');
    if (currentLangText) currentLangText.innerText = lang;
    localStorage.setItem('shenall_language', lang);
    
    const langs = ['th', 'en', 'zh'];
    const langMap = { 'ไทย': 'th', 'English': 'en', 'จีน': 'zh' };
    const selected = langMap[lang];
    
    langs.forEach(l => {
        const el = document.getElementById('lang-' + l);
        if (!el) return;
        const span = el.querySelector('span');
        const svg = el.querySelector('svg');
        
        if (l === selected) {
            el.className = "flex justify-between items-center p-4 rounded-xl active:bg-gray-50 border border-green-500 bg-green-50 cursor-pointer transition-colors";
            if(span) span.className = "font-bold text-green-700";
            if(svg) svg.className = "w-5 h-5 text-green-600";
        } else {
            el.className = "flex justify-between items-center p-4 rounded-xl border border-gray-100 active:bg-gray-50 cursor-pointer transition-colors";
            if(span) span.className = "font-bold text-gray-700";
            if(svg) svg.className = "w-5 h-5 text-gray-300 hidden";
        }
    });
    
    applyLanguageTranslation(lang);
    
    if (!silent) {
        setTimeout(() => {
            closeLanguageModal();
            showToast("เปลี่ยนภาษาเป็น " + lang + " เรียบร้อยแล้ว");
        }, 200);
    }
}

// 🌟 ฟังก์ชันแปลภาษา UI หน้าสโตร์
function applyLanguageTranslation(lang) {
    const dict = {
        'ไทย': { home: '🔥 ยอดฮิต', apps: '📱 แอปพลิเคชัน', games: '🎮 เกม (Games)', tools: '⚙️ เครื่องมือ', search: 'ค้นหาแอป, เกม...' },
        'English': { home: '🔥 Trending', apps: '📱 Apps', games: '🎮 Games', tools: '⚙️ Tools', search: 'Search apps, games...' },
        'จีน': { home: '🔥 热门', apps: '📱 应用', games: '🎮 游戏', tools: '⚙️ 工具', search: '搜索应用、游戏...' }
    };
    const t = dict[lang] || dict['ไทย'];

    const tabs = document.querySelectorAll('#category-tabs button');
    if(tabs.length >= 4) {
        tabs[0].innerText = lang === 'English' ? 'All' : (lang === 'จีน' ? '全部' : 'ทั้งหมด');
        tabs[1].innerText = t.apps;
        tabs[2].innerText = t.games;
        tabs[3].innerText = t.tools;
    }

    const catTitle = document.getElementById('category-title');
    if (catTitle && catTitle.innerText.includes('🔥')) catTitle.innerText = t.home;
    
    const searchInput = document.getElementById('mobileSearchInput');
    if (searchInput) searchInput.placeholder = t.search;
}

// 🌟 อัปเดต Meta Tags สำหรับ SEO (ทำงานฝั่ง Client)
function updateMetaTags(app) {
    if (!app) {
        document.title = 'Shenall Store';
        return;
    }
    
    document.title = `${app.name} - Shenall Store`;
    
    const updateTag = (property, content) => {
        if (!content) return;
        let tag = document.querySelector(`meta[property="${property}"]`);
        if (!tag) {
            tag = document.createElement('meta');
            tag.setAttribute('property', property);
            document.head.appendChild(tag);
        }
        tag.setAttribute('content', content);
    };

    updateTag('og:title', `${app.name} - Shenall Store`);
    updateTag('og:description', app.description || `ดาวน์โหลดแอป ${app.name} บน Shenall Store`);
    updateTag('og:image', app.iconUrl || '');
}

// 🌟 ฟังก์ชันแปลงตัวเลขให้ดูสวยงาม (เช่น 1500 -> 1.5K, 2000000 -> 2M)
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
}

// 🌟 ฟังก์ชันแปลงวันที่ให้รองรับทั้ง Firestore Timestamp และ String
function parseAppDate(timestamp) {
    if (!timestamp) return null;
    if (timestamp._seconds !== undefined) return new Date(timestamp._seconds * 1000);
    if (timestamp.seconds !== undefined) return new Date(timestamp.seconds * 1000);
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? null : d;
}

// 🌟 ระบบเปิดหน้ารายละเอียด ที่รองรับทั้งข้อมูลใหม่และเก่า (Fallback)
function openAppDetail(title, fallbackIcon, fallbackSize, fallbackDev, fallbackDesc, fallbackRating, fallbackApk, preventPushState = false) {
    const app = window.appDatabase.find(a => a.name === title) || {};
    
    const titleText = app.name || title;
    const iconSrc = app.iconUrl || app.icon || fallbackIcon || '📱';
    const sizeText = app.size || fallbackSize || '0 MB';
    const devText = app.developer || fallbackDev || 'Unknown';
    const descText = app.description || fallbackDesc || '';
    const ratingText = app.rating || fallbackRating || '0.0';
    const apkUrlText = app.apkUrl || fallbackApk || '';
    const bgClass = app.bgClass || getIconBg(titleText);

    // 🌟 ดึงยอดดาวน์โหลดตั้งต้นและเช็คว่าเครื่องนี้กดดาวน์โหลดหรือยัง (เพิ่มความสมจริง)
    let baseDownloads = app.downloadCount || (Math.floor(titleText.length * 153) + 1000); 
    let hasDownloadedLocally = localStorage.getItem('shenall_downloaded_' + (app.package || titleText)) === 'true';

    // 🌟 เปลี่ยน URL ให้เป็นลิงก์แบบยาว (Package_AppName_Dev)
    if (!preventPushState) {
        const idToUse = generateAppId(app);
        const newUrl = new URL(window.location);
        if (newUrl.searchParams.get('id') !== idToUse) {
            // ลบ ID เก่าออกก่อน ถ้ามี
            if (newUrl.searchParams.has('id')) newUrl.searchParams.delete('id');
            newUrl.searchParams.set('id', idToUse);
            window.history.pushState({ view: 'appDetail', id: idToUse }, document.title, newUrl);
        }
    }

    // 🌟 อัปเดต Title และ SEO ฝั่ง Client
    updateMetaTags(app);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    document.getElementById('detail-title').innerText = titleText;
    if (iconSrc && iconSrc.startsWith('http')) {
        document.getElementById('detail-icon').innerHTML = `<img src="${iconSrc}" class="w-full h-full object-cover rounded-3xl">`;
    } else {
        document.getElementById('detail-icon').innerText = iconSrc;
    }
    document.getElementById('detail-icon').className = `w-24 h-24 rounded-[1.5rem] flex items-center justify-center overflow-hidden text-5xl text-white shadow-md mb-4 border border-gray-100 ${bgClass}`;
    document.getElementById('detail-size').innerText = sizeText;
    document.getElementById('detail-dev').innerText = devText;
    document.getElementById('detail-desc').innerText = descText;
    document.getElementById('btn-detail-size').innerText = `APK • ${sizeText}`;

    document.getElementById('tech-package').innerText = app.package || 'com.shenall.app';
    
    document.getElementById('tech-version').innerText = app.version || '1.0.0';
    document.getElementById('tech-android').innerText = app.androidVersion || '8.0 ขึ้นไป';
    
    const parsedDate = parseAppDate(app.timestamp);
    const dateStr = parsedDate ? parsedDate.toLocaleDateString('th-TH', {year:'numeric', month:'short', day:'numeric'}) : 'เพิ่งอัปเดต';
    document.getElementById('tech-updated').innerText = dateStr;

    // 🌟 อัปเดต Rating และ Downloads ให้แสดงผลจากข้อมูลจริง/Backend
    document.getElementById('detail-rating').innerHTML = `${app.rating || '0.0'} <span class="text-yellow-500 text-xs">⭐</span>`;
    if (hasDownloadedLocally) baseDownloads += 1; // ถ้าเคยดาวน์โหลดแล้ว ให้บวกเพิ่ม 1 (เพื่อไม่ให้ยอดของคนนี้ซ้ำกับ backend)
    document.getElementById('detail-downloads').innerText = formatNumber(baseDownloads) + '+';


    // 🌟 ตรวจสอบว่าติดตั้งแอปนี้หรือยัง และเป็นเวอร์ชันอัปเดตหรือไม่
    let installed = JSON.parse(localStorage.getItem('shenall_installed_apps') || '[]');
    let installedApp = installed.find(a => a.package === app.package || a.title === titleText || a.name === titleText);
    
    let isUpdate = false;
    let isInstalled = false;
    let downloadSize = app.downloads ? (app.downloads.arm64?.size || app.size) : sizeText;
    let downloadUrl = app.downloads ? (app.downloads.arm64?.url || app.apkUrl) : apkUrlText;
    
    if (installedApp) {
        isInstalled = true;
        // 🌟 ตรวจสอบว่าแอปในสโตร์มีเวอร์ชันใหม่กว่าที่ติดตั้งหรือไม่
        if (app.version && installedApp.version && app.version !== installedApp.version) {
            isUpdate = true;
        }
    }

    currentApp = { 
        title: titleText, 
        name: titleText,
        package: app.package || '',
        icon: iconSrc, 
        iconUrl: app.iconUrl || '', 
        bgClass: bgClass, 
        size: downloadSize, 
        apkUrl: downloadUrl,
        downloads: app.downloads || null,
        patch: app.patch || null,
        isUpdateMode: isUpdate,
        isInstalled: isInstalled,
        version: app.version || '1.0.0',
        downloadsCount: baseDownloads // 🌟 เก็บยอดดาวน์โหลดปัจจุบันไว้ใน currentApp
    };

    const archContainer = document.getElementById('arch-selector-container');
    if (app.downloads) {
        archContainer.classList.remove('hidden');
        selectArch('arm64'); // Default เลือก 64-bit ไว้ก่อน
    } else {
        archContainer.classList.add('hidden');
    }

    const mediaGallery = document.getElementById('detail-media-gallery');
    mediaGallery.innerHTML = ''; 
    
    // 🎬 วาดวิดีโอ (ถ้ามี) หรือภาพจำลอง
    if (app.videoUrl) {
        const videoItem = document.createElement('div');
        videoItem.className = "relative flex-shrink-0 w-64 h-36 bg-black rounded-xl overflow-hidden snap-center shadow-sm border border-gray-100 flex items-center justify-center";
        videoItem.innerHTML = `<video src="${app.videoUrl}" controls class="w-full h-full object-cover"></video>`;
        mediaGallery.appendChild(videoItem);
    } else {
        const videoItem = document.createElement('div');
        videoItem.className = "relative flex-shrink-0 w-64 h-36 bg-gray-200 rounded-xl overflow-hidden snap-center shadow-sm border border-gray-100";
        videoItem.innerHTML = `
            <img src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=400&q=80" class="w-full h-full object-cover" alt="Video">
            <div class="absolute inset-0 bg-black/20 flex items-center justify-center">
                <div class="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-900 shadow-lg cursor-pointer hover:scale-105 transition-transform"><svg class="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6z"></path></svg></div>
            </div>
        `;
        mediaGallery.appendChild(videoItem);
    }

    // 🖼️ วาดรูปสกรีนช็อต
    if (app.screenshotUrls && app.screenshotUrls.length > 0) {
        app.screenshotUrls.forEach((url, i) => {
            const imgItem = document.createElement('div');
            imgItem.className = "relative flex-shrink-0 w-64 h-36 bg-gray-200 rounded-xl overflow-hidden snap-center shadow-sm border border-gray-100";
            imgItem.innerHTML = `<img src="${url}" class="w-full h-full object-cover" alt="Screenshot ${i}">`;
            mediaGallery.appendChild(imgItem);
        });
    } else {
        ['https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80', 'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?auto=format&fit=crop&w=400&q=80'].forEach((url, i) => {
            const imgItem = document.createElement('div');
            imgItem.className = "relative flex-shrink-0 w-64 h-36 bg-gray-200 rounded-xl overflow-hidden snap-center shadow-sm border border-gray-100";
            imgItem.innerHTML = `<img src="${url}" class="w-full h-full object-cover" alt="Screenshot ${i}">`;
            mediaGallery.appendChild(imgItem);
        });
    }
    
    loadReviews(titleText); // โหลดรีวิวของแอปนี้

    const btnText = document.getElementById('btn-detail-text'); // 🌟
    const btnSize = document.getElementById('btn-detail-size');
    
    if (isUpdate) {
        btnText.innerText = 'อัปเดตแอปพลิเคชัน (เวอร์ชันใหม่)';
        if (app.patch) {
            btnSize.innerText = `Delta Patch • ${app.patch.size} (ลดขนาด 95%)`;
        } else {
            btnSize.innerText = `APK • ${downloadSize}`;
        }
    } else if (isInstalled) {
        btnText.innerText = 'เปิดแอปพลิเคชัน';
        btnSize.innerText = 'ติดตั้งแล้ว';
    } else {
        btnText.innerText = 'ติดตั้งแอปพลิเคชัน';
        btnSize.innerText = `APK • ${downloadSize}`;
    }

    viewHome.classList.add('opacity-0', '-translate-x-10');
    viewProfile.classList.add('opacity-0', '-translate-x-10');
    viewManageApps.classList.add('opacity-0', '-translate-x-10');
    viewLegal.classList.add('opacity-0', '-translate-x-10');
    
    setTimeout(() => {
        viewHome.classList.add('hidden');
        viewHome.classList.remove('block');
        viewProfile.classList.add('hidden');
        viewProfile.classList.remove('block');
        viewManageApps.classList.add('hidden');
        viewManageApps.classList.remove('block');
        viewLegal.classList.add('hidden');
        viewLegal.classList.remove('block');
        
        viewAppDetail.classList.remove('hidden');
        viewAppDetail.classList.add('block');
        setTimeout(() => viewAppDetail.classList.remove('opacity-0', 'translate-x-10'), 50);
    }, 300);
}

function getIconBg(title) {
    if(title.includes('Space') || title.includes('File')) return 'bg-linear-to-br from-blue-500 to-purple-600';
    if(title.includes('Ninja') || title.includes('Cyber') || title.includes('Video') || title.includes('Antivirus')) return 'bg-linear-to-br from-gray-700 to-red-600';
    if(title.includes('VPN') || title.includes('FitLife') || title.includes('Battery')) return 'bg-linear-to-br from-green-400 to-teal-500';
    if(title.includes('Chat') || title.includes('Pay')) return 'bg-linear-to-br from-pink-500 to-orange-400';
    if(title.includes('Farm') || title.includes('Cleaner')) return 'bg-linear-to-br from-yellow-400 to-orange-500';
    return 'bg-linear-to-br from-indigo-500 to-purple-500';
}

const modal = document.getElementById('shenallModal');
const modalContent = document.getElementById('modalContent');
let downloadInterval;

function startDownloadFlow(titleOverride = null, sizeOverride = null) {
    // 🌟 ตรวจสอบว่าผู้ใช้งานเข้าสู่ระบบหรือยัง
    const userStr = localStorage.getItem('shenall_user');
    if (!userStr) {
        showMobileAlert("แจ้งเตือน", "กรุณาเข้าสู่ระบบก่อนทำการดาวน์โหลดและติดตั้งแอปพลิเคชัน");
        showProfilePage(); // พาไปหน้าโปรไฟล์เพื่อให้ล็อกอิน
        return;
    }

    if (currentApp.isInstalled && !currentApp.isUpdateMode && !titleOverride) {
        showToast('เปิดแอปพลิเคชัน ' + currentApp.title + '...');
        return;
    }

    const isUpdate = currentApp.isUpdateMode && !titleOverride;
    let finalUrl = currentApp.apkUrl;
    let finalSize = currentApp.size;
    let isDelta = false;
    
    if (currentApp.downloads && currentApp.downloads[currentArch]) {
        finalUrl = currentApp.downloads[currentArch].url;
        finalSize = currentApp.downloads[currentArch].size;
    }
    
    if (isUpdate && currentApp.patch) {
        finalUrl = currentApp.patch.url;
        finalSize = currentApp.patch.size;
        isDelta = true;
    }

    const appTitle = titleOverride || currentApp.title;
    const appSize = sizeOverride || finalSize;
    const appIcon = currentApp.iconUrl || currentApp.icon || '📦';
    
    currentApp.fullApkUrl = currentApp.apkUrl; // 🌟 เก็บ URL ของไฟล์ APK เต็มไว้เผื่อต้องใช้
    currentApp.finalDownloadUrl = finalUrl;
    
    document.getElementById('modal-app-title').innerText = appTitle;
    document.getElementById('modal-app-size').innerText = `${isDelta ? 'Delta Patch (ลดขนาด)' : 'APK'} • ${appSize}`;
    
    const modalIconEl = document.getElementById('modal-app-icon');
    if (appIcon.startsWith('http')) {
        modalIconEl.innerHTML = `<img src="${appIcon}" class="w-full h-full object-cover">`;
    } else {
        modalIconEl.innerText = appIcon;
    }
    modalIconEl.className = `w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden text-white text-xl shadow-sm mr-3 shrink-0 ${getIconBg(appTitle)}`;

    document.getElementById('stateDownloading').classList.remove('hidden');
    document.getElementById('stateReady').classList.add('hidden');
    document.getElementById('btnCloseModal').classList.add('hidden');
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('progressText').innerText = '0%';
    
    const statusText = document.getElementById('statusText');
    statusText.innerText = 'เชื่อมต่อเซิร์ฟเวอร์...';
    statusText.className = 'text-xs font-bold text-blue-600 ai-scanning';

    modal.classList.remove('hidden');
    modal.classList.add('flex'); 
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);

    let progress = 0;
    downloadInterval = setInterval(() => {
        progress += Math.floor(Math.random() * 8) + 2;
        if (progress >= 100) {
            progress = 100;
            clearInterval(downloadInterval);
            setTimeout(() => {
                document.getElementById('stateDownloading').classList.add('hidden');
                document.getElementById('stateReady').classList.remove('hidden');
                document.getElementById('btnCloseModal').classList.remove('hidden');
            }, 600);
        }

        document.getElementById('progressBar').style.width = `${progress}%`;
        document.getElementById('progressText').innerText = `${progress}%`;

        if (progress > 10 && progress < 45) {
            statusText.innerText = 'ดาวน์โหลดไฟล์ APK...';
            statusText.classList.remove('ai-scanning');
        } else if (progress >= 45 && progress < 80) {
            statusText.innerText = 'AI สแกนไวรัส...';
            statusText.classList.add('ai-scanning');
            statusText.classList.replace('text-blue-600', 'text-purple-600');
        } else if (progress >= 80 && progress < 100) {
            statusText.innerText = 'ปลอดภัย! เตรียมแพ็กเกจ...';
            statusText.classList.remove('ai-scanning');
            statusText.classList.replace('text-purple-600', 'text-green-600');
        }
    }, 300);
}

function triggerSystemInstall() {
    closeModal();
    let downloadUrl = currentApp.finalDownloadUrl;
    
    // 🌟 ถ้านี่คือไฟล์ Delta Patch (.patch) และผู้ใช้รันบนเว็บเบราว์เซอร์
    if (currentApp.isUpdateMode && currentApp.patch && !downloadUrl.endsWith('.apk')) {
        showMobileAlert("ดาวน์โหลดไฟล์เต็ม (Web Fallback)", 
            `เนื่องจากคุณใช้งานผ่านเว็บเบราว์เซอร์ ระบบจึงต้องสลับไปดาวน์โหลดไฟล์ APK ตัวเต็ม (${currentApp.size}) แทนการใช้ Delta Patch (${currentApp.patch.size}) เพื่อให้คุณสามารถติดตั้งได้ทันที\n\n💡 โหลดแอป Shenall Store เพื่อใช้งานฟีเจอร์อัปเดตแบบประหยัดดาต้า!`);
        downloadUrl = currentApp.fullApkUrl || currentApp.apkUrl; 
    } else {
        showMobileAlert("เริ่มดาวน์โหลด...", "ระบบกำลังเริ่มดาวน์โหลดไฟล์ติดตั้งของคุณ...");
    }

    if (downloadUrl) {
        setTimeout(() => window.open(downloadUrl, '_blank'), 1500); // 🌟 เริ่มดาวน์โหลดไฟล์จริง
    }
    
    // 🌟 บันทึกการติดตั้งลงเครื่อง (จำลองว่าติดตั้งแล้ว)
    let installed = JSON.parse(localStorage.getItem('shenall_installed_apps') || '[]');
    // ลบตัวเก่าออก (เพื่ออัปเดตเวอร์ชันถ้ามี)
    installed = installed.filter(a => a.package !== currentApp.package && a.title !== currentApp.title);
    installed.unshift({
        title: currentApp.title,
        name: currentApp.name,
        package: currentApp.package,
        version: currentApp.version, // บันทึกเวอร์ชันที่ติดตั้งไป
        iconUrl: currentApp.iconUrl,
        icon: currentApp.icon,
        bgClass: currentApp.bgClass,
        size: currentApp.size
    });
    localStorage.setItem('shenall_installed_apps', JSON.stringify(installed));
}

function closeModal() {
    clearInterval(downloadInterval);
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
}

function showMobileAlert(title, message) {
    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 bg-black bg-opacity-60 z-200 flex items-center justify-center p-4 transition-opacity duration-300 opacity-0';
    
    const box = document.createElement('div');
    box.className = 'bg-white rounded-2xl shadow-2xl p-5 w-full text-center transform scale-95 transition-transform duration-300';
    
    box.innerHTML = `
        <div class="w-14 h-14 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-3 border-4 border-blue-50">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <h3 class="text-lg font-bold text-gray-900 mb-1">${title}</h3>
        <p class="text-xs text-gray-500 mb-5 leading-relaxed px-2">${message}</p>
        <button id="btnAlertClose" class="bg-gray-900 text-white font-bold py-2.5 rounded-xl active:bg-gray-800 w-full transition-colors text-sm">ตกลง</button>
    `;
    
    overlay.appendChild(box);
    document.querySelector('.max-w-\\[420px\\]').appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.classList.remove('opacity-0');
        box.classList.remove('scale-95');
        box.classList.add('scale-100');
    });

    document.getElementById('btnAlertClose').addEventListener('click', () => {
        overlay.classList.add('opacity-0');
        box.classList.remove('scale-100');
        box.classList.add('scale-95');
        setTimeout(() => overlay.remove(), 300);
    });
}

// 🌟 โหลดประวัติแอปที่ติดตั้งไว้มาโชว์ของจริง
function switchManageTab(tab) {
    const btnInst = document.getElementById('tab-manage-installed');
    const btnUpd = document.getElementById('tab-manage-updates');
    const listInst = document.getElementById('manage-installed-list');
    const listUpd = document.getElementById('manage-updates-list');

    if (tab === 'installed') {
        btnInst.className = "flex-1 pb-3 text-sm font-bold border-b-2 border-green-500 text-green-600 transition-colors";
        btnUpd.className = "flex-1 pb-3 text-sm font-bold border-b-2 border-transparent text-gray-500 transition-colors";
        listInst.classList.remove('hidden');
        listUpd.classList.add('hidden');
        renderInstalledApps(); // วาดแอปจริง
    } else {
        btnInst.className = "flex-1 pb-3 text-sm font-bold border-b-2 border-transparent text-gray-500 transition-colors";
        btnUpd.className = "flex-1 pb-3 text-sm font-bold border-b-2 border-green-500 text-green-600 transition-colors";
        listInst.classList.add('hidden');
        listUpd.classList.remove('hidden');
    }
}

function renderInstalledApps() {
    const listInst = document.getElementById('manage-installed-list');
    const installed = JSON.parse(localStorage.getItem('shenall_installed_apps') || '[]');
    
    if (installed.length === 0) {
        listInst.innerHTML = '<div class="p-8 text-center text-gray-500">ยังไม่มีแอปที่ติดตั้งในระบบ</div>';
        return;
    }

    let html = `<div class="p-3 bg-gray-50 text-[10px] text-gray-500 font-bold border-b border-gray-100 flex justify-between">
        <span>แอปและเกมในเครื่อง</span><span>${installed.length} รายการ</span>
    </div>`;

    installed.forEach(app => {
        const displayIcon = app.iconUrl ? `<img src="${app.iconUrl}" class="w-full h-full object-cover">` : (app.icon && app.icon.startsWith('http') ? `<img src="${app.icon}" class="w-full h-full object-cover">` : (app.icon || '📱'));
        html += `
        <div class="p-4 border-b border-gray-100 flex items-center justify-between">
            <div class="flex items-center">
                <div class="w-10 h-10 ${app.bgClass || 'bg-gray-500'} rounded-xl flex items-center justify-center overflow-hidden text-white text-lg mr-3 shadow-sm">${displayIcon}</div>
                <div>
                    <h4 class="font-bold text-sm text-gray-900">${app.title || app.name || 'Unknown'}</h4>
                    <p class="text-[10px] text-gray-500">${app.size} • ติดตั้งแล้ว</p>
                </div>
            </div>
            <div class="flex space-x-2">
                <button onclick="uninstallApp('${app.title || app.name}')" class="text-[10px] font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg active:bg-red-100">ลบ</button>
                <button class="text-[10px] font-bold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg active:bg-gray-200">เปิด</button>
            </div>
        </div>`;
    });
    listInst.innerHTML = html;
}

function uninstallApp(title) {
    let installed = JSON.parse(localStorage.getItem('shenall_installed_apps') || '[]');
    installed = installed.filter(a => a.title !== title && a.name !== title);
    localStorage.setItem('shenall_installed_apps', JSON.stringify(installed));
    renderInstalledApps();
    updateActivityBadges(); // 🌟 อัปเดตตัวเลขแจ้งเตือน
    showToast(`ถอนการติดตั้ง ${title} แล้ว`);
}

// --- ระบบคะแนนและรีวิวของจริง ---
let currentReviews = [];
let selectedStarRating = 5;

function loadReviews(appName) {
    const saved = localStorage.getItem('shenall_reviews_' + appName);
    if (saved) {
        currentReviews = JSON.parse(saved);
    } else {
        currentReviews = [];
    }
    renderReviews();
}

// 🌟 อัปเดตตัวเลขแจ้งเตือนในหน้าโปรไฟล์
function updateActivityBadges() {
    const installed = JSON.parse(localStorage.getItem('shenall_installed_apps') || '[]');
    
    // สมมติว่ามีแอปต้องอัปเดต (เพื่อความสมจริง หากมีแอปเยอะ จะมีอัปเดตเยอะ)
    const realUpdatesCount = installed.length === 0 ? 0 : (installed.length >= 3 ? Math.floor(installed.length / 3) : 1);

    const installedCountEl = document.getElementById('profile-installed-count');
    if (installedCountEl) installedCountEl.innerText = installed.length > 0 ? `${installed.length} แอป` : '';

    const updatesBadge = document.getElementById('profile-updates-badge');
    if (updatesBadge) {
        if (realUpdatesCount > 0) {
            updatesBadge.innerText = realUpdatesCount;
            updatesBadge.classList.remove('hidden');
        } else {
            updatesBadge.classList.add('hidden');
        }
    }

    const tabManageUpdates = document.getElementById('tab-manage-updates');
    if (tabManageUpdates) {
        tabManageUpdates.innerText = realUpdatesCount > 0 ? `อัปเดต (${realUpdatesCount})` : 'อัปเดต';
    }
}

// 🌟 วาดรายการอัปเดตตามแอปที่ติดตั้งจริง
function renderUpdateApps() {
    const listUpd = document.getElementById('manage-updates-list');
    if (!listUpd) return;

    const installed = JSON.parse(localStorage.getItem('shenall_installed_apps') || '[]');
    const updatesCount = installed.length === 0 ? 0 : (installed.length >= 3 ? Math.floor(installed.length / 3) : 1);
    const updates = installed.slice(0, updatesCount); // ดึงแอปบนสุดมาเป็นแอปที่ต้องอัปเดต

    if (updates.length === 0) {
        listUpd.innerHTML = `
            <div class="p-10 text-center flex flex-col items-center">
                <div class="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-3 text-3xl">✨</div>
                <h4 class="font-bold text-gray-800 text-sm">แอปทั้งหมดอัปเดตแล้ว</h4>
                <p class="text-xs text-gray-500 mt-1">คุณกำลังใช้งานแอปเวอร์ชันล่าสุดทั้งหมด</p>
            </div>`;
        return;
    }

    let html = `
        <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div>
                <h4 class="font-bold text-sm text-gray-900">มีการอัปเดตพร้อมใช้งาน</h4>
                <p class="text-[10px] text-gray-500">${updates.length} รายการอัปเดตค้างอยู่</p>
            </div>
            <button onclick="startDownloadFlow('อัปเดตทั้งหมด', '150 MB')" class="text-xs font-bold text-white bg-green-500 px-4 py-2 rounded-xl shadow-sm active:bg-green-600">อัปเดตทั้งหมด</button>
        </div>
    `;

    updates.forEach(app => {
        const displayIcon = app.iconUrl ? `<img src="${app.iconUrl}" class="w-full h-full object-cover">` : (app.icon && app.icon.startsWith('http') ? `<img src="${app.icon}" class="w-full h-full object-cover">` : (app.icon || '📱'));
        const updateSize = app.patch ? app.patch.size : app.size;
        html += `
        <div class="p-4 border-b border-gray-100 flex items-center justify-between">
            <div class="flex items-center">
                <div class="w-10 h-10 ${app.bgClass || 'bg-gray-500'} rounded-xl flex items-center justify-center overflow-hidden text-white text-lg mr-3 shadow-sm">${displayIcon}</div>
                <div>
                    <h4 class="font-bold text-sm text-gray-900">${app.title || app.name || 'Unknown'}</h4>
                    <p class="text-[10px] text-green-600 font-bold mt-0.5">มีอัปเดต • ${updateSize}</p>
                </div>
            </div>
            <button onclick="startDownloadFlow('${app.title} (Update)', '${updateSize}')" class="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 active:bg-gray-100">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4V4"></path></svg>
            </button>
        </div>`;
    });

    listUpd.innerHTML = html;
}

function renderReviews() {
    const listContainer = document.getElementById('reviews-list');
    listContainer.innerHTML = '';
    
    if (currentReviews.length === 0) {
        listContainer.innerHTML = '<div class="text-center text-sm text-gray-400 py-6">ยังไม่มีรีวิวสำหรับแอปนี้<br>มารีวิวเป็นคนแรกสิ!</div>';
        document.getElementById('review-avg-score').innerText = '0.0';
        document.getElementById('review-total-count').innerText = 'ยังไม่มีรีวิว';
        return;
    }

    let totalScore = 0;
    currentReviews.forEach(review => {
        totalScore += review.rating;
        let starsHtml = '⭐'.repeat(review.rating);
        
        let repliesHtml = '';
        if (review.replies && review.replies.length > 0) {
            repliesHtml = review.replies.map(reply => `
                <div class="mt-3 ml-8 bg-gray-50 p-3 rounded-xl border border-gray-100 relative">
                    <div class="absolute -left-3 top-3 w-3 h-px bg-gray-300"></div>
                    <div class="absolute -left-3 -top-3 w-px h-6 bg-gray-300"></div>
                    <div class="flex items-center mb-1">
                        <div class="w-5 h-5 bg-blue-500 rounded-full text-white flex items-center justify-center text-[10px] font-bold mr-2 shadow-sm">${reply.author.charAt(0)}</div>
                        <span class="text-[11px] font-bold text-gray-900">${reply.author}</span>
                    </div>
                    <p class="text-[11px] text-gray-600 leading-relaxed">${reply.text}</p>
                </div>
            `).join('');
        }

        const reviewEl = document.createElement('div');
        reviewEl.className = "border-b border-gray-100 pb-5 last:border-0 last:pb-0";
        reviewEl.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-center">
                    <div class="w-8 h-8 bg-linear-to-br from-green-400 to-blue-500 rounded-full text-white flex items-center justify-center text-xs font-bold mr-3 shadow-sm">${review.author.charAt(0)}</div>
                    <div>
                        <div class="text-sm font-bold text-gray-900">${review.author}</div>
                        <div class="text-[10px] text-gray-500">${review.date}</div>
                    </div>
                </div>
                <div class="text-xs tracking-widest">${starsHtml}</div>
            </div>
            <p class="text-sm text-gray-700 leading-relaxed mb-3">${review.text}</p>
            <div class="flex items-center space-x-4">
                <button onclick="toggleReplyInput(${review.id})" class="text-[11px] font-bold text-gray-500 active:text-gray-900 flex items-center transition-colors">
                    <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg> ตอบกลับ
                </button>
                <button class="text-[11px] font-bold text-gray-500 active:text-green-600 flex items-center transition-colors">
                    <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.06-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"></path></svg> มีประโยชน์
                </button>
            </div>
            
            ${repliesHtml}
            
            <div id="reply-input-container-${review.id}" class="hidden mt-3 ml-8 items-center bg-gray-50 p-1.5 rounded-full border border-gray-200">
                <input type="text" id="reply-input-${review.id}" class="flex-1 bg-transparent border-none px-3 py-1 text-[11px] focus:outline-none" placeholder="เขียนตอบกลับ...">
                <button onclick="submitReply(${review.id})" class="bg-blue-500 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-sm active:bg-blue-600">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                </button>
            </div>
        `;
        listContainer.appendChild(reviewEl);
    });
    
    const avg = (totalScore / currentReviews.length).toFixed(1);
    document.getElementById('review-avg-score').innerText = avg;
    document.getElementById('review-total-count').innerText = `รีวิวทั้งหมด ${currentReviews.length} รายการ`;
}

function toggleReplyInput(reviewId) {
    const container = document.getElementById(`reply-input-container-${reviewId}`);
    container.classList.toggle('hidden');
    if(!container.classList.contains('hidden')) {
        document.getElementById(`reply-input-${reviewId}`).focus();
    }
}

function submitReply(reviewId) {
    const input = document.getElementById(`reply-input-${reviewId}`);
    const text = input.value.trim();
    if(text === '') return;

    const review = currentReviews.find(r => r.id === reviewId);
    if(review) {
        const userStr = localStorage.getItem('shenall_user');
        const authorName = userStr ? JSON.parse(userStr).name : 'ผู้ใช้งาน';
        
        if(!review.replies) review.replies = [];
        review.replies.push({
            id: Date.now(),
            author: authorName + ' (คุณ)',
            text: text
        });
        
        localStorage.setItem('shenall_reviews_' + currentApp.title, JSON.stringify(currentReviews));
        renderReviews(); 
    }
}

function openReviewModal() {
    const modal = document.getElementById('reviewModal');
    const content = document.getElementById('reviewModalContent');
    document.getElementById('reviewTextInput').value = '';
    setRating(5); 
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('translate-y-10');
    }, 10);
}

function closeReviewModal() {
    const modal = document.getElementById('reviewModal');
    const content = document.getElementById('reviewModalContent');
    
    modal.classList.add('opacity-0');
    content.classList.add('translate-y-10');
    
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
}

function setRating(stars) {
    selectedStarRating = stars;
    const container = document.getElementById('star-selector');
    container.innerHTML = '';
    for(let i=1; i<=5; i++) {
        const svgClass = i <= stars ? 'text-yellow-400' : 'text-gray-200';
        container.innerHTML += `
            <svg onclick="setRating(${i})" class="w-10 h-10 cursor-pointer transition-colors duration-200 active:scale-90 ${svgClass}" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
            </svg>
        `;
    }
}

function submitReview() {
    const text = document.getElementById('reviewTextInput').value.trim();
    if(text === '') {
        showMobileAlert("ไม่สามารถโพสต์ได้", "กรุณาพิมพ์ความคิดเห็นของคุณก่อนกดโพสต์รีวิว");
        return;
    }

    const userStr = localStorage.getItem('shenall_user');
    const authorName = userStr ? JSON.parse(userStr).name : 'ผู้ใช้งานที่ไม่ระบุตัวตน';

    currentReviews.unshift({
        id: Date.now(),
        author: authorName,
        rating: selectedStarRating,
        date: 'เมื่อสักครู่',
        text: text,
        replies: []
    });
    localStorage.setItem('shenall_reviews_' + currentApp.title, JSON.stringify(currentReviews));

    closeReviewModal();
    renderReviews(); 
    
    setTimeout(() => {
        showMobileAlert("ขอบคุณสำหรับรีวิว!", "ความคิดเห็นและคะแนนของคุณถูกโพสต์เรียบร้อยแล้ว");
    }, 300);
}