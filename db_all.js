// รวมข้อมูลทั้งหมดเข้าด้วยกันเพื่อให้ script.js เรียกใช้ได้ง่าย
window.appDatabase = [
    ...(window.db_apps || []),
    ...(window.db_games || []),
    ...(window.db_tools || [])
];

// สั่งวาดข้อมูลลงหน้าจอทันทีเมื่อโหลดไฟล์เสร็จ
document.addEventListener("DOMContentLoaded", () => {
    if (typeof renderApps === 'function') renderApps('all');
});