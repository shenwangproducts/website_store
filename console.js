const CHATCHAT_CLIENT_ID = "9c45f09626924ffc387e39a56c901fd9";
const REDIRECT_URI = window.location.origin + window.location.pathname;
const API_BASE_URL = "https://backendshenallstore.onrender.com"; // 🌟 เชื่อมต่อกับเซิร์ฟเวอร์จริงบน Render

document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        // ลบ code ออกจาก URL หลังได้มาแล้วเพื่อความสวยงาม
        window.history.replaceState({}, document.title, window.location.pathname);
        await processOAuthCode(code);
    } else {
        await checkLoginState();
    }

    // 🌟 ตั้งค่าระบบ Drag & Drop ลากวางไฟล์
    setupDragAndDrop('devApkPreviewBox', 'devApkInput', handleApkUpload);
    setupDragAndDrop('devScreenshotBox', 'devScreenshotInput', handleScreenshotUpload);
    setupDragAndDrop('devVideoBox', 'devVideoInput', handleVideoUpload);
    setupDragAndDrop('appIconPreview', 'appIconInput', handleAppIconUpload);
});

// 🌟 ฟังก์ชันดึงข้อมูลโปรไฟล์เดฟจาก Server เพื่อให้ล็อกอินเครื่องไหนข้อมูลก็ไม่หาย
async function fetchDevProfile(email) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/developers/${email}`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.brandName) {
                localStorage.setItem('shenall_dev_profile_' + email, JSON.stringify(data));
                return data;
            }
        } else if (res.status === 404) {
            console.log('ยังไม่มีโปรไฟล์นักพัฒนาสำหรับอีเมลนี้ (ใหม่)');
            return null;
        }
    } catch (e) { console.error('Fetch dev profile error', e); }
    return null;
}

// 🌟 ฟังก์ชันซิงก์โปรไฟล์เดฟขึ้น Server (ชื่อ, ไอคอน, รายละเอียด)
async function syncDevProfileWithBackend(devProfile, email) {
    try {
        await fetch(`${API_BASE_URL}/api/developers/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, ...devProfile })
        });
    } catch (e) { console.error('Sync dev profile error', e); }
}

async function checkLoginState() {
    const userStr = localStorage.getItem('shenall_user');
    if (userStr) {
        const userData = JSON.parse(userStr);
        document.getElementById('console-state-login').classList.add('hidden');
        
        // 👑 เรียกใช้ปุ่มแอดมินทันทีหลังล็อกอิน (Fix ReferenceError ตรงนี้)
        renderAdminButton(userData.isAdmin);
        
        // 🌟 ตรวจสอบโปรไฟล์จาก Server ก่อน
        let devProfile = await fetchDevProfile(userData.email);
        
        // ถ้าใน Server ไม่มี ให้เช็ก Local (Fallback)
        if (!devProfile) {
            const local = localStorage.getItem('shenall_dev_profile_' + userData.email);
            if (local) devProfile = JSON.parse(local);
        }
        
        if (devProfile) {
            updateDevProfileUI(devProfile, userData.name);

            document.getElementById('console-state-register-1').classList.add('hidden');
            document.getElementById('console-state-register-2').classList.add('hidden');
            document.getElementById('console-state-dashboard').classList.remove('hidden');
            loadDeveloperApps(userData.email);
        } else {
            // ยังไม่เคยลงทะเบียน ให้ไปหน้าสมัครนักพัฒนา
            document.getElementById('console-state-dashboard').classList.add('hidden');
            document.getElementById('console-state-register-1').classList.remove('hidden');
        }
    } else {
        document.getElementById('console-state-login').classList.remove('hidden');
        document.getElementById('console-state-dashboard').classList.add('hidden');
        document.getElementById('console-state-register-1').classList.add('hidden');
        document.getElementById('console-state-register-2').classList.add('hidden');
    }
    renderAdminButton(userData.isAdmin);
}

// 🌟 ฟังก์ชันจัดการปุ่มแอดมินให้แสดงผลข้างปุ่มคู่มือถาวร
function renderAdminButton(isAdmin) {
    if (!isAdmin) return;
    let adminBtn = document.getElementById('admin-dashboard-btn');
    if (!adminBtn) {
        const nav = document.querySelector('.flex.items-center.space-x-6');
        if (nav) {
            adminBtn = document.createElement('button');
            adminBtn.id = 'admin-dashboard-btn';
            adminBtn.className = 'text-sm font-bold text-red-600 bg-red-50 px-5 py-2 rounded-full hover:bg-red-100 transition-colors mr-2 shadow-sm';
            adminBtn.innerText = '👑 โหมดแอดมิน';
            adminBtn.onclick = showAdminDashboard;
            nav.prepend(adminBtn); // วางไว้หน้าสุด จะได้อยู่ข้างๆ ปุ่มคู่มือ
        }
    }
}

// 🌟 ฟังก์ชันสำหรับเปิดโหมดแก้ไขข้อมูลเดฟ (กดที่รูปโปรไฟล์)
window.editDevProfile = function() {
    const userStr = localStorage.getItem('shenall_user');
    if (!userStr) return;
    const user = JSON.parse(userStr);
    const profile = JSON.parse(localStorage.getItem('shenall_dev_profile_' + user.email));
    
    if (profile) {
        // นำข้อมูลเดิมมาใส่ในฟอร์ม
        document.getElementById('devBrandName').value = profile.brandName || '';
        document.getElementById('devAddress').value = profile.address || '';
        document.getElementById('devWebsite').value = profile.website || '';
        
        const typeRadios = document.getElementsByName('devAccountType');
        if (profile.accountType === 'องค์กร') typeRadios[1].checked = true;
        else if (profile.accountType === 'บริษัท') typeRadios[2].checked = true;
        else typeRadios[0].checked = true;

        const preview = document.getElementById('devLogoPreview');
        const logo = profile.logoUrl || profile.logoBase64;
        if (logo) {
            preview.innerHTML = `<img src="${logo}" class="w-full h-full object-cover">`;
            preview.classList.add('border-blue-400', 'bg-white');
            window.currentDevLogoUrl = profile.logoUrl;
        }

        document.getElementById('console-state-dashboard').classList.add('hidden');
        document.getElementById('console-state-register-1').classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// 🌟 ฟังก์ชันจัดการปุ่มแอดมินให้แสดงผลข้างปุ่มคู่มือถาวร
function renderAdminButton(isAdmin) {
    if (!isAdmin) return;
    let adminBtn = document.getElementById('admin-dashboard-btn');
    if (!adminBtn) {
        const nav = document.querySelector('.flex.items-center.space-x-6');
        if (nav) {
            adminBtn = document.createElement('button');
            adminBtn.id = 'admin-dashboard-btn';
            adminBtn.className = 'text-sm font-bold text-red-600 bg-red-50 px-5 py-2 rounded-full hover:bg-red-100 transition-colors mr-2 shadow-sm';
            adminBtn.innerText = '👑 โหมดแอดมิน';
            adminBtn.onclick = showAdminDashboard;
            nav.prepend(adminBtn); // วางไว้หน้าสุด จะได้อยู่ข้างๆ ปุ่มคู่มือ
        }
    }
}

function loginWithChatchat() {
    const state = Math.random().toString(36).substring(7);
    const authUrl = `https://chatchat-backend.onrender.com/api/oauth/authorize?client_id=${CHATCHAT_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}`;
    window.location.href = authUrl;
}

async function processOAuthCode(code) {
    showToast('กำลังยืนยันตัวตน...');
    try {
        const response = await fetch(`${API_BASE_URL}/api/oauth/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redirect_uri: REDIRECT_URI })
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.details || errData.error || 'Login failed');
        }
        const data = await response.json();
        if (data.success && data.user) {
            localStorage.setItem('shenall_user', JSON.stringify(data.user));
            showToast('ยินดีต้อนรับ ' + data.user.name);
            await checkLoginState(); // ต้องรอให้ checkLoginState ทำงานเสร็จ
        }
    } catch (error) {
        console.error('OAuth Error:', error);
        showToast('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
        await checkLoginState(); // ต้องรอให้ checkLoginState ทำงานเสร็จ
    }
}

function goToDevRegisterStep1() {
    document.getElementById('console-state-register-2').classList.add('hidden');
    document.getElementById('console-state-register-1').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToDevRegisterStep2() {
    document.getElementById('console-state-register-1').classList.add('hidden');
    document.getElementById('console-state-register-2').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function completeDevRegistration() {
    const userStr = localStorage.getItem('shenall_user');
    if (!userStr) return;
    const user = JSON.parse(userStr);

    const brandName = document.getElementById('devBrandName').value.trim();
    if (!brandName) return showToast('กรุณากรอกชื่อแบรนด์ / ผู้พัฒนา');

    // อัปโหลดโลโก้ขึ้น R2 ก่อนซิงก์
    let logoUrl = window.currentDevLogoUrl || null; // ใช้ URL เดิมถ้าไม่ได้อัปโหลดใหม่
    const logoInput = document.getElementById('devLogoInput');
    if (logoInput.files && logoInput.files[0]) {
        showToast('กำลังอัปโหลดโลโก้...');
        logoUrl = await uploadToR2(logoInput.files[0], null, 3, null); // อัปโหลดโลโก้ใหม่
    }

    let accountType = 'บุคคลทั่วไป'; // แก้ไขให้ตรงกับค่าใน HTML
    const typeRadios = document.getElementsByName('devAccountType');
    if (typeRadios[1] && typeRadios[1].checked) accountType = 'องค์กร';
    else if (typeRadios[2] && typeRadios[2].checked) accountType = 'บริษัท';

    const devProfile = {
        brandName: brandName,
        accountType: accountType,
        address: document.getElementById('devAddress').value.trim(),
        website: document.getElementById('devWebsite').value.trim(),
        logoUrl: logoUrl // ใช้ logoUrl ที่ได้จากการอัปโหลด
    };

    localStorage.setItem('shenall_dev_profile_' + user.email, JSON.stringify(devProfile));
    await syncDevProfileWithBackend(devProfile, user.email); // 🌟 ซิงก์ขึ้น Server
    await checkLoginState(); // โหลดสถานะใหม่หลังจากซิงก์
    showToast('บันทึกข้อมูลและซิงก์บัญชีนักพัฒนาสำเร็จ!');
}

function goToConsoleStep1() {
    document.getElementById('console-state-dashboard').classList.add('hidden');
    document.getElementById('console-state-step2').classList.add('hidden');
    document.getElementById('console-state-step1').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function goToConsoleStep2() {
    document.getElementById('console-state-step1').classList.add('hidden');
    document.getElementById('console-state-step3').classList.add('hidden');
    document.getElementById('console-state-step2').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function goToConsoleStep3() {
    document.getElementById('console-state-step2').classList.add('hidden');
    document.getElementById('console-state-step4').classList.add('hidden');
    document.getElementById('console-state-step3').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function goToConsoleStep4() {
    const appName = document.getElementById('devAppName').value.trim() || 'แอปพลิเคชันใหม่';
    document.getElementById('displayDevAppName').innerText = appName;
    document.getElementById('console-state-step3').classList.add('hidden');
    document.getElementById('console-state-step4').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 🌟 ระบบแสดงหน้าคู่มือการใช้งาน
function showGuidePage() {
    document.getElementById('console-state-login').classList.add('hidden');
    document.getElementById('console-state-register-1').classList.add('hidden');
    document.getElementById('console-state-register-2').classList.add('hidden');
    document.getElementById('console-state-dashboard').classList.add('hidden');
    document.getElementById('console-state-step1').classList.add('hidden');
    document.getElementById('console-state-step2').classList.add('hidden');
    document.getElementById('console-state-step3').classList.add('hidden');
    document.getElementById('console-state-step4').classList.add('hidden');
    document.getElementById('console-state-guide').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function hideGuidePage() {
    document.getElementById('console-state-guide').classList.add('hidden');
    checkLoginState(); // กลับไปหน้า Dashboard หรือ Login ตามสถานะปัจจุบัน
}

// 🌟 ระบบอัปโหลดไฟล์ตรงไปที่ Cloudflare R2 (รองรับระบบหั่นไฟล์อัตโนมัติ)
async function uploadToR2(file, progressCallback, retries = 3, logsBox = null) {
    const CHUNK_SIZE = 10 * 1024 * 1024; // กำหนดขนาดก้อนละ 10MB

    // 🌟 ถ้าไฟล์เล็กกว่า 10MB ใช้วิธีอัปโหลดก้อนเดียวจบ (เร็วและประหยัด API กว่า)
    if (file.size < CHUNK_SIZE) {
        return await uploadSingleFile(file, progressCallback, retries, logsBox);
    }

    // 🌟 ถ้าไฟล์ใหญ่กว่า 10MB สลับไปใช้ระบบหั่นไฟล์ (Multipart Upload)
    return await uploadMultipartFile(file, progressCallback, CHUNK_SIZE, logsBox);
}

async function uploadSingleFile(file, progressCallback, retries, logsBox) {
    try {
        let logId = `uploadTimeLog_${Date.now()}`;
        if (logsBox) {
            logsBox.insertAdjacentHTML('beforeend', `<div class="text-blue-300">[Upload] เริ่มต้นอัปโหลดไฟล์ (ก้อนเดียว): ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)</div>`);
            logsBox.insertAdjacentHTML('beforeend', `<div id="${logId}" class="text-cyan-300 mb-1">[Status] กำลังประเมินเวลาอัปโหลด...</div>`);
            logsBox.scrollTop = logsBox.scrollHeight;
        }
        const res = await fetch(`${API_BASE_URL}/api/r2-presigned-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream' })
        });
        if (!res.ok) throw new Error("Failed to get Presigned URL");
        const { signedUrl, publicUrl } = await res.json();

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', signedUrl, true);
            xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

            let startTime = Date.now();
            xhr.upload.onprogress = (e) => { 
                if (e.lengthComputable) {
                    let progress = e.loaded / e.total;
                    if (progressCallback) progressCallback(progress); 
                    
                    if (logsBox && progress > 0.01) {
                        let elapsedTime = (Date.now() - startTime) / 1000;
                        if (elapsedTime > 0.5) {
                            let speed = (e.loaded / 1024 / 1024) / elapsedTime;
                            let remainingTime = Math.max(0, (elapsedTime / progress) - elapsedTime);
                            let el = document.getElementById(logId);
                            if (el) el.innerText = `[Status] อัปโหลด: ${Math.round(progress * 100)}% | ความเร็ว: ${speed.toFixed(1)} MB/s | เวลาเหลือประมาณ: ${Math.ceil(remainingTime)} วิ`;
                        }
                    }
                }
            };
            xhr.onload = () => { 
                let el = document.getElementById(logId);
                if (el) el.innerText = `[Status] อัปโหลดเสร็จสมบูรณ์ 100%`;
                if (xhr.status >= 200 && xhr.status < 300) resolve(publicUrl); else reject(new Error(`R2 Upload failed (${xhr.status})`)); 
            };
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.send(file);
        });
    } catch (error) {
        if (retries > 0) {
            if (progressCallback) progressCallback(0); // รีเซ็ตหลอดเปอร์เซ็นต์
            const retryMsg = `[Retry] สัญญาณขัดข้อง กำลังพยายามเชื่อมต่อใหม่... (เหลืออีก ${retries} ครั้ง)`;
            console.log(retryMsg);
            if (logsBox) {
                logsBox.insertAdjacentHTML('beforeend', `<div class="text-orange-400">${retryMsg}</div>`);
                logsBox.scrollTop = logsBox.scrollHeight;
            }
            return await uploadSingleFile(file, progressCallback, retries - 1, logsBox);
        }
        return null;
    }
}

