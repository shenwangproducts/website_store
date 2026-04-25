window.db_games = [
    {
        name: 'Sword Art Online: Integral Factor',
        package: 'com.bandainamcoent.saoifww',
        developer: 'Bandai Namco Entertainment Inc.',
        category: 'เกม',
        icon: '⚔️',
        iconUrl: 'https://play-lh.googleusercontent.com/yU4E0lYy-n3U65gP6R4lC7P_hC5oO6XmS-mNf81F-H2c1pYkGjS4-n-WfE2A3v_FwQ',
        rating: '4.4',
        status: 'approved',
        description: 'ผจญภัยในโลก Aincrad แบบ MMORPG ล่าบอสสุดมันส์',
        version: '2.4.15',
        androidVersion: '9.0 ขึ้นไป',
        bgClass: 'bg-linear-to-br from-blue-500 to-purple-600',
        
        // 🌟 ข้อมูลสำหรับเลือกสถาปัตยกรรม (Architecture)
        downloads: {
            arm64: { url: 'https://cdn.shenall.store/saoif_arm64.apk', size: '312 MB' },
            arm32: { url: 'https://cdn.shenall.store/saoif_arm32.apk', size: '304 MB' },
            emu: { url: 'https://cdn.shenall.store/saoif_x86.apk', size: '320 MB' }
        },
        
        // 🌟 ข้อมูลสำหรับ Delta Patch (อัปเดตแบบลบส่วนต่าง โหลดแค่ 8MB ไม่ต้องโหลดใหม่ 312MB)
        patch: {
            fromVersion: '2.4.14', 
            url: 'https://cdn.shenall.store/saoif_patch.bspatch',
            size: '8.5 MB'
        }
    }
];