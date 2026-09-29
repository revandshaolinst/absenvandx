
  // ==========================================
  // MASTER SCRIPT PRESENSIKU v6.0 (DYNAMIC DASHBOARD & KIOSK FULL)
  // ==========================================

  const API_URL = 'http://localhost:3000/api';
  let base64File = null;

  async function checkAuth(roleRequired = 'Employee') {
    let token = localStorage.getItem('presensi_admin_token') || localStorage.getItem('presensi_token');
    if (!token) { window.location.href = 'login.html'; return null; }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (roleRequired === 'HR' && payload.role !== 'HR' && payload.role !== 'Admin') {
         alert('Akses Ditolak! Halaman ini khusus HRD/Admin.'); window.location.href = 'dashboard.html'; return null;
      }
    } catch(e) {}
    return token;
  }

  window.toggleSidebar = function() {
    const sidebar = document.getElementById('app-sidebar') || document.getElementById('mainSidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) {
      if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full'); if(backdrop) backdrop.classList.remove('hidden');
      } else {
        sidebar.classList.add('-translate-x-full'); if(backdrop) backdrop.classList.add('hidden');
      }
    }
  };

  window.approveRequest = async function(id) {
    const token = await checkAuth('HR'); if(!token) return;
    try {
      const res = await fetch(API_URL + '/admin/leaves/' + id + '/approve', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
      if(res.ok) { alert('✅ Pengajuan Berhasil Disetujui!'); window.location.reload(); }
    } catch(e) {}
  };
  window.rejectRequest = async function(id) {
    const token = await checkAuth('HR'); if(!token) return;
    try {
      const res = await fetch(API_URL + '/admin/leaves/' + id + '/reject', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
      if(res.ok) { alert('❌ Pengajuan Telah Ditolak!'); window.location.reload(); }
    } catch(e) {}
  };

  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        document.getElementById('fileNameText').textContent = e.target.files[0].name;
        document.getElementById('uploadedFileName').classList.remove('hidden');
        document.getElementById('uploadedFileName').classList.add('flex');
        const reader = new FileReader();
        reader.onload = (event) => { base64File = event.target.result; };
        reader.readAsDataURL(e.target.files[0]);
      }
    });
  }
  window.clearFile = function(e) {
    if (e) e.stopPropagation();
    if (fileInput) fileInput.value = '';
    base64File = null;
    document.getElementById('uploadedFileName').classList.add('hidden');
    document.getElementById('uploadedFileName').classList.remove('flex');
  };

  document.body.addEventListener('click', async (e) => {
    const el = e.target.closest('button, a');
    if (!el) return;
    if (el.hasAttribute('onclick') && el.getAttribute('onclick').includes('Request')) return; 

    const text = el.textContent.toLowerCase();
    
    // NOTIFIKASI BELL
    const isNotifBtn = el.getAttribute('aria-label') === 'Notifikasi' || el.closest('button[aria-label="Notifikasi"]');
    if (isNotifBtn) {
       e.preventDefault();
       const notifBtn = el.getAttribute('aria-label') === 'Notifikasi' ? el : el.closest('button[aria-label="Notifikasi"]');
       let dropdown = document.getElementById('notifDropdown');
       
       if (dropdown) {
         dropdown.remove();
       } else {
         dropdown = document.createElement('div');
         dropdown.id = 'notifDropdown';
         dropdown.className = 'fixed top-16 right-4 sm:right-8 w-80 bg-surface-container-lowest shadow-lg rounded-xl border border-surface-container overflow-hidden z-[9999] transition-all transform opacity-100 translate-y-0';
         dropdown.style.animation = 'slideInRight 0.3s ease-out';
         
         try {
           const res = await fetch(API_URL + '/announcement');
           const data = await res.json();
           const msg = data.message || 'Tidak ada notifikasi baru.';
           dropdown.innerHTML = `
             <div class="px-4 py-3 border-b border-surface-container bg-surface-container-low flex justify-between items-center">
               <span class="font-bold text-on-surface">Notifikasi Anda</span>
               <span class="text-xs bg-error text-on-error px-2 py-0.5 rounded-full font-bold animate-pulse">1 Baru</span>
             </div>
             <div class="flex flex-col max-h-80 overflow-y-auto">
               <div class="px-4 py-4 hover:bg-surface-container-low transition-colors flex gap-3 cursor-pointer">
                  <div class="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0">
                     <span class="material-symbols-outlined text-lg">campaign</span>
                  </div>
                  <div class="flex flex-col">
                     <span class="font-bold text-sm text-on-surface">Pesan dari Admin / HRD</span>
                     <span class="text-xs text-on-surface-variant mt-1 leading-relaxed">${msg}</span>
                     <span class="text-[10px] text-primary font-semibold mt-1">Baru saja</span>
                  </div>
               </div>
             </div>
           `;
           document.body.appendChild(dropdown);
           
           // Hilangkan titik merah saat diklik
           const redDot = notifBtn.querySelector('.bg-error');
           if(redDot) redDot.style.display = 'none';
         } catch(e) {}
       }
       return;
    }

    // Klik Di Luar Dropdown Notif untuk menutupnya
    if (!isNotifBtn && document.getElementById('notifDropdown') && !el.closest('#notifDropdown')) {
       document.getElementById('notifDropdown').remove();
    }

    // KELUAR / LOGOUT
    if (text.includes('keluar') || el.getAttribute('href') === 'login.html') {
      localStorage.removeItem('presensi_admin_token');
      localStorage.removeItem('presensi_token');
      window.location.href = 'login.html';
      return;
    }

    // DASHBOARD: Clock In / Clock Out
    if (el.id === 'btnClockIn' || text.includes('kehadiran masuk') || text.includes('clock in') || text.includes('absen masuk')) {
      e.preventDefault();
      const token = await checkAuth('Employee'); if(!token) return;
      const kioskSelect = document.getElementById('kioskEmployeeSelect');
      const targetUserId = kioskSelect ? kioskSelect.value : null;
      if (kioskSelect && !targetUserId) return alert("❌ Silakan pilih nama Anda terlebih dahulu di kotak pilihan!");
      const res = await fetch(API_URL + '/attendance/clock-in', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ lat: -6.2088, lng: 106.8456, tipe_lokasi: 'WFO', user_id: targetUserId })
      });
      const data = await res.json();
      if(res.ok) { alert('✅ Berhasil Clock In!\nStatus: ' + data.status); location.reload(); }
      else alert('❌ Gagal: ' + data.error);
    }
    else if (el.id === 'btnClockOut' || text.includes('presensi pulang') || text.includes('clock out') || text.includes('absen pulang')) {
      e.preventDefault();
      const token = await checkAuth('Employee'); if(!token) return;
      const kioskSelect = document.getElementById('kioskEmployeeSelect');
      const targetUserId = kioskSelect ? kioskSelect.value : null;
      if (kioskSelect && !targetUserId) return alert("❌ Silakan pilih nama Anda terlebih dahulu di kotak pilihan!");
      const res = await fetch(API_URL + '/attendance/clock-out', { 
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ user_id: targetUserId })
      });
      const data = await res.json();
      if(res.ok) { alert('✅ Berhasil Clock Out!'); location.reload(); }
      else alert('❌ Gagal: ' + data.error);
    }
    // IZIN: Form Submit
    else if (el.type === 'submit' || text.includes('kirim pengajuan')) {
       e.preventDefault();
       const token = await checkAuth('Employee'); if(!token) return;
       const activeBtn = document.querySelector('.type-btn.bg-primary-container'); 
       let jenis = 'Cuti Tahunan';
       if (activeBtn) {
         const dtype = activeBtn.getAttribute('data-type');
         if(dtype === 'sakit') jenis = 'Sakit'; if(dtype === 'izin') jenis = 'Izin Khusus';
       }
       const startDate = document.getElementById('startDate')?.value;
       const endDate = document.getElementById('endDate')?.value;
       const reasonText = document.getElementById('reasonInput')?.value.trim();
       if (!startDate || !endDate) return alert("❌ Mohon lengkapi Tanggal Mulai dan Selesai.");
       let finalReason = reasonText || '';
       if (base64File) finalReason = finalReason ? '[Ada Lampiran Foto] ' + finalReason : '[Lampiran Foto]';

       try {
         const res = await fetch(API_URL + '/leaves/request', {
           method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
           body: JSON.stringify({ tipe_pengajuan: jenis, tgl_mulai: startDate, tgl_selesai: endDate, alasan: finalReason, dokumen_url: base64File })
         });
         if(res.ok) { alert("✅ Berhasil dikirim ke HRD."); location.reload(); }
         else { const err = await res.json(); alert('❌ Gagal: ' + err.error); }
       } catch (err) {}
    }
    else if (el.classList.contains('type-btn')) {
       e.preventDefault();
       document.querySelectorAll('.type-btn').forEach(btn => {
         btn.className = 'type-btn flex items-center justify-center gap-2 py-2.5 sm:py-2 px-3 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high font-label-md text-label-md font-medium transition-all';
       });
       el.className = 'type-btn flex items-center justify-center gap-2 py-2.5 sm:py-2 px-3 rounded-lg text-on-primary bg-primary-container font-label-md text-label-md font-semibold transition-all shadow-sm';
    }
      // ADMIN: Tambah / Broadcast
      else if (text.includes('tambah karyawan')) {
        e.preventDefault();
        const inputData = prompt("👥 PENDAFTARAN KARYAWAN BARU\n\nMasukkan data dengan format:\nNama, Email, Password\n\nContoh:\nBudi, budi@kantor.com, rahasia123");
        if (inputData) {
          const parts = inputData.split(',').map(s => s.trim());
          if (parts.length >= 1) {
            const nama = parts[0];
            const email = parts[1] || (nama.toLowerCase().replace(/\s+/g, '') + Math.floor(Math.random() * 1000) + '@kantor.com');
            const password = parts[2] || 'password123';
            const payload = { nama: nama, email: email, nik: 'EMP-' + Math.floor(Math.random() * 10000), password: password, role: 'Employee' };
            try {
              const res = await fetch(API_URL + '/users/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
              if(res.ok) { alert('✅ Karyawan ' + nama + ' berhasil didaftarkan!\nEmail: ' + email + '\nPass: ' + password); window.location.reload(); }
              else alert('❌ Gagal mendaftarkan karyawan.');
            } catch(e) { alert('❌ Server Error'); }
          }
        }
      } 
      else if (el.id === 'btnHapusKaryawan' || text.includes('hapus karyawan')) {
        e.preventDefault();
        const emailTarget = prompt("🗑️ HAPUS KARYAWAN\n\nMasukkan EMAIL karyawan yang ingin dihapus:");
        if (emailTarget) {
           const token = await checkAuth('HR');
           try {
              const resUsers = await fetch(API_URL + '/users', { headers: { 'Authorization': 'Bearer ' + token } });
              const users = await resUsers.json();
              const userTarget = users.find(u => u.email === emailTarget.trim());
              if (!userTarget) return alert("❌ Karyawan dengan email tersebut tidak ditemukan!");
              
              const confirmDel = confirm(`Yakin ingin menghapus karyawan ${userTarget.nama} (${userTarget.email})?\nSemua data presensi & cutinya akan ikut terhapus permanen!`);
              if (confirmDel) {
                 const resDel = await fetch(API_URL + '/users/' + userTarget.id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
                 if (resDel.ok) { alert('✅ Karyawan berhasil dihapus.'); location.reload(); }
                 else alert('❌ Gagal menghapus karyawan.');
              }
           } catch(e) {}
        }
      }
      else if (text.includes('broadcast') || text.includes('kirim notifikasi')) {
      e.preventDefault();
      const pesan = prompt("🔔 KIRIM PENGUMUMAN KE KARYAWAN\n\nKetik pengumuman baru yang akan tampil di Dashboard:");
      if (pesan) {
        const token = await checkAuth('HR');
        try {
          await fetch(API_URL + '/admin/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ message: pesan }) });
          alert('✅ Pengumuman berhasil diperbarui di semua Dashboard karyawan.');
        } catch(e) {}
      }
    }
  });

  // Helper untuk update Dashboard Element
  async function updateDashboardData(userId, userName, token) {
    const h1 = document.querySelector('h1');
    if (h1 && userName) {
      const hour = new Date().getHours();
      let greeting = 'Selamat Pagi';
      if (hour >= 11 && hour < 15) greeting = 'Selamat Siang';
      else if (hour >= 15 && hour < 18) greeting = 'Selamat Sore';
      else if (hour >= 18) greeting = 'Selamat Malam';
      h1.innerHTML = greeting + ', ' + userName + '! <span class="text-xl">👋</span>';
    }

    // Update Ringkasan Header
    document.querySelectorAll('h2').forEach(h2 => {
      if (h2.innerText.includes('Ringkasan Bulan Ini')) {
         h2.innerText = userName ? 'Ringkasan Bulan Ini: ' + userName : 'Ringkasan Bulan Ini';
      }
    });

    // Update 4 KPI Cards
    try {
      const url = userId ? API_URL + '/attendance/summary?user_id=' + userId : API_URL + '/attendance/summary';
      const resStats = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
      const stats = await resStats.json();
      
      const kpis = document.querySelectorAll('.bg-surface-container-lowest.rounded-xl.p-5');
      kpis.forEach(kpi => {
        const titleSpan = kpi.querySelector('span.uppercase');
        if(!titleSpan) return;
        const title = titleSpan.innerText.toLowerCase();
        
        // Coba cari h3 atau class .font-display-lg (karena HTML dashboard pakai span class ini)
        const valueSpan = kpi.querySelector('h3') || kpi.querySelector('.font-display-lg');
        if (!valueSpan) return;
        
        if (title.includes('tepat waktu')) valueSpan.innerText = stats.hadir_tepat_waktu;
        if (title.includes('terlambat')) valueSpan.innerText = stats.terlambat;
        if (title.includes('kuota cuti')) valueSpan.innerText = stats.sisa_cuti; // HTML sudah ada kata "Hari" di sebelahnya?
        if (title.includes('jam kerja')) valueSpan.innerText = stats.total_jam_kerja; // HTML punya kata "Jam"?
      });
    } catch(e) {}

    // Update 7-Day Log & Clock Out Button UI
    try {
      const urlHistory = userId ? API_URL + '/attendance/history?user_id=' + userId : API_URL + '/attendance/history';
      const res = await fetch(urlHistory, { headers: { 'Authorization': 'Bearer ' + token } });
      const dataLogs = await res.json();
      
      const tbody = document.querySelector('tbody');
      if (tbody) {
         if (dataLogs.length > 0) {
           tbody.innerHTML = '';
           dataLogs.slice(0, 7).forEach(log => {
             const tgl = new Date(log.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
             const nama = log.user?.nama ? log.user.nama + ' - ' : '';
             const masuk = log.jam_masuk ? new Date(log.jam_masuk).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-';
             const pulang = log.jam_pulang ? new Date(log.jam_pulang).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-';
             let statusColor = log.status_kehadiran === 'Tepat Waktu' ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-tertiary-fixed text-on-tertiary-fixed';
             tbody.innerHTML += `
               <tr class="hover:bg-surface-container-low/60 transition-colors border-b border-surface-container-high/40">
                 <td class="py-3 px-4 font-semibold text-xs whitespace-nowrap">${nama}${tgl}</td>
                 <td class="py-3 px-3">${masuk}</td>
                 <td class="py-3 px-3">${pulang}</td>
                 <td class="py-3 px-3 text-right"><span class="inline-flex px-2.5 py-0.5 rounded-full ${statusColor} font-label-sm text-[10px] font-semibold">${log.status_kehadiran}</span></td>
               </tr>`;
           });
         } else {
           tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-outline italic">Belum ada riwayat presensi.</td></tr>';
         }
      }

      const btnOut = document.getElementById('btnClockOut');
      if (btnOut) {
         let shouldShowRed = false;
         let shouldShowGreen = false;
         
         if (dataLogs.length > 0) {
           const todayStr = new Date().toDateString();
           const logToday = new Date(dataLogs[0].tanggal).toDateString() === todayStr;
           if (logToday && !dataLogs[0].jam_pulang) shouldShowRed = true;
           if (logToday && dataLogs[0].jam_pulang) shouldShowGreen = true;
         }

         if (shouldShowRed) {
           btnOut.className = "w-full min-h-[48px] bg-error hover:bg-error-container text-on-error hover:text-on-error-container font-headline-sm text-headline-sm py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all";
           btnOut.innerHTML = '<span class="material-symbols-outlined text-xl">logout</span><span>Catat Kehadiran Pulang Sekarang</span>';
         } else if (shouldShowGreen) {
           btnOut.className = "w-full min-h-[48px] bg-surface-container-high text-outline font-headline-sm text-headline-sm py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all";
           btnOut.innerHTML = '<span class="material-symbols-outlined text-xl">check_circle</span><span>Sudah Pulang</span>';
         } else {
           btnOut.className = "w-full min-h-[48px] bg-surface-container-high text-outline font-headline-sm text-headline-sm py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all";
           btnOut.innerHTML = '<span class="material-symbols-outlined text-xl">lock_clock</span><span>Belum Waktunya Presensi Pulang</span>';
         }
      }
    } catch(e) {}
  }

  // INITIALIZE APP UI (Runs immediately since script is at the bottom of the body)
  const initAppUI = async () => {
    const pageText = document.body.innerText;

    // HIDE ADMIN MENU FOR REGULAR EMPLOYEES (Run Immediately)
    const runHideAdmin = () => {
      try {
        const storedToken = localStorage.getItem('presensi_admin_token') || localStorage.getItem('presensi_employee_token');
        if (storedToken) {
          const payload = JSON.parse(atob(storedToken.split('.')[1]));
          if (payload.role !== 'Admin' && payload.role !== 'HR') {
             // 1. Selector href
             document.querySelectorAll('a[href*="admin.html"]').forEach(el => el.remove());
             // 2. Selector data-path
             document.querySelectorAll('[data-path*="admin"]').forEach(el => el.remove());
             // 3. Text content matching (Paling kuat)
             Array.from(document.querySelectorAll('a')).forEach(a => {
                if (a.innerText.includes('Admin') || a.innerText.includes('HR Monitoring')) {
                   a.remove();
                }
             });
          }
        }
      } catch(e) {}
    };
    runHideAdmin(); // Jalankan langsung


    // DETEKSI GPS & NETWORK PERANGKAT LOKAL KARYAWAN
    if (pageText.includes('Validasi Geolocation') || pageText.includes('Jaringan Terotorisasi')) {
       const geoSub = Array.from(document.querySelectorAll('span.font-semibold'))
         .find(el => el.innerText.includes('Validasi Geolocation'))?.nextElementSibling;
       const wifiSub = Array.from(document.querySelectorAll('span.font-semibold'))
         .find(el => el.innerText.includes('Jaringan Terotorisasi'))?.nextElementSibling;

       if (wifiSub) {
          const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
          let netStr = 'Koneksi Terdeteksi';
          if (conn) {
             if (conn.type === 'wifi') netStr = 'Wi-Fi (Jaringan Lokal)';
             else if (conn.type === 'cellular') netStr = 'Internet Seluler (Data/Kuota)';
             else if (conn.type === 'ethernet') netStr = 'Kabel LAN Kantor';
             else if (conn.effectiveType) netStr = 'Jaringan ' + conn.effectiveType.toUpperCase();
          }
          wifiSub.innerHTML = 'Status: <strong class="font-data-mono text-primary">' + netStr + '</strong>';
       }

       if (geoSub) {
          geoSub.innerHTML = '<span class="animate-pulse">Mendeteksi nama jalan & kota...</span>';
          if (navigator.geolocation) {
             navigator.geolocation.getCurrentPosition(
               async (pos) => {
                  const lat = pos.coords.latitude;
                  const lon = pos.coords.longitude;
                  let lokasiText = lat.toFixed(5) + ', ' + lon.toFixed(5);
                  try {
                    const res = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon);
                    const data = await res.json();
                    if (data && data.address) {
                       const jalan = data.address.road || data.address.pedestrian || data.address.suburb || '';
                       const kota = data.address.city || data.address.town || data.address.county || data.address.state || '';
                       lokasiText = (jalan ? jalan + ', ' : '') + kota;
                       if(lokasiText.length < 3 && data.display_name) lokasiText = data.display_name.split(',').slice(0,2).join(', ');
                    }
                  } catch(e) {}
                  geoSub.innerHTML = 'Lokasi Terbaca: <strong class="text-primary">' + lokasiText + '</strong>';
               },
               (err) => {
                  geoSub.innerHTML = '<strong class="text-error">Akses GPS Ditolak / Gagal</strong>';
               },
               { enableHighAccuracy: true, timeout: 15000 }
             );
          } else {
             geoSub.innerText = 'GPS tidak didukung di perangkat ini.';
          }
       }
    }

    // Fetch Announcement
    try {
       const resAnnounce = await fetch(API_URL + '/announcement');
       const dataAnnounce = await resAnnounce.json();
       
       if (dataAnnounce.message) {
         const lastSeen = localStorage.getItem('last_announcement');
         if (lastSeen !== dataAnnounce.message) {
            // Toast Pop-up UI di Dashboard
            const toast = document.createElement('div');
            toast.className = 'fixed top-6 right-6 z-[9999] bg-surface-container-lowest border-l-4 border-primary p-4 rounded-xl shadow-lg flex flex-col gap-2 w-80 transition-all transform translate-y-0 opacity-100';
            toast.style.animation = 'slideInRight 0.5s ease-out';
            toast.innerHTML = `
              <div class="flex items-center justify-between">
                 <div class="flex items-center gap-2 text-primary font-bold font-label-md">
                    <span class="material-symbols-outlined text-lg">campaign</span>
                    <span>Pesan HRD / Admin</span>
                 </div>
                 <button onclick="this.parentElement.parentElement.style.opacity='0'; setTimeout(()=>this.parentElement.parentElement.remove(), 300);" class="text-outline hover:text-error transition-colors">
                    <span class="material-symbols-outlined text-md">close</span>
                 </button>
              </div>
              <p class="text-sm font-body-sm text-on-surface-variant">${dataAnnounce.message}</p>
            `;
            document.body.appendChild(toast);
            
            // Auto-close setelah 10 detik
            setTimeout(() => { 
               if(toast.parentElement) {
                  toast.style.opacity = '0';
                  setTimeout(() => toast.remove(), 300);
               }
            }, 10000);

            localStorage.setItem('last_announcement', dataAnnounce.message);
         }
       }

       document.querySelectorAll('h3').forEach(h3 => {
         if (h3.innerText.includes('Pengumuman HRD')) {
           const container = h3.closest('div.bg-surface-container-lowest')?.querySelector('div.divide-y');
           if (container) {
             const firstItem = container.firstElementChild;
             if (firstItem) {
               const title = firstItem.querySelector('h4');
               const desc = firstItem.querySelector('p');
               const time = firstItem.querySelector('span.text-outline');
               const tag = firstItem.querySelector('span.bg-primary-fixed');
               
               if (title) title.innerText = 'Pesan dari Admin / HRD';
               if (desc) desc.innerText = dataAnnounce.message;
               if (time) time.innerText = 'Baru saja';
               if (tag) tag.innerText = 'Penting';
             }
           }
         }
       });
    } catch(e) {}

    // INIT PERSONAL DASHBOARD (Non-Kiosk)
    if (pageText.includes('Catat Kehadiran') || pageText.includes('Clock In')) {
       const token = await checkAuth('Employee'); if(!token) return;
       try {
         // Decode token untuk dapatkan userId
         const payload = JSON.parse(atob(token.split('.')[1]));
         const userId = payload.id;

         // Fetch data user untuk dapat nama asli
         const resUsers = await fetch(API_URL + '/users');
         const users = await resUsers.json();
         const me = users.find(u => u.id === userId);
         const userName = me ? me.nama : 'Karyawan';

         // Update dashboard menggunakan data personal
         updateDashboardData(userId, userName, token);
       } catch(e) {}
    }

    // A. DETEKSI ADMIN
    if (pageText.includes('Meja Persetujuan Cepat')) {
      const token = await checkAuth('HR'); if(!token) return;

      // Inject Tombol Hapus Karyawan
      const tambahBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Tambah Karyawan'));
      if (tambahBtn && !document.getElementById('btnHapusKaryawan')) {
         const hapusBtn = document.createElement('button');
         hapusBtn.id = 'btnHapusKaryawan';
         hapusBtn.className = tambahBtn.className.replace('bg-primary', 'bg-error').replace('text-on-primary', 'text-on-error').replace('hover:bg-primary-container', 'hover:bg-error-container');
         hapusBtn.innerHTML = '<span class="material-symbols-outlined text-lg">person_remove</span> Hapus Karyawan';
         hapusBtn.type = 'button';
         tambahBtn.parentElement.appendChild(hapusBtn);
      }

      try {
        const resStats = await fetch(API_URL + '/admin/dashboard/stats', { headers: { 'Authorization': 'Bearer ' + token } });
        const dataStats = await resStats.json();
        const displayLgElements = document.querySelectorAll('.font-display-lg');
        if (displayLgElements.length >= 5) {
          displayLgElements[0].innerText = dataStats.total_karyawan;
          displayLgElements[1].innerText = dataStats.sudah_hadir;
          displayLgElements[2].innerText = dataStats.terlambat;
          displayLgElements[3].innerText = dataStats.cuti_izin;
          displayLgElements[4].innerText = dataStats.belum_hadir;
        }

        const resLogs = await fetch(API_URL + '/admin/dashboard/live-logs', { headers: { 'Authorization': 'Bearer ' + token } });
        const dataLogs = await resLogs.json();
        let liveLogTbody = null;
        document.querySelectorAll('h2').forEach(h2 => { 
          if(h2.innerText.includes('Log Presensi Real-Time')) liveLogTbody = h2.closest('.flex.flex-col').querySelector('table tbody');
        });
        if (liveLogTbody) {
          liveLogTbody.innerHTML = '';
          if (dataLogs.length === 0) liveLogTbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-outline italic">Belum ada presensi hari ini</td></tr>';
          dataLogs.forEach(log => {
            const userNama = log.user?.nama || 'Unknown';
            const divisi = log.user?.divisi_id === 1 ? 'Engineering' : 'Staff';
            const masukWaktu = new Date(log.jam_masuk).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit', second:'2-digit'});
            let statusColor = log.status_kehadiran === 'Tepat Waktu' ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-tertiary-fixed text-on-tertiary-fixed';
            liveLogTbody.innerHTML += `
              <tr class="hover:bg-surface-container-low/60 transition-colors border-b border-surface-container/50">
                <td class="py-3 px-4">
                  <div class="flex flex-col min-w-0">
                    <span class="font-label-md font-semibold">${userNama}</span>
                    <span class="font-body-sm text-outline">${divisi}</span>
                  </div>
                </td>
                <td class="py-3 px-3 font-data-mono font-semibold">${masukWaktu}</td>
                <td class="py-3 px-3">Face + GPS</td>
                <td class="py-3 px-3">${log.tipe_lokasi}</td>
                <td class="py-3 px-4 text-right">
                  <span class="inline-flex px-2.5 py-0.5 rounded-full ${statusColor} font-label-sm font-semibold">${log.status_kehadiran}</span>
                </td>
              </tr>`;
          });
        }

        const resPending = await fetch(API_URL + '/admin/leaves/pending', { headers: { 'Authorization': 'Bearer ' + token } });
        const dataPending = await resPending.json();
        let approvalContainer = null;
        document.querySelectorAll('h2').forEach(h2 => { 
          if(h2.innerText.includes('Meja Persetujuan')) approvalContainer = h2.closest('.flex.flex-col.rounded-xl').querySelector('.flex.flex-col.gap-3'); 
        });
        if(approvalContainer) {
          approvalContainer.innerHTML = '';
          if(dataPending.length === 0) approvalContainer.innerHTML = '<p class="p-4 text-center text-outline italic">Bersih! Tidak ada antrean pengajuan hari ini.</p>';
          dataPending.forEach(item => {
             const userNama = item.user?.nama || 'Karyawan';
             const tglMulai = new Date(item.tgl_mulai).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
             const lampiran = item.dokumen_url ? '<a href="' + item.dokumen_url + '" target="_blank" class="text-primary font-bold hover:underline mt-2 text-sm flex items-center gap-1"><span class="material-symbols-outlined text-sm">image</span> Buka Lampiran</a>' : '';
             approvalContainer.innerHTML += `
               <div class="p-4 rounded-xl bg-surface-container-low flex flex-col gap-2 transition-all hover:shadow-md border border-surface-container">
                 <div class="flex items-start justify-between">
                   <div class="flex flex-col"><span class="font-label-md font-bold">${userNama}</span><span class="text-sm text-outline">${item.tipe_pengajuan}</span></div>
                   <span class="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-xs font-bold animate-pulse">BARU</span>
                 </div>
                 <div class="p-3 bg-surface-container-lowest rounded-lg text-sm mt-1">
                   <div class="font-semibold flex items-center gap-1 mb-1"><span class="material-symbols-outlined text-sm text-primary">event</span> Mulai: ${tglMulai}</div>
                   <div class="text-outline italic">"${item.alasan}"</div>${lampiran}
                 </div>
                 <div class="flex justify-end gap-2 mt-2">
                    <button onclick="rejectRequest(${item.id})" class="px-4 py-2 rounded-xl text-error hover:bg-error-container font-semibold text-sm transition-colors">Tolak</button>
                    <button onclick="approveRequest(${item.id})" class="px-4 py-2 rounded-xl bg-secondary text-white hover:opacity-90 font-semibold text-sm flex items-center gap-1 shadow-sm"><span class="material-symbols-outlined text-sm">check</span> Setujui</button>
                 </div>
               </div>`;
          });
        }
      } catch(e) {}
    }

    // B. DETEKSI RIWAYAT / CUTI
    if (pageText.includes('Riwayat') && (pageText.includes('Sisa Cuti') || pageText.includes('Status Terkini'))) {
      const token = await checkAuth('Employee'); if(!token) return;
      try {
        const res = await fetch(API_URL + '/leaves/my-requests', { headers: { 'Authorization': 'Bearer ' + token } });
        const result = await res.json();
        const historyData = result.requests || []; 
        let listContainer = null;
        document.querySelectorAll('h2').forEach(h2 => { 
          if(h2.innerText.includes('Riwayat')) listContainer = h2.closest('.flex.items-center.justify-between').nextElementSibling; 
        });
        if (listContainer) {
          listContainer.innerHTML = '';
          if (historyData.length === 0) listContainer.innerHTML = '<p class="text-outline italic p-4 text-center">Belum ada riwayat pengajuan.</p>';
          historyData.forEach(item => {
            let statusColor = 'bg-surface-container text-on-surface-variant'; let iconText = 'Menunggu HRD';
            if (item.status === 'APPROVED') { statusColor = 'bg-secondary/15 text-secondary'; iconText = 'Disetujui'; } 
            else if (item.status === 'REJECTED') { statusColor = 'bg-error/15 text-error'; iconText = 'Ditolak'; }
            let lampiranUI = item.dokumen_url ? '<span class="inline-flex px-1.5 py-0.5 ml-2 rounded bg-surface-container-high text-[10px] text-on-surface-variant">Terlampir</span>' : '';
            listContainer.innerHTML += `
              <div class="bg-surface-container-lowest p-3.5 rounded-xl shadow-sm hover:shadow-md flex flex-col gap-2">
                <div class="flex justify-between items-center"><span class="font-bold text-sm text-on-surface">${item.tipe_pengajuan} ${lampiranUI}</span><span class="px-2 py-0.5 rounded-full ${statusColor} text-xs font-bold">${iconText}</span></div>
                <div class="flex gap-1.5 mt-1"><span class="material-symbols-outlined text-sm text-outline mt-0.5">chat</span><span class="text-sm italic text-outline line-clamp-2">"${item.alasan}"</span></div>
              </div>`;
          });
        }
      } catch(e) {}
    }
  };
  
  // Eksekusi fungsi inisialisasi secara langsung!
  initAppUI();