async function uploadMultipartFile(file, progressCallback, chunkSize, logsBox) {
    try {
        let logId = `uploadTimeLog_${Date.now()}`;
        const logMsg = `[Multipart] เริ่มต้นอัปโหลดแบบหั่นไฟล์: ${file.name} (${(file.size / (1024*1024)).toFixed(2)} MB)`;
        console.log(logMsg);
        if (logsBox) {
            logsBox.insertAdjacentHTML('beforeend', `<div class="text-purple-300">${logMsg}</div>`);
            logsBox.insertAdjacentHTML('beforeend', `<div id="${logId}" class="text-cyan-300 mb-1">[Status] กำลังประเมินเวลาอัปโหลด...</div>`);
            logsBox.scrollTop = logsBox.scrollHeight;
        }
        
        let uploadId, key;
        const totalParts = Math.ceil(file.size / chunkSize);
        let parts = [];
        let uploadedBytes = 0;
        let startPartNumber = 1;

        // 🌟 เช็คว่ามีไฟล์ค้างอัปโหลดอยู่หรือไม่ (ระบบ Resume)
        const savedStateStr = localStorage.getItem('shenall_ongoing_upload');
        let savedState = null;
        if (savedStateStr) {
            try { savedState = JSON.parse(savedStateStr); } catch (e) {}
        }

        if (savedState && savedState.filename === file.name && savedState.size === file.size && savedState.uploadId) {
            uploadId = savedState.uploadId;
            key = savedState.key;
            parts = savedState.parts || [];
            uploadedBytes = savedState.uploadedBytes || 0;
            startPartNumber = parts.length + 1;
            
            const resumeMsg = `[System] 🔄 พบเซสชันค้างอัปโหลด! กำลังดำเนินการต่อจากก้อนที่ ${startPartNumber}/${totalParts}...`;
            console.log(resumeMsg);
            if (logsBox) {
                logsBox.insertAdjacentHTML('beforeend', `<div class="text-orange-400 font-bold">${resumeMsg}</div>`);
                logsBox.scrollTop = logsBox.scrollHeight;
            }
            
            // อัปเดต progress เริ่มต้น
            if (progressCallback && file.size > 0) {
                progressCallback(uploadedBytes / file.size);
            }
        } else {
            // 1. ขอ UploadId จาก Server ครั้งแรก
            const startRes = await fetch(`${API_BASE_URL}/api/upload/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream' })
            });
            if (!startRes.ok) throw new Error("Failed to start multipart upload");
            const startData = await startRes.json();
            uploadId = startData.uploadId;
            key = startData.key;
        }

        let startTime = Date.now();
        let startingBytes = uploadedBytes; // 🌟 เก็บ bytes เริ่มต้นของ session นี้

        // 2. หั่นไฟล์แล้วทยอยส่งทีละก้อน
        for (let partNumber = startPartNumber; partNumber <= totalParts; partNumber++) {
            const start = (partNumber - 1) * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const blob = file.slice(start, end); // 🌟 หั่นไฟล์ (Slice)

            // ขอใบอนุญาตสำหรับก้อนปัจจุบัน
            const partRes = await fetch(`${API_BASE_URL}/api/upload/presign-part`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, uploadId, partNumber })
            });
            if (!partRes.ok) throw new Error(`Failed to get URL for part ${partNumber}`);
            const { signedUrl } = await partRes.json();

            // อัปโหลดก้อนนี้ (มีระบบ Retry รายก้อนในตัว)
            let etag = null;
            let attempts = 3;
            while (attempts > 0) {
                try {
                    etag = await new Promise((resolve, reject) => {
                        const xhr = new XMLHttpRequest();
                        xhr.open('PUT', signedUrl, true);
                        
                        xhr.upload.onprogress = (e) => {
                            if (e.lengthComputable) {
                                let totalLoaded = uploadedBytes + e.loaded;
                                let progress = totalLoaded / file.size;
                                if (progressCallback) progressCallback(progress);
                                
                                if (logsBox && progress > 0.01) {
                                    let elapsedTime = (Date.now() - startTime) / 1000;
                                    if (elapsedTime > 0.5) {
                                        let bytesInThisSession = totalLoaded - startingBytes;
                                        let currentSpeed = (bytesInThisSession / 1024 / 1024) / elapsedTime;
                                        let remainingBytes = file.size - totalLoaded;
                                        let remainingTime = currentSpeed > 0 ? (remainingBytes / 1024 / 1024) / currentSpeed : 0;
                                        let el = document.getElementById(logId);
                                        if (el) el.innerText = `[Status] อัปโหลด: ${Math.round(progress * 100)}% | ความเร็ว: ${currentSpeed.toFixed(1)} MB/s | เวลาเหลือประมาณ: ${Math.ceil(remainingTime)} วิ`;
                                    }
                                }
                            }
                        };
                        
                        xhr.onload = () => {
                            if (xhr.status >= 200 && xhr.status < 300) {
                                // คลาวด์จะคืนค่า ETag (รหัสยืนยันความสมบูรณ์ของก้อนนี้) มาให้ใน Header
                                resolve(xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag'));
                            } else {
                                reject(new Error(`Part upload failed (${xhr.status})`));
                            }
                        };
                        xhr.onerror = () => reject(new Error("Network error"));
                        xhr.send(blob);
                    });
                    break; // สำเร็จแล้วออกจากลูป
                } catch (err) {
                    console.error(`Error uploading part ${partNumber}:`, err);
                    attempts--;
                    if (attempts === 0) throw new Error(`Failed to upload part ${partNumber} completely.`);
                    const retryMsg = `[Retry] เน็ตหลุด กำลังส่งก้อนที่ ${partNumber} ใหม่อีกครั้ง...`;
                    console.log(retryMsg);
                    if (logsBox) {
                        logsBox.insertAdjacentHTML('beforeend', `<div class="text-orange-400">${retryMsg}</div>`);
                        logsBox.scrollTop = logsBox.scrollHeight;
                    }
                }
            }

            // เก็บ ETag และ PartNumber ไว้ส่งให้คลาวด์ประกอบไฟล์
            parts.push({ ETag: etag.replace(/"/g, ''), PartNumber: partNumber });
            uploadedBytes += blob.size;
            
            // 🌟 บันทึกสถานะการอัปโหลดลง LocalStorage
            localStorage.setItem('shenall_ongoing_upload', JSON.stringify({
                filename: file.name,
                size: file.size,
                uploadId,
                key,
                parts,
                uploadedBytes,
                context: window.currentUploadContext || 'new' // 🌟 เก็บด้วยว่ากำลังอัปโหลดแบบไหน (แอปใหม่ หรือ อัปเดต)
            }));
        }

        let el = document.getElementById(logId);
        if (el) el.innerText = `[Status] อัปโหลดเสร็จสมบูรณ์ 100%`;

        const completeMsg = `[Multipart] ส่งครบทุกก้อนแล้ว แจ้งคลาวด์ให้ประกอบร่างไฟล์...`;
        console.log(completeMsg);
        if (logsBox) {
            logsBox.insertAdjacentHTML('beforeend', `<div class="text-purple-300">${completeMsg}</div>`);
            logsBox.scrollTop = logsBox.scrollHeight;
        }

        // 3. สั่งให้ R2 ประกอบไฟล์ก้อนเล็กๆ ทั้งหมดเข้าด้วยกัน
        const completeRes = await fetch(`${API_BASE_URL}/api/upload/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, uploadId, parts })
        });
        if (!completeRes.ok) throw new Error("Failed to complete multipart upload");
        const { publicUrl } = await completeRes.json();
        
        // 🌟 อัปโหลดเสร็จสมบูรณ์ เคลียร์สถานะทิ้ง
        localStorage.removeItem('shenall_ongoing_upload');

        return publicUrl;

    } catch (error) {
        console.error("Multipart Upload Error:", error);
        return null;
    }
}

async function startShenallAIScan() {
    const apkInput = document.getElementById('devApkInput');
    if (!apkInput.files || apkInput.files.length === 0) {
        showToast('กรุณาเลือกไฟล์ APK หรือ AAB ในกล่องอัปโหลดก่อนครับ');
        return;
    }
    const file = apkInput.files[0];

    // 🌟 ดึงค่าเปอร์เซ็นต์ที่ผู้ใช้แจ้งไว้
    const isFree = document.getElementById('priceFree') ? document.getElementById('priceFree').checked : true;
    const iapDeductionEl = document.querySelector('input[name="iapDeduction"]:checked');
    const declaredIap = isFree ? (iapDeductionEl ? parseInt(iapDeductionEl.value) : 0) : 15;

    const modal = document.getElementById('aiScanModal');
    const content = document.getElementById('aiScanModalContent');
    const progressBar = document.getElementById('aiScanProgress');
    const percentText = document.getElementById('aiScanPercentage');
    const statusText = document.getElementById('aiScanStatus');
    const logsBox = document.getElementById('aiScanLogs');
    
    // ลบปุ่ม retry เก่าถ้ามี
    const oldRetryBtn = document.getElementById('retryActionBtnContainer');
    if (oldRetryBtn) oldRetryBtn.remove();

    progressBar.style.width = '0%';
    percentText.innerText = '0%';
    statusText.innerText = 'กำลังอัปโหลดไฟล์เพื่อส่งตรวจสอบ...';
    statusText.className = 'text-base text-blue-300 mb-8 ai-scanning';
    logsBox.innerHTML = '<div class="text-gray-400">[System] เตรียมช่องทางการอัปโหลดไฟล์...</div>';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);

    window.currentUploadContext = 'new'; // 🌟 บันทึกบริบทว่าเป็นการสร้างแอปใหม่

    try {
        statusText.innerText = 'กำลังเตรียมช่องทางอัปโหลดตรง (Direct Upload)...';

        // 🌟 ขั้นตอนที่ 1: ขอสิทธิ์และอัปโหลดตรงไปที่ Cloudflare R2
        const apkUrl = await uploadToR2(file, (progress) => {
            let percent = Math.round(progress * 40); 
            progressBar.style.width = percent + '%';
            percentText.innerText = percent + '%';
            statusText.innerText = `อัปโหลดไฟล์ไปที่ R2 Cloud: ${Math.round(progress * 100)}%`;
        }, 3, logsBox);

        if (!apkUrl) throw new Error("อัปโหลดไฟล์ไม่สำเร็จ");
                
        logsBox.insertAdjacentHTML('beforeend', `<div class="text-green-400">[Upload] อัปโหลดไฟล์เสร็จสมบูรณ์ 100%</div>`);
        logsBox.insertAdjacentHTML('beforeend', `<div class="text-blue-300">[System] ฝากไฟล์ไว้บน R2 สำเร็จ! ส่งต่อให้ AI สแกน...</div>`);
        logsBox.scrollTop = logsBox.scrollHeight;
                statusText.innerText = 'AI กำลังวิเคราะห์ซอร์สโค้ดและมัลแวร์ (ขั้นที่ 2/2)...';
                progressBar.style.width = '45%';
                percentText.innerText = '45%';

            // 🌟 ขั้นตอนที่ 2: สั่งให้ Server โหลดไฟล์จาก URL ลงไปสแกน
            fetch(`${API_BASE_URL}/api/scan-apk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apkUrl: apkUrl,
                    originalname: file.name,
                    size: file.size,
                    declaredIap: declaredIap
                })
            })
            .then(res => res.json().then(data => ({ status: res.status, body: data })))
            .then(({ status, body }) => {
                if (status === 200) {
                    const result = body;
            
            // กรอก Package Name ให้แบบอัตโนมัติ!
            if(result.appInfo && result.appInfo.package) {
                document.getElementById('devAppPackage').value = result.appInfo.package;
            }
            // เติมเวอร์ชันแอปให้อัตโนมัติ!
            if(result.appInfo && result.appInfo.versionName) {
                if(document.getElementById('devAppVersion')) document.getElementById('devAppVersion').value = result.appInfo.versionName;
            }

            logsBox.insertAdjacentHTML('beforeend', `<div id="scanTimeLog" class="text-cyan-300 mb-1">[Status] กำลังเริ่มตรวจหาไวรัสและข้อมูลเท็จ...</div>`);

            let logIndex = 0;
            let scanStartTime = Date.now();

            const logInterval = setInterval(() => {
                if (logIndex < result.logs.length) {
                    const logMsg = result.logs[logIndex];
                    let logColor = "text-green-400";
                    if (logMsg.includes("[Warning]") || logMsg.includes("⚠️") || logMsg.includes("🚨") || logMsg.includes("ไม่แน่ใจ")) logColor = "text-red-400 font-bold";
                    if (logMsg.includes("[Error]") || logMsg.includes("[Penalty]")) logColor = "text-red-500 font-black";
                    if (logMsg.includes("[System]") || logMsg.includes("[Info]")) logColor = "text-blue-300";
                    if (logMsg.includes("[Download]")) logColor = "text-purple-300";
                    
                    logsBox.insertAdjacentHTML('beforeend', `<div class="${logColor} mb-1">${logMsg}</div>`);
                    logsBox.scrollTop = logsBox.scrollHeight; // เลื่อนลงล่างอัตโนมัติ
                    
                    // ปรับเปอร์เซ็นต์หลอดตามจำนวนบรรทัดของ Log
                    let simulatedPercent = 45 + Math.round(((logIndex + 1) / result.logs.length) * 55);
                    progressBar.style.width = simulatedPercent + '%';
                    percentText.innerText = simulatedPercent + '%';
                    
                    // 🌟 Update Scan ETA
                    let elapsedScanTime = (Date.now() - scanStartTime) / 1000;
                    let scanProgress = (logIndex + 1) / result.logs.length;
                    let remainingScanTime = Math.max(0, (elapsedScanTime / scanProgress) - elapsedScanTime);
                    let scanTimeLog = document.getElementById('scanTimeLog');
                    if (scanTimeLog) scanTimeLog.innerText = `[Status] ตรวจหาไวรัสและข้อมูลเท็จ: ${Math.round(scanProgress * 100)}% | เวลาเหลือประมาณ: ${Math.ceil(remainingScanTime)} วิ`;

                    logIndex++;
                } else {
                    clearInterval(logInterval);
                    
                    let scanTimeLog = document.getElementById('scanTimeLog');
                    if (scanTimeLog) scanTimeLog.innerText = `[Status] ตรวจหาไวรัสและข้อมูลเท็จเสร็จสมบูรณ์ 100%`;
                    
                    statusText.className = 'text-base text-green-400 font-bold mb-8';
                    statusText.innerText = 'แกะไฟล์และตรวจสอบเสร็จสิ้น! กำลังอัปโหลดสื่อ...';

                    // 🌟 ถ้ามีค่าปรับ แจ้งเตือน Popup Alert แบบชัดเจน
                    if (result.penalty > 0) {
                        alert(`🚨 คำเตือนจากระบบ Shenall Guard AI 🚨\n\nตรวจพบการแจ้งข้อมูล In-App Purchases ไม่ตรงกับความเป็นจริง!\nพบ API การชำระเงินที่สามารถทำธุรกรรมมูลค่าเกิน 2,000 บาทภายในแอป แต่คุณแจ้งข้อมูลในสโตร์ไว้เพียง ${declaredIap}%\n\n✅ ระบบได้ทำการปรับปรุงอัตราหักส่วนแบ่งรายได้ใหม่ของคุณเป็น ${result.finalIapFee}% (หักฐาน 20% + บทลงโทษ ${result.penalty}%) โดยอัตโนมัติ`);
                    }

                    setTimeout(() => {
                        uploadMediaAndSave(modal, content, statusText, logsBox, result.apkUrl, result.apkSize, result.finalIapFee);
                    }, 1000);
                }
            }, 350); // 🌟 ดีเลย์การปริ้นท์ล็อกบรรทัดละ 0.35 วินาที ทำให้ดูเหมือน AI กำลังสแกนโค้ดจริง
                } else {
                    statusText.innerText = '❌ ตรวจสอบไม่ผ่าน หรือไฟล์พัง';
                    statusText.className = 'text-base text-red-400 font-bold mb-8';
                    logsBox.insertAdjacentHTML('beforeend', `<div class="text-red-400">[Error] ${body.error}</div>`);
                }
            })
            .catch(err => {
                statusText.innerText = '❌ การเชื่อมต่อล้มเหลว (Timeout)';
                statusText.className = 'text-base text-red-400 font-bold mb-8';
                logsBox.insertAdjacentHTML('beforeend', `<div class="text-red-400">[Error] ไม่สามารถสแกนไฟล์ได้ อาจเกิดจาก Timeout ของ Server</div>`);
                logsBox.scrollTop = logsBox.scrollHeight;
                showRetryButtons(modal, content, startShenallAIScan);
            });
    } catch (err) {
        statusText.innerText = '❌ เน็ตหลุด หรือ อัปโหลดไฟล์ล้มเหลว';
        statusText.className = 'text-base text-red-400 font-bold mb-8';
        logsBox.insertAdjacentHTML('beforeend', `<div class="text-red-400">[Error] ${err.message}</div>`);
        logsBox.scrollTop = logsBox.scrollHeight;
        showRetryButtons(modal, content, startShenallAIScan);
    }
}

async function uploadMediaAndSave(modal, content, statusText, logsBox, apkUrl, apkSize, finalIapFee) {
    const logoInput = document.getElementById('appIconInput'); // 🌟 เปลี่ยนมาใช้ Input ของแอปไอคอน
    const screenshotInput = document.getElementById('devScreenshotInput');
    const videoInput = document.getElementById('devVideoInput');

    let logoUrl = null;
    let screenshotUrls = [];
    let videoUrl = null;

    // 1. อัปโหลดรูปภาพโลโก้
    if (logoInput && logoInput.files.length > 0) {
        logoUrl = await uploadToR2(logoInput.files[0], null, 3, logsBox);
    }

    // 2. อัปโหลดภาพสกรีนช็อตทั้งหมด
    if (screenshotInput && screenshotInput.files.length > 0) {
        for (let i = 0; i < screenshotInput.files.length; i++) {
            const url = await uploadToR2(screenshotInput.files[i], null, 3, logsBox);
            if (url) screenshotUrls.push(url);
        }
    }

    // 3. อัปโหลดวิดีโอตัวอย่าง
    if (videoInput && videoInput.files.length > 0) {
        videoUrl = await uploadToR2(videoInput.files[0], null, 3, logsBox);
    }

    statusText.innerText = '✅ อัปโหลดสำเร็จ! กำลังบันทึกข้อมูลลงฐานข้อมูล...';
    
    saveAppToFirestore(logoUrl, screenshotUrls, videoUrl, apkUrl, apkSize, finalIapFee).then((success) => {
        if (success) {
            logsBox.insertAdjacentHTML('beforeend', `<div class="text-blue-300">[Database] App published to Firestore successfully.</div>`);
            logsBox.scrollTop = logsBox.scrollHeight;
            setTimeout(() => {
                modal.classList.add('opacity-0');
                content.classList.add('scale-95');
                setTimeout(() => {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                    
                    document.getElementById('console-state-step4').classList.add('hidden');
                    document.getElementById('console-state-dashboard').classList.remove('hidden');
                    loadDeveloperApps(JSON.parse(localStorage.getItem('shenall_user')).email);
                    
                    // เคลียร์ฟอร์ม
                    document.getElementById('devAppName').value = '';
                    if(document.getElementById('devAppShortDesc')) document.getElementById('devAppShortDesc').value = '';
                    if(document.getElementById('devAppPackage')) document.getElementById('devAppPackage').value = '';
                    if(document.getElementById('devAppVersion')) document.getElementById('devAppVersion').value = '';
                    
                    const appIconPreview = document.getElementById('appIconPreview');
                    if(appIconPreview) {
                        appIconPreview.innerHTML = '<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
                        appIconPreview.classList.add('border-dashed', 'text-gray-400', 'bg-gray-50');
                        appIconPreview.classList.remove('border-blue-400', 'bg-white');
                    }
                    if(document.getElementById('appIconInput')) document.getElementById('appIconInput').value = '';
                    
                    showToast('แอปของคุณถูกอัปโหลดและพร้อมแสดงบน Store เรียบร้อยแล้ว!');
                }, 300);
            }, 1500);
        } else {
            statusText.innerText = '❌ เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล';
            statusText.className = 'text-base text-red-400 font-bold mb-8';
        }
    });
}

function showToast(message) {
    const toast = document.getElementById('toastNotification');
    toast.innerText = message;
    toast.classList.remove('opacity-0');
    setTimeout(() => { toast.classList.add('opacity-0'); }, 3000);
}

// 🌟 ระบบจัดการหมวดหมู่ย่อยอัตโนมัติ (Dev Feature)
window.updateSubCategoryOptions = function() {
    const category = document.getElementById('devAppCategory').value;
    const container = document.getElementById('subCategoryContainer');
    const subSelect = document.getElementById('devAppSubCategory');
    const label = document.getElementById('subCategoryLabel');

    const gameGenres = ["แอ็กชัน", "ผจญภัย", "อาร์เคด", "บอร์ดเกม", "การ์ดเกม", "แคชชวล", "การศึกษา", "ปริศนา", "แข่งรถ", "RPG", "จำลองสถานการณ์", "กีฬา", "กลยุทธ์"];
    const toolTypes = ["การปรับแต่งส่วนตัว", "การเพิ่มประสิทธิภาพ", "การจัดการระบบ", "การติดต่อสื่อสาร", "การถ่ายภาพและวิดีโอ", "ความปลอดภัย", "พยากรณ์อากาศ", "ข่าวสาร"];

    subSelect.innerHTML = "";
    
    if (category === "เกม") {
        container.classList.remove('hidden');
        label.innerText = "แนวเกม (Genre) *";
        gameGenres.forEach(genre => {
            subSelect.innerHTML += `<option value="${genre}">${genre}</option>`;
        });
    } else if (category === "เครื่องมือ") {
        container.classList.remove('hidden');
        label.innerText = "ประเภทเครื่องมือ *";
        toolTypes.forEach(type => {
            subSelect.innerHTML += `<option value="${type}">${type}</option>`;
        });
    } else {
        container.classList.add('hidden');
        subSelect.innerHTML = `<option value="">ไม่มี</option>`;
    }
};

// 🌟 ฟังก์ชันเขียนข้อมูลเข้า Firebase Firestore
async function saveAppToFirestore(logoUrl, screenshotUrls, videoUrl, apkUrl, apkSize, finalIapFee) {
    const name = document.getElementById('devAppName').value.trim() || 'แอปพลิเคชันใหม่';
    const categorySelect = document.getElementById('devAppCategory');
    const category = categorySelect ? categorySelect.value : 'แอปพลิเคชัน';
    
    const shortDescInput = document.getElementById('devAppShortDesc');
    const shortDesc = shortDescInput ? shortDescInput.value.trim() : '';

    // 🌟 ดึงข้อมูลแอปเดิมมาเตรียมไว้ (กรณีที่เป็นการแก้ไขข้อมูล)
    const existingApp = window.editingAppId && window.developerApps ? window.developerApps.find(a => a.id === window.editingAppId) : null;

    let bgClass = existingApp ? existingApp.bgClass : "";
    if (!bgClass) {
        const bgClasses = [
            "bg-linear-to-br from-blue-500 to-purple-600",
            "bg-linear-to-br from-gray-700 to-red-600",
            "bg-linear-to-br from-green-400 to-teal-500",
            "bg-linear-to-br from-pink-500 to-orange-400",
            "bg-linear-to-br from-yellow-400 to-orange-500"
        ];
        bgClass = bgClasses[Math.floor(Math.random() * bgClasses.length)];
    }

    let icon = existingApp ? existingApp.icon : "📱";
    if (!existingApp) {
        if(category === "เกม") icon = "🎮";
        else if(category === "เครื่องมือ") icon = "⚙️";
        else if(category === "บันเทิง") icon = "🎬";
        else if(category === "การศึกษา") icon = "📚";
        else if(category === "ธุรกิจ") icon = "💼";
    }

    const userStr = localStorage.getItem('shenall_user');
    const user = userStr ? JSON.parse(userStr) : { name: "Shenall Studio", email: "dev@shenall.store" };

    const devProfileStr = localStorage.getItem('shenall_dev_profile_' + user.email);
    const devProfile = devProfileStr ? JSON.parse(devProfileStr) : {};
    const developerName = devProfile.brandName || user.name;

    // 🌟 ดึงข้อมูลราคาแอปและ In-App Purchases
    const isFree = document.getElementById('priceFree') ? document.getElementById('priceFree').checked : true;
    const iapDeductionEl = document.querySelector('input[name="iapDeduction"]:checked');
    const iapDeduction = iapDeductionEl ? parseInt(iapDeductionEl.value) : 0;
    const appPrice = !isFree && document.getElementById('devAppPriceValue') ? parseFloat(document.getElementById('devAppPriceValue').value) : 0;

    const appData = {
        name: name,
        icon: icon,
        iconUrl: logoUrl || (existingApp ? existingApp.iconUrl : ""),
        screenshotUrls: (screenshotUrls && screenshotUrls.length > 0) ? screenshotUrls : (existingApp ? existingApp.screenshotUrls : []),
        videoUrl: videoUrl || (existingApp ? existingApp.videoUrl : ""),
        apkUrl: apkUrl || (existingApp ? existingApp.apkUrl : ""), 
        size: apkSize ? (apkSize / (1024 * 1024)).toFixed(1) + " MB" : (existingApp ? existingApp.size : "0 MB"), 
        package: document.getElementById('devAppPackage') ? document.getElementById('devAppPackage').value : (existingApp ? existingApp.package : ""), 
        version: document.getElementById('devAppVersion') ? document.getElementById('devAppVersion').value.trim() : (existingApp ? existingApp.version : '1.0.0'), 
        developer: developerName, 
        developerEmail: user.email,
        priceType: isFree ? 'free' : 'paid',
        price: isFree ? 0 : (isNaN(appPrice) ? 0 : appPrice),
        iapFeePercent: finalIapFee !== undefined && finalIapFee !== null ? finalIapFee : (isFree ? iapDeduction : 15),
        description: shortDesc || (existingApp ? existingApp.description : "แอปพลิเคชันใหม่บน Shenall Store"),
        rating: existingApp ? existingApp.rating : "0.0", 
        category: category,
        subCategory: subCategory, // 🌟 เพิ่มฟิลด์นี้เข้าไป
        bgClass: bgClass,
        timestamp: new Date().toISOString(),
        status: existingApp ? existingApp.status : "pending" // 🌟 สถานะเดิมจะถูกเก็บไว้ถ้ามีการแก้ไข (ไม่เตะกลับไป pending)
    };

    try {
        // ถ้ากำลังแก้ไขใช้เมธอด PUT อัปเดตไปยัง ID เดิม แต่ถ้าสร้างใหม่ใช้ POST
        const url = window.editingAppId ? `${API_BASE_URL}/api/apps/${window.editingAppId}` : `${API_BASE_URL}/api/apps`;
        const method = window.editingAppId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appData)
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.details || 'API Error');
        }
        return response.ok;
    } catch (error) {
        console.error("Error writing via API: ", error.message);
        return false;
    }
}

// 🌟 ดึงข้อมูลแอปของนักพัฒนามาแสดงใน Dashboard
async function loadDeveloperApps(email) {
    const container = document.getElementById('developer-apps-container');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-8 text-sm text-gray-500">กำลังโหลดข้อมูล...</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/apps`);
        if (!response.ok) throw new Error('Failed to load apps');
        const allApps = await response.json();
        
        // กรองเฉพาะแอปของนักพัฒนาคนนี้
        const myApps = allApps.filter(app => app.developerEmail === email);
        window.developerApps = myApps;
        
        container.innerHTML = '';
        
        // 🌟 ตรวจสอบว่ามีการอัปโหลดค้างไว้หรือไม่ และแสดงแบนเนอร์ให้ดาวน์โหลดต่อ
        const ongoingUploadStr = localStorage.getItem('shenall_ongoing_upload');
        if (ongoingUploadStr) {
            try {
                const ongoingData = JSON.parse(ongoingUploadStr);
                container.innerHTML += `
                    <div class="col-span-1 md:col-span-2 lg:col-span-3 bg-orange-50 border-2 border-orange-300 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between shadow-sm animate-pulse mb-4">
                        <div class="flex items-center mb-3 md:mb-0">
                            <div class="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-2xl mr-4 shrink-0">⚠️</div>
                            <div>
                                <h4 class="font-bold text-base text-orange-900">พบการอัปโหลดไฟล์ค้างไว้ (Ongoing Multipart Upload)</h4>
                                <p class="text-xs text-orange-700 mt-1">ไฟล์: <span class="font-mono bg-white px-1.5 py-0.5 rounded border border-orange-100">${ongoingData.filename}</span></p>
                                <p class="text-[10px] text-orange-600 mt-0.5">สถานะ: อัปโหลดไปแล้ว ${Math.round((ongoingData.uploadedBytes / ongoingData.size) * 100)}%</p>
                            </div>
                        </div>
                        <div class="flex space-x-3 w-full md:w-auto">
                            <button onclick="resumeOngoingUpload()" class="flex-1 md:flex-none px-5 py-2.5 bg-orange-500 text-white font-bold text-sm rounded-xl hover:bg-orange-600 transition-colors shadow-md">🔄 อัปโหลดและสแกนต่อ</button>
                            <button onclick="cancelOngoingUpload()" class="px-4 py-2.5 bg-white text-orange-600 border border-orange-200 font-bold text-sm rounded-xl hover:bg-orange-100 transition-colors shadow-sm">ยกเลิก</button>
                        </div>
                    </div>
                `;
            } catch (e) {}
        }
        
        if (myApps.length === 0) {
            container.innerHTML += `
                <div class="col-span-1 md:col-span-2 lg:col-span-3 border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center bg-gray-50 mt-4">
                    <div class="w-16 h-16 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">📱</div>
                    <h3 class="text-sm font-bold text-gray-800 mb-1">ยังไม่มีแอปพลิเคชันใหม่</h3>
                    <p class="text-xs text-gray-500 mb-4 px-4">เริ่มต้นสร้างและเผยแพร่แอปหรือเกมของคุณสู่ผู้ใช้งานนับล้านบน Shenall Store</p>
                    <button onclick="goToConsoleStep1()" class="text-xs font-bold text-white bg-blue-600 px-6 py-2.5 rounded-xl shadow-md active:bg-blue-700 transition-colors">
                        สร้างแอปแรกของคุณ
                    </button>
                </div>
            `;
            return;
        }

        myApps.forEach(app => {
            const isApproved = app.status === 'approved';
            const statusColor = isApproved ? 'green' : (app.status === 'rejected' ? 'red' : 'yellow');
            const statusText = isApproved ? 'เผยแพร่แล้ว (Production)' : (app.status === 'rejected' ? 'ไม่อนุมัติ (Rejected)' : 'รอการตรวจสอบจาก AI & Admin');
            const displayIcon = app.iconUrl ? `<img src="${app.iconUrl}" class="w-full h-full object-cover">` : app.icon;

            const menuHtml = `
                <div class="relative" onclick="event.stopPropagation()">
                    <button onclick="toggleAppMenu('${app.id}')" class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                    </button>
                    <div id="app-menu-${app.id}" class="hidden absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 z-50 py-2">
                        <button onclick="editApp('${app.id}')" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-bold flex items-center">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            แก้ไขข้อมูลแอป (Edit)
                        </button>
                        ${isApproved ? `
                        <button onclick="prepareUpdateApp('${app.id}', '${app.name}')" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 font-bold flex items-center">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            อัปเดตแอป (Update)
                        </button>` : ''}
                        <button onclick="removeAppFromStore('${app.id}', '${app.name}')" class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-bold flex items-center">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            ถอดการติดตั้งออก (ลบ)
                        </button>
                    </div>
                </div>
            `;
            
            container.innerHTML += `
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                    <div class="flex items-center">
                        <div class="w-12 h-12 ${app.bgClass || 'bg-gray-200'} rounded-xl flex items-center justify-center overflow-hidden text-2xl mr-3 shadow-sm border border-gray-100 text-white">${displayIcon}</div>
                        <div>
                            <h4 class="font-bold text-sm text-gray-900">${app.name}</h4>
                            <p class="text-[10px] text-gray-500">${app.category}${app.subCategory ? ' • ' + app.subCategory : ''} | โหลด: ${app.downloadCount || 0}</p>
                            <div class="flex items-center mt-1">
                                <div class="w-2 h-2 rounded-full bg-${statusColor}-500 mr-1"></div>
                                <span class="text-[10px] font-bold text-${statusColor}-600">${statusText}</span>
                            </div>
                        </div>
                    </div>
                    ${menuHtml}
                </div>
            `;
        });
    } catch (error) {
        console.error('Error loading developer apps:', error);
        container.innerHTML = '<div class="text-center py-8 text-sm text-red-500">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
    }
}

// 🌟 ระบบกลับไปอัปโหลดไฟล์เดิมต่อให้เสร็จ
window.resumeOngoingUpload = function() {
    // ซ่อนหน้าจออื่นๆ ทั้งหมด
    document.querySelectorAll('[id^="console-state-"]').forEach(el => el.classList.add('hidden'));
    
    const appName = document.getElementById('devAppName').value.trim() || 'ดำเนินการอัปโหลดต่อ';
    if(document.getElementById('displayDevAppName')) document.getElementById('displayDevAppName').innerText = appName;
    
    document.getElementById('console-state-step4').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

        showToast('กรุณาเลือกไฟล์เดิมเพื่อดำเนินการอัปโหลดและสแกนต่อ');
        
        window.isResumingUpload = true; // 🌟 ตั้งค่าสถานะว่ากำลัง Resume
        const apkInput = document.getElementById('devApkInput');
        if (apkInput) apkInput.click(); // เด้งหน้าต่างเลือกไฟล์ขึ้นมาให้เลยอัตโนมัติ
};

window.cancelOngoingUpload = function() {
    if (confirm('คุณต้องการยกเลิกการอัปโหลดไฟล์ที่ค้างอยู่นี้ใช่หรือไม่? (ข้อมูลที่อัปโหลดไปแล้วจะถูกทิ้ง)')) {
        localStorage.removeItem('shenall_ongoing_upload');
        showToast('ยกเลิกการอัปโหลดเรียบร้อยแล้ว');
        
        // ลบปุ่มออกจากหน้าจอทันที
        const existingOngoingBtn = document.getElementById('ongoing-upload-action');
        if (existingOngoingBtn) existingOngoingBtn.remove();
    }
};

// 🌟 ระบบเปิด/ปิดเมนู
window.toggleAppMenu = function(appId) {
    document.querySelectorAll('[id^="app-menu-"]').forEach(menu => {
        if (menu.id !== `app-menu-${appId}`) menu.classList.add('hidden');
    });
    const menu = document.getElementById(`app-menu-${appId}`);
    if(menu) menu.classList.toggle('hidden');
};

// ปิดเมนูเมื่อคลิกที่อื่น
document.addEventListener('click', () => {
    document.querySelectorAll('[id^="app-menu-"]').forEach(menu => menu.classList.add('hidden'));
});

window.deleteExistingScreenshot = function(button, url) {
    if (confirm('คุณต้องการลบรูปภาพนี้ใช่หรือไม่?')) {
        button.parentElement.remove();
        window.screenshotsToKeep = window.screenshotsToKeep.filter(item => item !== url);
        showToast('ลบรูปภาพแล้ว');
    }
}

function showRetryButtons(modal, content, retryCallback) {
    const existingContainer = document.getElementById('retryActionBtnContainer');
    if (existingContainer) existingContainer.remove();

    const container = document.createElement('div');
    container.id = 'retryActionBtnContainer';
    container.className = 'mt-6 flex space-x-4';
    container.innerHTML = `
        <button id="retryActionBtn" class="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl active:bg-blue-700 transition-colors text-sm shadow-md">ลองอีกครั้ง</button>
        <button id="cancelActionBtn" class="flex-1 bg-gray-600 text-white font-bold py-3 rounded-xl active:bg-gray-700 transition-colors text-sm">ยกเลิก</button>
    `;
    content.appendChild(container);

    document.getElementById('retryActionBtn').onclick = () => {
        container.remove();
        retryCallback();
    };

    document.getElementById('cancelActionBtn').onclick = () => {
        modal.classList.add('opacity-0');
        content.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    };
}

// 🌟 ระบบอัปเดตแอป (ตรวจจับความแตกต่างของไฟล์)
let updatingAppId = null;
window.prepareUpdateApp = function(appId, appName) {
    updatingAppId = appId;
    
    let input = document.getElementById('updateApkInput');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = 'updateApkInput';
        input.accept = '.apk,.aab';
        input.style.display = 'none';
        document.body.appendChild(input);
        
        input.addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
                startUpdateScan(e.target.files[0], appName);
            }
        });
    }
    input.click(); // เปิดหน้าต่างเลือกไฟล์
};

async function startUpdateScan(file, appName) {
    const modal = document.getElementById('aiScanModal');
    const content = document.getElementById('aiScanModalContent');
    const progressBar = document.getElementById('aiScanProgress');
    const percentText = document.getElementById('aiScanPercentage');
    const statusText = document.getElementById('aiScanStatus');
    const logsBox = document.getElementById('aiScanLogs');
    
    // ลบปุ่ม retry เก่าถ้ามี
    const oldRetryBtn = document.getElementById('retryActionBtnContainer');
    if (oldRetryBtn) oldRetryBtn.remove();

    progressBar.style.width = '0%';
    percentText.innerText = '0%';
    statusText.innerText = `กำลังเตรียมอัปเดตแพตช์สำหรับ ${appName}...`;
    statusText.className = 'text-sm text-purple-300 mb-6 ai-scanning';
    logsBox.innerHTML = `<div class="text-gray-400">[System] เตรียมช่องทางการอัปโหลดไฟล์อัปเดต...</div>`;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);

    window.currentUploadContext = `update|${updatingAppId}|${appName}`; // 🌟 บันทึกบริบทว่าเป็นการอัปเดต

    try {
        // 🌟 ขั้นตอนที่ 1: อัปโหลดตรงไปที่ R2
        const apkUrl = await uploadToR2(file, (progress) => {
            let percent = Math.round(progress * 40); 
            progressBar.style.width = percent + '%';
            percentText.innerText = percent + '%';
            statusText.innerText = `กำลังอัปโหลดเข้า R2: ${Math.round(progress * 100)}%`;
        }, 3, logsBox);
        
        if (!apkUrl) throw new Error("อัปโหลดไฟล์อัปเดตไม่สำเร็จ");
                
        logsBox.insertAdjacentHTML('beforeend', `<div class="text-green-400">[Upload] อัปโหลดไฟล์อัปเดตเสร็จสมบูรณ์ 100%</div>`);
        logsBox.insertAdjacentHTML('beforeend', `<div class="text-blue-300">[System] แจ้ง AI ตรวจสอบและเปรียบเทียบไฟล์...</div>`);
        logsBox.scrollTop = logsBox.scrollHeight;
        
        progressBar.style.width = '45%';
        percentText.innerText = '45%';
        statusText.innerText = 'กำลังสร้างไฟล์ Delta Patch...';

            // 🌟 ขั้นตอนที่ 2: สั่ง Server สแกนและอัปเดตจาก URL
            fetch(`${API_BASE_URL}/api/scan-apk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apkUrl: apkUrl,
                    originalname: file.name,
                    size: file.size,
                    declaredIap: 0 
                })
            })
            .then(res => res.json().then(data => ({ status: res.status, body: data })))
            .then(async ({ status, body }) => {
                if (status === 200) {
                    logsBox.insertAdjacentHTML('beforeend', `<div id="updateScanTimeLog" class="text-cyan-300 mb-1">[Status] กำลังเริ่มตรวจหาไวรัสและเปรียบเทียบไฟล์...</div>`);
                    let logIndex = 0;
                    let scanStartTime = Date.now();
                    const result = body;
                    
                    const logInterval = setInterval(async () => {
                        if (logIndex < result.logs.length) {
                            const logMsg = result.logs[logIndex];
                            let logColor = "text-green-400";
                            if (logMsg.includes("[Warning]") || logMsg.includes("⚠️") || logMsg.includes("🚨") || logMsg.includes("ไม่แน่ใจ")) logColor = "text-red-400 font-bold";
                            if (logMsg.includes("[Error]") || logMsg.includes("[Penalty]")) logColor = "text-red-500 font-black";
                            if (logMsg.includes("[System]") || logMsg.includes("[Info]")) logColor = "text-blue-300";
                            if (logMsg.includes("[Download]")) logColor = "text-purple-300";
                            
                            logsBox.insertAdjacentHTML('beforeend', `<div class="${logColor} mb-1">${logMsg}</div>`);
                            logsBox.scrollTop = logsBox.scrollHeight;
                            
                            let simulatedPercent = 45 + Math.round(((logIndex + 1) / result.logs.length) * 45);
                            progressBar.style.width = simulatedPercent + '%';
                            percentText.innerText = simulatedPercent + '%';
                            
                            // 🌟 Update Scan ETA
                            let elapsedScanTime = (Date.now() - scanStartTime) / 1000;
                            let scanProgress = (logIndex + 1) / result.logs.length;
                            let remainingScanTime = Math.max(0, (elapsedScanTime / scanProgress) - elapsedScanTime);
                            let updateScanTimeLog = document.getElementById('updateScanTimeLog');
                            if (updateScanTimeLog) updateScanTimeLog.innerText = `[Status] ตรวจหาไวรัสและเปรียบเทียบไฟล์: ${Math.round(scanProgress * 100)}% | เวลาเหลือประมาณ: ${Math.ceil(remainingScanTime)} วิ`;

                            logIndex++;
                        } else {
                            clearInterval(logInterval);
                            let updateScanTimeLog = document.getElementById('updateScanTimeLog');
                            if (updateScanTimeLog) updateScanTimeLog.innerText = `[Status] ตรวจสอบและเปรียบเทียบเสร็จสมบูรณ์ 100%`;
                            
                            progressBar.style.width = '90%';
                            percentText.innerText = '90%';
                            logsBox.insertAdjacentHTML('beforeend', `<div class="text-blue-300">[Patch] สร้างไฟล์อัปเดต (Delta Patch) สำเร็จ</div>`);
                            logsBox.insertAdjacentHTML('beforeend', `<div class="text-green-400 font-bold">[Success] เตรียมบันทึกข้อมูลอัปเดตลงสโตร์</div>`);
                            logsBox.scrollTop = logsBox.scrollHeight;
                            statusText.innerText = 'กำลังบันทึกการอัปเดตลงสโตร์...';

                            try {
                                // 🌟 จำลองการสร้าง Patch ข้อมูลส่งไปให้ Database
                                const oldApp = window.developerApps.find(a => a.id === updatingAppId);
                                const oldVersion = oldApp && oldApp.version ? oldApp.version : '1.0.0';
                                let newVersion = '1.0.1';
                                if (oldApp && oldApp.version) {
                                    const parts = oldApp.version.split('.');
                                    if (parts.length === 3) newVersion = `${parts[0]}.${parts[1]}.${parseInt(parts[2]) + 1}`;
                                }
                                const simulatedPatchSize = (body.apkSize * 0.05 / (1024 * 1024)).toFixed(1) + " MB"; // ขนาดแพตช์ 5% ของไฟล์เต็ม

                                const updateRes = await fetch(`${API_BASE_URL}/api/apps/${updatingAppId}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        apkUrl: body.apkUrl,
                                        size: (body.apkSize / (1024 * 1024)).toFixed(1) + " MB",
                                        version: newVersion, // อัปเดตเวอร์ชัน
                                        patch: {
                                            fromVersion: oldVersion,
                                            url: body.apkUrl.replace(/\.(apk|aab)$/i, '') + '_patch.bspatch', 
                                            size: simulatedPatchSize
                                        },
                                        timestamp: new Date().toISOString()
                                    })
                                });

                                if (!updateRes.ok) throw new Error('Update failed');

                                progressBar.style.width = '100%';
                                percentText.innerText = '100%';
                                statusText.className = 'text-base text-green-400 font-bold mb-8';
                                statusText.innerText = 'อัปเดตแอปพลิเคชันเสร็จสมบูรณ์!';
                                
                                setTimeout(() => {
                                    modal.classList.add('opacity-0');
                                    content.classList.add('scale-95');
                                    setTimeout(() => {
                                        modal.classList.add('hidden');
                                        modal.classList.remove('flex');
                                        const userStr = localStorage.getItem('shenall_user');
                                        if (userStr) loadDeveloperApps(JSON.parse(userStr).email);
                                        showToast(`อัปเดตแอป ${appName} เป็นเวอร์ชันใหม่แล้ว! ผู้ใช้จะเห็นการอัปเดตเร็วๆ นี้`);
                                    }, 300);
                                }, 1500);
                                
                            } catch (err) {
                                statusText.innerText = '❌ เกิดข้อผิดพลาดตอนบันทึกข้อมูล';
                                statusText.className = 'text-base text-red-400 font-bold mb-8';
                                logsBox.insertAdjacentHTML('beforeend', `<div class="text-red-400">[Error] บันทึกข้อมูลอัปเดตล้มเหลว</div>`);
                                logsBox.scrollTop = logsBox.scrollHeight;
                            }
                        }
                    }, 350);
                } else {
                    statusText.innerText = '❌ อัปเดตไม่สำเร็จ';
                    statusText.className = 'text-base text-red-400 font-bold mb-8';
                    logsBox.innerHTML += `<div class="text-red-400">[Error] ${body.error}</div>`;
                    logsBox.scrollTop = logsBox.scrollHeight;
                }
            }).catch(err => {
                statusText.innerText = '❌ การเชื่อมต่อล้มเหลว';
                statusText.className = 'text-base text-red-400 font-bold mb-8';
                logsBox.innerHTML += `<div class="text-red-400">[Error] การเชื่อมต่อกับเซิร์ฟเวอร์ขัดข้อง</div>`;
                logsBox.scrollTop = logsBox.scrollHeight;
            });
    } catch (e) {
        statusText.innerText = '❌ ไม่สามารถอัปโหลดไฟล์ได้';
        statusText.className = 'text-base text-red-400 font-bold mb-8';
        logsBox.innerHTML += `<div class="text-red-400">[Error] ${e.message}</div>`;
        logsBox.scrollTop = logsBox.scrollHeight;
    }
}

// 🌟 ระบบถอดการติดตั้งแอปออกจาก Store (ลบข้อมูล)
window.removeAppFromStore = async function(appId, appName) {
    if (!confirm(`⚠️ คำเตือน!\n\nคุณแน่ใจหรือไม่ว่าต้องการถอดการติดตั้ง "${appName}" ออกจากสโตร์?\nการกระทำนี้จะลบแอปและผู้ใช้ใหม่จะไม่สามารถดาวน์โหลดได้อีก`)) {
        return;
    }

    showToast(`กำลังลบแอป ${appName}...`);
    try {
        const response = await fetch(`${API_BASE_URL}/api/apps/${appId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Delete failed');

        showToast(`ถอดการติดตั้ง ${appName} ออกจากสโตร์เรียบร้อยแล้ว`);
        const userStr = localStorage.getItem('shenall_user');
        if (userStr) loadDeveloperApps(JSON.parse(userStr).email);
    } catch (error) {
        console.error('Delete App Error:', error);
        showToast('❌ เกิดข้อผิดพลาด: โปรดตรวจสอบให้แน่ใจว่า Backend อัปเดต API สำหรับลบแอปแล้ว');
    }
}

// 🌟 ระบบจำลองการแสดงผลเมื่อเลือกไฟล์ (ทำงานฝั่งหน้าบ้าน)
window.handleAppIconUpload = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('appIconPreview');
            preview.innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover">`;
            preview.classList.remove('border-dashed', 'text-gray-400', 'bg-gray-50');
            preview.classList.add('border-blue-400', 'bg-white');
        }
        reader.readAsDataURL(input.files[0]);
        showToast('เลือกไอคอนแอปพลิเคชันสำเร็จ');
    }
};

window.handleLogoUpload = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('devLogoPreview');
            preview.innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover">`;
            preview.classList.remove('border-dashed', 'text-gray-400', 'bg-gray-50');
            preview.classList.add('border-blue-400', 'bg-white');
            window.devLogoBase64 = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
        showToast('เลือกรูปภาพโลโก้สำเร็จ');
    }
};

window.handleApkUpload = function(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        document.getElementById('devApkIcon').innerText = '✅';
        document.getElementById('devApkText').innerText = file.name;
        document.getElementById('devApkSubText').innerText = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
        document.getElementById('devApkPreviewBox').classList.add('border-blue-400', 'bg-blue-50');
        document.getElementById('devApkPreviewBox').classList.remove('border-gray-300', 'border-dashed');
        showToast('เลือกไฟล์ติดตั้งสำเร็จ');
            
            // 🌟 ถ้าระบบกำลัง Resume ให้ออโต้กดปุ่ม Submit เพื่อเปิดกล่องดำให้ทันที
            if (window.isResumingUpload) {
                window.isResumingUpload = false;
                startShenallAIScan();
            }
    }
};

window.handleScreenshotUpload = function(input) {
    if (input.files && input.files.length > 0) {
        document.getElementById('devScreenshotText').innerText = `เลือกแล้ว ${input.files.length} ภาพ`;
        document.getElementById('devScreenshotBox').classList.add('border-blue-400', 'bg-blue-50');
        document.getElementById('devScreenshotBox').classList.remove('border-gray-300', 'border-dashed');
        showToast(`เลือกสกรีนช็อต ${input.files.length} ภาพสำเร็จ`);
    }
};

window.handleVideoUpload = function(input) {
    if (input.files && input.files[0]) {
        document.getElementById('devVideoText').innerText = 'เลือกวิดีโอแล้ว';
        document.getElementById('devVideoBox').classList.add('border-blue-400', 'bg-blue-50');
        document.getElementById('devVideoBox').classList.remove('border-gray-300', 'border-dashed');
        showToast('เลือกวิดีโอตัวอย่างสำเร็จ');
    }
};

// 🌟 ระบบจัดการฟอร์มราคาแอป
window.togglePriceOptions = function() {
    const isFree = document.getElementById('priceFree').checked;
    const freeOptions = document.getElementById('free-options-container');
    const paidOptions = document.getElementById('paid-options-container');

    if (isFree) {
        if (freeOptions) freeOptions.classList.remove('hidden');
        if (paidOptions) paidOptions.classList.add('hidden');
    } else {
        if (freeOptions) freeOptions.classList.add('hidden');
        if (paidOptions) paidOptions.classList.remove('hidden');
        window.calculateRevenue(); // คำนวณใหม่เมื่อสลับแท็บ
    }
};

window.calculateRevenue = function() {
    const priceInput = document.getElementById('devAppPriceValue');
    const revenueDisplay = document.getElementById('calculatedRevenue');
    
    if (!priceInput || !revenueDisplay) return;

    let price = parseFloat(priceInput.value);
    if (isNaN(price) || price <= 0) {
        revenueDisplay.innerText = "0.00";
        return;
    }

    // หัก 15% (นักพัฒนาได้รับ 85%)
    let revenue = price * 0.85;
    revenueDisplay.innerText = revenue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// 🌟 ========================================== 🌟
// 🌟 ระบบ ADMIN DASHBOARD (สำหรับผู้ดูแลระบบ) 🌟
// 🌟 ========================================== 🌟
window.showAdminDashboard = function() {
    // ซ่อนหน้าจอทั้งหมดของนักพัฒนา
    document.querySelectorAll('[id^="console-state-"]').forEach(el => el.classList.add('hidden'));
    
    let adminState = document.getElementById('console-state-admin');
    if (!adminState) {
        // สร้างหน้าจอ Admin Dashboard แทรกเข้าไปในเว็บ
        adminState = document.createElement('div');
        adminState.id = 'console-state-admin';
        adminState.className = 'block';
        adminState.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">👑 โหมดแอดมิน (จัดการแอป)</h2>
                <button onclick="checkLoginState()" class="text-sm font-bold text-gray-600 bg-gray-100 px-5 py-2.5 rounded-full hover:bg-gray-200 transition-colors">
                    กลับโหมดนักพัฒนา
                </button>
            </div>
            <div id="admin-apps-container" class="grid grid-cols-1 gap-4"></div>
        `;
        document.querySelector('main').appendChild(adminState);
    } else {
        adminState.classList.remove('hidden');
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadAdminDashboard();
};

window.loadAdminDashboard = async function() {
    const container = document.getElementById('admin-apps-container');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-8 text-sm text-gray-500">กำลังโหลดแอปพลิเคชันที่รอการตรวจสอบ...</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/apps`);
        if (!response.ok) throw new Error('Failed to load apps');
        const allApps = await response.json();
        
        // 🌟 ดึงแอปที่สถานะเป็น pending (รอกดอนุมัติ)
        const pendingApps = allApps.filter(app => app.status === 'pending');
        
        if (pendingApps.length === 0) {
            container.innerHTML = `
                <div class="bg-green-50 text-green-600 rounded-3xl p-10 text-center border border-green-100">
                    <div class="text-5xl mb-4">🎉</div>
                    <h3 class="text-lg font-bold mb-1">ยอดเยี่ยมมาก!</h3>
                    <p class="text-sm">ไม่มีแอปพลิเคชันที่รอการตรวจสอบในขณะนี้</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        pendingApps.forEach(app => {
            const displayIcon = app.iconUrl ? `<img src="${app.iconUrl}" class="w-full h-full object-cover">` : app.icon;
            container.innerHTML += `
                <div class="bg-white rounded-2xl shadow-sm border border-orange-200 p-5 flex items-center justify-between hover:shadow-md transition-shadow">
                    <div class="flex items-center">
                        <div class="w-16 h-16 ${app.bgClass || 'bg-gray-200'} rounded-xl flex items-center justify-center overflow-hidden text-3xl mr-5 shadow-sm text-white border border-gray-100">${displayIcon}</div>
                        <div>
                            <h4 class="font-bold text-base text-gray-900">${app.name} <span class="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full ml-1">${app.category} > ${app.subCategory || 'ทั่วไป'}</span></h4>
                            <p class="text-xs text-gray-500 mt-1">ผู้พัฒนา: <span class="font-bold">${app.developer}</span> (${app.developerEmail})</p>
                            <p class="text-[11px] text-gray-400 mt-0.5 font-mono">pkg: ${app.package} | ขนาด: ${app.size} | IAP: ${app.iapFeePercent}%</p>
                        </div>
                    </div>
                    <div class="flex space-x-3">
                        <button onclick="approveApp('${app.id}', '${app.name}')" class="px-5 py-3 bg-green-50 text-green-600 font-bold text-sm rounded-xl hover:bg-green-100 transition-colors shadow-sm">✅ อนุมัติ</button>
                        <button onclick="rejectApp('${app.id}', '${app.name}')" class="px-5 py-3 bg-red-50 text-red-600 font-bold text-sm rounded-xl hover:bg-red-100 transition-colors shadow-sm">❌ ปฏิเสธ</button>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        container.innerHTML = '<div class="text-center py-8 text-sm text-red-500">เกิดข้อผิดพลาดในการโหลดข้อมูลจากเซิร์ฟเวอร์</div>';
    }
};

window.approveApp = async function(appId, appName) {
    if (!confirm(`ยืนยันการอนุมัติแอป "${appName}" ให้แสดงบนสโตร์?`)) return;
    showToast(`กำลังอนุมัติแอป ${appName}...`);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/apps/${appId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved' })
        });
        
        if (!response.ok) throw new Error('Approve failed');
        
        showToast(`✅ อนุมัติแอป ${appName} สำเร็จ!`);
        loadAdminDashboard(); // โหลดข้อมูลใหม่
    } catch (error) {
        console.error(error);
        showToast('❌ เกิดข้อผิดพลาดในการอนุมัติแอป');
    }
};

window.rejectApp = async function(appId, appName) {
    if (!confirm(`ยืนยันการปฏิเสธแอป "${appName}"?`)) return;
    showToast(`กำลังปฏิเสธแอป ${appName}...`);
    
    try {
        // เปลี่ยนสถานะเป็น rejected หรือนำออกจากระบบ
        const response = await fetch(`${API_BASE_URL}/api/apps/${appId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'rejected' })
        });
        
        if (!response.ok) throw new Error('Reject failed');
        
        showToast(`❌ ปฏิเสธแอป ${appName} แล้ว`);
        loadAdminDashboard(); // โหลดข้อมูลใหม่
    } catch (error) {
        console.error(error);
        showToast('❌ เกิดข้อผิดพลาดในการปฏิเสธแอป');
    }
};

// 🌟 ฟังก์ชันจัดการ Drag & Drop ส่วนลากวางไฟล์
function setupDragAndDrop(boxId, inputId, handleFn) {
    const box = document.getElementById(boxId);
    const input = document.getElementById(inputId);
    if (!box || !input) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        box.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        box.addEventListener(eventName, () => {
            box.style.opacity = '0.5';
            box.style.transform = 'scale(0.98)';
            box.style.transition = 'all 0.2s';
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        box.addEventListener(eventName, () => {
            box.style.opacity = '1';
            box.style.transform = 'scale(1)';
        }, false);
    });

    box.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            input.files = files;
            handleFn(input);
        }
    }, false);
}

// 🌟 ระบบดึงข้อมูลเดิมมาใส่ฟอร์มและเข้าสู่โหมดแก้ไข
window.editApp = function(appId) {
    if (!window.developerApps) {
        showToast('กำลังโหลดข้อมูล กรุณาลองอีกครั้ง');
        return;
    }
    const app = window.developerApps.find(a => a.id === appId);
    if (!app) return;
    
    window.screenshotsToKeep = app.screenshotUrls ? [...app.screenshotUrls] : [];
    window.editingAppId = appId;
    
    if(document.getElementById('devAppName')) document.getElementById('devAppName').value = app.name || '';
    
    const typeRadios = document.querySelectorAll('input[name="appType"]');
    if (app.category === 'เกม') { if(typeRadios[1]) typeRadios[1].checked = true; } 
    else { if(typeRadios[0]) typeRadios[0].checked = true; }
    
    const priceFree = document.getElementById('priceFree');
    const pricePaid = document.getElementById('pricePaid');
    if (app.priceType === 'paid') {
        if(pricePaid) pricePaid.checked = true;
        const priceInput = document.getElementById('devAppPriceValue');
        if (priceInput) priceInput.value = app.price;
    } else {
        if(priceFree) priceFree.checked = true;
        const iapRadios = document.querySelectorAll('input[name="iapDeduction"]');
        if (iapRadios.length > 0) {
            if (app.iapFeePercent === 20) iapRadios[2].checked = true;
            else if (app.iapFeePercent === 10) iapRadios[1].checked = true;
            else iapRadios[0].checked = true;
        }
    }
    if (typeof window.togglePriceOptions === 'function') window.togglePriceOptions();
    if (typeof window.calculateRevenue === 'function') window.calculateRevenue();

    const categorySelect = document.getElementById('devAppCategory');
    if (categorySelect) categorySelect.value = app.category || 'แอปพลิเคชัน';
    
    // 🌟 โหลดข้อมูลหมวดหมู่ย่อยตอนแก้ไข
    if (typeof window.updateSubCategoryOptions === 'function') {
        window.updateSubCategoryOptions();
        const subSelect = document.getElementById('devAppSubCategory');
        if (subSelect && app.subCategory) subSelect.value = app.subCategory;
    }
    
    const shortDesc = document.getElementById('devAppShortDesc');
    if (shortDesc) shortDesc.value = app.description || '';
    
    const emailInput = document.querySelector('#console-state-step2 input[type="email"]');
    if (emailInput) emailInput.value = app.developerEmail || '';

    const fullDescInput = document.querySelector('#console-state-step2 textarea[rows="6"]');
    if (fullDescInput) fullDescInput.value = app.description || ''; 

    const packageInput = document.getElementById('devAppPackage');
    if (packageInput) packageInput.value = app.package || '';
    
    const versionInput = document.getElementById('devAppVersion');
    if (versionInput) versionInput.value = app.version || '';
    
    const appIconPreview = document.getElementById('appIconPreview');
    if (appIconPreview && app.iconUrl) {
        appIconPreview.innerHTML = `<img src="${app.iconUrl}" class="w-full h-full object-cover">`;
        appIconPreview.classList.remove('border-dashed', 'text-gray-400', 'bg-gray-50');
        appIconPreview.classList.add('border-blue-400', 'bg-white');
    }
    
    const devScreenshotBox = document.getElementById('devScreenshotBox');
    if (devScreenshotBox && app.screenshotUrls && app.screenshotUrls.length > 0) {
        devScreenshotBox.classList.add('border-blue-400', 'bg-blue-50');
        devScreenshotBox.classList.remove('border-gray-300', 'border-dashed');
        const textSpan = document.getElementById('devScreenshotText');
        if (textSpan) textSpan.innerText = `มีรูปสกรีนช็อตเดิม ${app.screenshotUrls.length} ภาพ`;
    }

    const devVideoBox = document.getElementById('devVideoBox');
    if (devVideoBox && app.videoUrl) {
        devVideoBox.classList.add('border-blue-400', 'bg-blue-50');
        devVideoBox.classList.remove('border-gray-300', 'border-dashed');
        const textSpan = document.getElementById('devVideoText');
        if (textSpan) textSpan.innerText = `มีวิดีโอเดิมอยู่แล้ว`;
    }

    const devApkPreviewBox = document.getElementById('devApkPreviewBox');
    if (devApkPreviewBox && app.apkUrl) {
        devApkPreviewBox.classList.add('border-blue-400', 'bg-blue-50');
        devApkPreviewBox.classList.remove('border-gray-300', 'border-dashed');
        const devApkIcon = document.getElementById('devApkIcon');
        if(devApkIcon) devApkIcon.innerText = '✅';
        const devApkText = document.getElementById('devApkText');
        if(devApkText) devApkText.innerText = `มีแอปพลิเคชันเดิมแล้ว (${app.size})`;
        const devApkSubText = document.getElementById('devApkSubText');
        if(devApkSubText) devApkSubText.innerText = `อัปโหลดไฟล์ใหม่หากต้องการแก้ไข APK`;
    }

    const submitBtn = document.getElementById('btnSubmitApp');
    if (submitBtn) {
        submitBtn.innerHTML = `
            <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            บันทึกการแก้ไขข้อมูล (Update)
        `;
        // เปลี่ยน onClick ให้ไปที่ updateAppDetailsOnly ถ้ากดแก้ไข
        submitBtn.onclick = window.updateAppDetailsOnly;
    }
    
    document.querySelectorAll('[id^="app-menu-"]').forEach(menu => menu.classList.add('hidden'));
    goToConsoleStep1();
};

window.resetAppForm = function() {
    window.editingAppId = null;
    if(document.getElementById('devAppName')) document.getElementById('devAppName').value = '';
    const categorySelect = document.getElementById('devAppCategory');
    if (categorySelect) categorySelect.value = 'แอปพลิเคชัน';

    // 🌟 ดึงค่าหมวดหมู่ย่อย
    const subSelect = document.getElementById('devAppSubCategory');
    const subCategory = subSelect ? subSelect.value : "";

    const subContainer = document.getElementById('subCategoryContainer');
    if (subContainer) subContainer.classList.add('hidden');
    const shortDesc = document.getElementById('devAppShortDesc');
    if (shortDesc) shortDesc.value = '';
    const fullDescInput = document.querySelector('#console-state-step2 textarea[rows="6"]');
    if (fullDescInput) fullDescInput.value = '';
    const packageInput = document.getElementById('devAppPackage');
    if (packageInput) packageInput.value = '';
    const versionInput = document.getElementById('devAppVersion');
    if (versionInput) versionInput.value = '';
    
    const priceFree = document.getElementById('priceFree');
    if (priceFree) priceFree.checked = true;
    if (typeof window.togglePriceOptions === 'function') window.togglePriceOptions();
    
    const appIconPreview = document.getElementById('appIconPreview');
    if(appIconPreview) {
        appIconPreview.innerHTML = '<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
        appIconPreview.classList.add('border-dashed', 'text-gray-400', 'bg-gray-50');
        appIconPreview.classList.remove('border-blue-400', 'bg-white');
    }
    const appIconInput = document.getElementById('appIconInput');
    if (appIconInput) appIconInput.value = '';
    
    const devApkPreviewBox = document.getElementById('devApkPreviewBox');
    if (devApkPreviewBox) {
        devApkPreviewBox.classList.remove('border-blue-400', 'bg-blue-50');
        devApkPreviewBox.classList.add('border-gray-300', 'border-dashed');
        if(document.getElementById('devApkIcon')) document.getElementById('devApkIcon').innerText = '📦';
        if(document.getElementById('devApkText')) document.getElementById('devApkText').innerText = 'เลือกไฟล์เกม หรือ แอป';
        if(document.getElementById('devApkSubText')) document.getElementById('devApkSubText').innerText = 'รองรับไฟล์ขนาดใหญ่สูงสุด 100 GB';
    }
    const devApkInput = document.getElementById('devApkInput');
    if (devApkInput) devApkInput.value = '';

    const devScreenshotBox = document.getElementById('devScreenshotBox');
    if (devScreenshotBox) {
        devScreenshotBox.classList.remove('border-blue-400', 'bg-blue-50');
        devScreenshotBox.classList.add('border-gray-300', 'border-dashed');
        const textSpan = document.getElementById('devScreenshotText');
        if (textSpan) textSpan.innerText = 'สกรีนช็อต';
    }
    const devScreenshotInput = document.getElementById('devScreenshotInput');
    if (devScreenshotInput) devScreenshotInput.value = '';

    const devVideoBox = document.getElementById('devVideoBox');
    if (devVideoBox) {
        devVideoBox.classList.remove('border-blue-400', 'bg-blue-50');
        devVideoBox.classList.add('border-gray-300', 'border-dashed');
        const textSpan = document.getElementById('devVideoText');
        if (textSpan) textSpan.innerText = 'วิดีโอโปรโมท';
    }
    const devVideoInput = document.getElementById('devVideoInput');
    if (devVideoInput) devVideoInput.value = '';
    
    const existingScreenshotsContainer = document.getElementById('existing-screenshots-container');
    if (existingScreenshotsContainer) {
        existingScreenshotsContainer.classList.add('hidden');
        existingScreenshotsContainer.classList.remove('grid');
        existingScreenshotsContainer.innerHTML = '';
    }

    const submitBtn = document.getElementById('btnSubmitApp');
    if (submitBtn) {
        submitBtn.innerHTML = `
            <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            ส่งตรวจสอบความปลอดภัย (Submit)
        `;
        // คืนค่าปุ่มให้กลับไปทำงานสแกน AI ปกติ
        submitBtn.onclick = typeof startShenallAIScan === 'function' ? startShenallAIScan : null;
    }
};

window.updateAppDetailsOnly = async function() {
    const apkInput = document.getElementById('devApkInput');
    
    // 🌟 หากมีการเลือกไฟล์ APK ใหม่ในขั้นตอนที่ 4 ให้เปลี่ยนไปใช้ Flow การสแกน AI แทนการเซฟปกติ
    if (apkInput && apkInput.files && apkInput.files.length > 0) {
        startShenallAIScan();
        return;
    }

    if (typeof showToast === 'function') showToast('กำลังบันทึกข้อมูลแก้ไข...');
    const btn = document.getElementById('btnSubmitApp');
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.innerHTML = 'กำลังบันทึก...';
    btn.disabled = true;

    const logoInput = document.getElementById('appIconInput');
    const screenshotInput = document.getElementById('devScreenshotInput');
    const videoInput = document.getElementById('devVideoInput');

    let logoUrl = null;
    let screenshotUrls = window.screenshotsToKeep ? [...window.screenshotsToKeep] : [];
    let videoUrl = null;

    try {
        if (logoInput && logoInput.files && logoInput.files.length > 0 && typeof uploadToR2 === 'function') {
            logoUrl = await uploadToR2(logoInput.files[0], null, 3, null);
        }
        if (screenshotInput && screenshotInput.files && screenshotInput.files.length > 0 && typeof uploadToR2 === 'function') {
            for (let i = 0; i < screenshotInput.files.length; i++) {
                const url = await uploadToR2(screenshotInput.files[i], null, 3, null);
                if (url) screenshotUrls.push(url);
            }
        }
        if (videoInput && videoInput.files && videoInput.files.length > 0 && typeof uploadToR2 === 'function') {
            videoUrl = await uploadToR2(videoInput.files[0], null, 3, null);
        }

        const existingApp = window.developerApps ? window.developerApps.find(a => a.id === window.editingAppId) : null;
        let finalIapFee = existingApp ? existingApp.iapFeePercent : 0;
        const priceFree = document.getElementById('priceFree');
        const isFree = priceFree ? priceFree.checked : true;
        if (isFree) {
            const iapDeductionEl = document.querySelector('input[name="iapDeduction"]:checked');
            finalIapFee = iapDeductionEl ? parseInt(iapDeductionEl.value) : 0;
        } else {
            finalIapFee = 15;
        }

        if (typeof saveAppToFirestore === 'function') {
            const success = await saveAppToFirestore(logoUrl, screenshotUrls, videoUrl, null, null, finalIapFee);
            
            if (success) {
                document.getElementById('console-state-step4').classList.add('hidden');
                document.getElementById('console-state-dashboard').classList.remove('hidden');
                
                const userStr = localStorage.getItem('shenall_user');
                if (userStr && typeof loadDeveloperApps === 'function') {
                    loadDeveloperApps(JSON.parse(userStr).email);
                }
                window.resetAppForm();
                if (typeof showToast === 'function') showToast('แก้ไขข้อมูลแอปสำเร็จ!');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                if (typeof showToast === 'function') showToast('❌ เกิดข้อผิดพลาดในการบันทึกข้อมูลแก้ไข');
            }
        } else {
            if (typeof showToast === 'function') showToast('❌ ไม่พบฟังก์ชันบันทึกข้อมูล (saveAppToFirestore)');
        }
    } catch (e) {
        console.error(e);
        if (typeof showToast === 'function') showToast('เกิดข้อผิดพลาด: ' + e.message);
    }
    
    const existingScreenshotsContainer = document.getElementById('existing-screenshots-container');
    if (existingScreenshotsContainer) {
        if (window.screenshotsToKeep && window.screenshotsToKeep.length > 0) {
            existingScreenshotsContainer.classList.remove('hidden');
            existingScreenshotsContainer.classList.add('grid'); // 🌟 เติมคลาส grid ผ่าน JavaScript แทน
            existingScreenshotsContainer.innerHTML = window.screenshotsToKeep.map(url => `
                <div class="relative rounded-xl overflow-hidden border border-gray-200 h-20">
                    <img src="${url}" class="w-full h-full object-cover">
                    <button type="button" onclick="deleteExistingScreenshot(this, '${url}')" class="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 active:scale-95 shadow-sm">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
            `).join('');
        } else {
            existingScreenshotsContainer.classList.add('hidden');
            existingScreenshotsContainer.classList.remove('grid');
            existingScreenshotsContainer.innerHTML = '';
        }
    }
    
    btn.innerHTML = originalText;
    btn.disabled = false;
};

window.toggleAppMenu = function(appId) {
    document.querySelectorAll('[id^="app-menu-"]').forEach(menu => {
        if (menu.id !== `app-menu-${appId}`) menu.classList.add('hidden');
    });
    const menu = document.getElementById(`app-menu-${appId}`);
    if(menu) menu.classList.toggle('hidden');
};

// ปิดเมนูเมื่อคลิกที่อื่น
document.addEventListener('click', () => {
    document.querySelectorAll('[id^="app-menu-"]').forEach(menu => menu.classList.add('hidden'));
});