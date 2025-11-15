// --- FIREBASE & GITHUB CONFIGURATION ---
// PASTE KONFIGURASI FIREBASE ANDA DI SINI
const firebaseConfig = {
  apiKey: "AIzaSyCaNc6L_5AkvmXmrn3DtmR--xGFM7jvnv4",
  authDomain: "vipxit-82c84.firebaseapp.com",
  databaseURL: "https://vipxit-82c84-default-rtdb.firebaseio.com",
  projectId: "vipxit-82c84",
  storageBucket: "vipxit-82c84.firebasestorage.app",
  messagingSenderId: "311219711928",
  appId: "1:311219711928:web:f2cca4c9ba49b0c5eea94d",
  measurementId: "G-BSYHPK2WC3"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// PERINGATAN: Jangan pernah mengekspos token ini di aplikasi publik/produksi!
// Ini hanya aman untuk penggunaan pribadi.
const GITHUB_TOKEN = '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'; // GANTI dengan token Anda
const GITHUB_OWNER = 'FixaOnly'; // GANTI dengan username Anda
const GITHUB_REPO = 'FixaOnlygg'; // GANTI dengan nama repo Anda
const GITHUB_PATH = 'files/'; // Path di dalam repo untuk menyimpan gambar

// --- GLOBAL VARIABLES ---
let currentUser = null;
let currentGroupId = null;
let currentPrivateChatId = null;
let blockedUsers = [];
let privateChatOptionsEl = null;
let statusListener = null;

// --- DOM ELEMENTS ---
const views = document.querySelectorAll('.view');
const loginForm = document.getElementById('loginForm');
const nameInput = document.getElementById('nameInput');
const privacyIdInput = document.getElementById('privacyIdInput');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const notification = document.getElementById('notification');
const fullStatusModal = document.getElementById('fullStatusModal');
const fullStatusImage = document.getElementById('fullStatusImage');
const fullStatusCaption = document.getElementById('fullStatusCaption');
const fullStatusMeta = document.getElementById('fullStatusMeta');

// --- HELPER FUNCTIONS ---
function generateId() {
    return Math.random().toString().substring(2, 10);
}

const USER_ID_PREFIX = "FIXA-";
function generateUserId() {
    const randomPart = Math.random().toString().substring(2, 11);
    return USER_ID_PREFIX + randomPart;
}

function toggleInputVisibility(inputId, button) {
    const input = document.getElementById(inputId);
    const icon = button.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function toggleSpanVisibility(spanId, button) {
    const span = document.getElementById(spanId);
    const icon = button.querySelector('i');
    const fullText = span.getAttribute('data-full-text');
    const maskedText = span.getAttribute('data-masked-text');
    if (span.innerText === maskedText) {
        span.innerText = fullText;
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        span.innerText = maskedText;
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function showView(viewId) {
    views.forEach(view => view.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (privateChatOptionsEl) privateChatOptionsEl.remove();
}

function showModal(content) {
    modalBody.innerHTML = content;
    modal.classList.add('show');
}

function closeModal() {
    modal.classList.remove('show');
}

function showNotification(message, duration = 5000) {
    notification.innerHTML = message;
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), duration);
}

function handleProfileImageError(img) {
    img.onerror = null;
    img.src = 'https://i.pravatar.cc/150?u=' + img.alt;
}

// --- BROWSER NOTIFICATION ---
function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

function triggerBrowserNotification(title, options) {
    if (document.visibilityState === 'hidden' && "Notification" in window && Notification.permission === "granted") {
        new Notification(title, options);
    }
}

// --- AUTH & USER SETUP (DIPERBAIKI) ---
function checkAuthState() {
    const savedName = localStorage.getItem('chatUserName');
    const savedPrivacyId = localStorage.getItem('chatUserPrivacyId');
    if (savedName && savedPrivacyId) {
        loginUser(savedName, savedPrivacyId);
    } else {
        showView('loginView');
    }
}

function showCreateAccountModal() {
    const content = `
        <h3><i class="fas fa-user-plus"></i> Buat Akun Baru</h3>
        <p>Simpan ID Privasi Anda dengan baik! Ini digunakan untuk login.</p>
        <form id="createAccountForm">
            <input type="text" id="newNameInput" placeholder="Nama Anda" required>
            <div class="password-container">
                <input type="password" id="newPrivacyIdInput" placeholder="ID Privasi Anda" required readonly>
                <button type="button" class="toggle-visibility-btn" onclick="toggleInputVisibility('newPrivacyIdInput', this)">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
            <button type="submit"><i class="fas fa-user-plus"></i> Buat Akun</button>
        </form>
    `;
    showModal(content);
    const privacyId = generateUserId();
    document.getElementById('newPrivacyIdInput').value = privacyId;

    // Tambahkan event listener ke form yang baru dibuat
    document.getElementById('createAccountForm').addEventListener('submit', createAccount);
}

function createAccount(e) {
    e.preventDefault();
    const name = document.getElementById('newNameInput').value.trim();
    const privacyId = document.getElementById('newPrivacyIdInput').value.trim();
    if (!name || !privacyId) return;

    const publicId = generateUserId();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Membuat Akun...';

    db.ref(`usersByPrivacyId/${privacyId}`).set(publicId)
    .then(() => {
        return db.ref(`users/${publicId}`).set({
            name: name,
            privacyId: privacyId,
            status: 'Halo, saya menggunakan ChatKu!',
            profilePictureUrl: 'https://i.pravatar.cc/150?u=' + publicId,
            caption: '',
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
    })
    .then(() => {
        localStorage.setItem('chatUserName', name);
        localStorage.setItem('chatUserPrivacyId', privacyId);
        showNotification('Akun berhasil dibuat!');
        closeModal();
        loginUser(name, privacyId);
    })
    .catch((error) => {
        console.error("Error creating account:", error);
        let errorMessage = 'Gagal membuat akun.';
        if (error.message && error.message.includes('PERMISSION_DENIED')) {
            errorMessage = 'Error: Izin ditolak. Periksa aturan Firebase Anda.';
        } else if (error.message.includes('exists')) {
            errorMessage = 'ID Privasi sudah digunakan. Silakan coba lagi atau buat yang baru.';
        }
        showNotification(errorMessage);
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    });
}

function loginUser(name, privacyId) {
    const loginBtn = document.querySelector('#loginForm button[type="submit"]');
    const originalText = loginBtn.innerHTML;
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Masuk...';

    db.ref(`usersByPrivacyId/${privacyId}`).once('value').then(snapshot => {
        if (snapshot.exists()) {
            const publicId = snapshot.val();
            return db.ref(`users/${publicId}`).once('value');
        } else {
            throw new Error('ID_PRIVASI_NOT_FOUND');
        }
    }).then(userSnap => {
        if (userSnap.exists()) {
            const userData = userSnap.val();
            currentUser = { 
                name: userData.name, 
                id: userSnap.key, // Lebih aman pakai key dari snapshot
                privacyId: userData.privacyId,
                status: userData.status || '',
                profilePictureUrl: userData.profilePictureUrl || '',
                caption: userData.caption || ''
            };
            
            document.getElementById('displayName').textContent = currentUser.name;
            const userIdSpan = document.getElementById('displayUserId');
            userIdSpan.innerText = `ID: ${currentUser.id}`;

            const privacyIdSpan = document.getElementById('displayPrivacyId');
            const fullPrivacyText = `ID Privasi: ${currentUser.privacyId}`;
            const maskedPrivacyText = `ID Privasi: ${currentUser.privacyId.substring(0, 10)}***`;
            privacyIdSpan.setAttribute('data-full-text', fullPrivacyText);
            privacyIdSpan.setAttribute('data-masked-text', maskedPrivacyText);
            privacyIdSpan.innerText = maskedPrivacyText;

            const headerPic = document.getElementById('headerProfilePicture');
            headerPic.src = currentUser.profilePictureUrl;
            headerPic.alt = currentUser.id;
            headerPic.style.display = 'block';

            showView('mainView');
            setupUserPresence();
            loadBlockedUsers();
            listenForNotifications();
            listenForFriendRequests();
            listenForGroupInvites();
            requestNotificationPermission();
        } else {
            throw new Error('USER_DATA_NOT_FOUND');
        }
    }).catch((error) => {
        console.error("Login error:", error);
        let errorMessage = 'Gagal masuk.';
        if (error.message === 'ID_PRIVASI_NOT_FOUND') {
            errorMessage = 'ID Privasi atau Nama salah.';
        } else if (error.message === 'USER_DATA_NOT_FOUND') {
            errorMessage = 'Terjadi kesalahan data. Silakan coba lagi.';
        } else if (error.message && error.message.includes('PERMISSION_DENIED')) {
            errorMessage = 'Error: Izin ditolak. Periksa aturan Firebase Anda.';
        }
        showNotification(errorMessage, 5000);
    }).finally(() => {
        loginBtn.disabled = false;
        loginBtn.innerHTML = originalText;
    });
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const privacyId = privacyIdInput.value.trim();
    if (name && privacyId) {
        loginUser(name, privacyId);
    }
});

// ... semua fungsi lainnya tetap sama ...
// --- EDIT PROFILE ---
function showEditProfileModal() {
    const content = `
        <h3><i class="fas fa-user-edit"></i> Edit Profil</h3>
        <form onsubmit="updateProfile(event)">
            <div class="profile-modal-content">
                <img id="editProfilePicture" src="${currentUser.profilePictureUrl}" alt="Profile" class="profile-picture-modal" onerror="handleProfileImageError(this)">
            </div>
            <input type="text" id="editNameInput" placeholder="Nama" value="${currentUser.name}" required>
            <textarea id="editStatusInput" placeholder="Status" maxlength="100">${currentUser.status}</textarea>
            <input type="url" id="editProfileUrlInput" placeholder="URL Foto Profil (opsional)" value="${currentUser.profilePictureUrl}">
            <textarea id="editCaptionInput" placeholder="Caption" maxlength="150">${currentUser.caption}</textarea>
            <button type="submit">Simpan Perubahan</button>
        </form>
    `;
    showModal(content);
}

function updateProfile(e) {
    e.preventDefault();
    const name = document.getElementById('editNameInput').value.trim();
    const status = document.getElementById('editStatusInput').value.trim();
    const profilePictureUrl = document.getElementById('editProfileUrlInput').value.trim();
    const caption = document.getElementById('editCaptionInput').value.trim();

    const updates = {
        name: name,
        status: status,
        profilePictureUrl: profilePictureUrl || 'https://i.pravatar.cc/150?u=' + currentUser.id,
        caption: caption
    };

    db.ref(`users/${currentUser.id}`).update(updates).then(() => {
        currentUser = { ...currentUser, ...updates };
        document.getElementById('displayName').textContent = currentUser.name;
        document.getElementById('headerProfilePicture').src = currentUser.profilePictureUrl;
        showNotification('Profil berhasil diperbarui!');
        closeModal();
    });
}

// --- VIEW PUBLIC PROFILE ---
function showPublicProfileModal(userId) {
    if (userId === currentUser.id) {
        showEditProfileModal();
        return;
    }
    db.ref(`users/${userId}`).once('value').then(snapshot => {
        const userData = snapshot.val();
        if (!userData) {
            showNotification('Profil pengguna tidak ditemukan.');
            return;
        }
        const content = `
            <div class="profile-modal-content">
                <img src="${userData.profilePictureUrl || 'https://i.pravatar.cc/150?u=' + userId}" alt="${userData.name}" class="profile-picture-modal" onerror="handleProfileImageError(this)">
                <div class="profile-name">${userData.name}</div>
                <div class="profile-caption">${userData.caption || 'Tidak ada caption.'}</div>
                <div class="profile-status">${userData.status || 'Tidak ada status.'}</div>
                <p style="font-size:0.8em; color: var(--text-muted);">ID: ${userId}</p>
            </div>
        `;
        showModal(content);
    });
}

// --- USER PRESENCE (ONLINE STATUS) ---
function setupUserPresence() {
    const myConnectionsRef = db.ref(`users/${currentUser.id}/connections`);
    const lastOnlineRef = db.ref(`users/${currentUser.id}/lastOnline`);
    const connectedRef = db.ref('.info/connected');
    connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
            const con = myConnectionsRef.push();
            con.onDisconnect().remove();
            lastOnlineRef.onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
            db.ref(`users/${currentUser.id}/isOnline`).set(true);
            con.set(true);
        }
    });
}

// --- BLOCK/UNBLOCK USERS ---
function loadBlockedUsers() {
    db.ref(`users/${currentUser.id}/blockedUsers`).on('value', snapshot => {
        blockedUsers = Object.keys(snapshot.val() || {});
    });
}

function blockUser(userId) {
    if (!confirm('Apakah Anda yakin ingin memblokir pengguna ini?')) return;
    db.ref(`users/${currentUser.id}/blockedUsers/${userId}`).set(true);
    showNotification('Pengguna telah diblokir.');
    if (privateChatOptionsEl) privateChatOptionsEl.remove();
    backToMain();
}

function unblockUser(userId) {
    db.ref(`users/${currentUser.id}/blockedUsers/${userId}`).remove();
    showNotification('Pengguna telah dibuka blokirnya.');
}

function showBlockedUsersModal() {
    let content = '<h3><i class="fas fa-ban"></i> Daftar Blokir</h3><ul class="member-list">';
    if (blockedUsers.length === 0) {
        content += '<p>Anda tidak memblokir siapa pun.</p>';
    } else {
        blockedUsers.forEach(userId => {
            db.ref(`users/${userId}/name`).once('value').then(snap => {
                const name = snap.val();
                const listItem = document.createElement('li');
                listItem.className = 'member-item';
                listItem.innerHTML = `
                    <span>${name} (ID: ${userId})</span>
                    <button class="danger" onclick="unblockUser('${userId}')">Buka Blokir</button>
                `;
                modalBody.querySelector('ul').appendChild(listItem);
            });
        });
        content += '</ul>';
    }
    showModal(content);
}

function deleteFriend(userId) {
    if (!confirm('Apakah Anda yakin ingin menghapus kontak ini?')) return;
    db.ref(`users/${currentUser.id}/friends/${userId}`).remove();
    db.ref(`users/${userId}/friends/${currentUser.id}`).remove();
    showNotification('Kontak telah dihapus.');
    if (privateChatOptionsEl) privateChatOptionsEl.remove();
    backToMain();
}

function showPrivateChatOptions() {
    if (privateChatOptionsEl) {
        privateChatOptionsEl.remove();
        return;
    }
    
    const friendId = currentPrivateChatId.split('_').find(id => id !== currentUser.id);
    
    privateChatOptionsEl = document.createElement('div');
    privateChatOptionsEl.className = 'private-chat-options';
    privateChatOptionsEl.innerHTML = `
        <button onclick="deleteFriend('${friendId}')"><i class="fas fa-user-minus"></i> Hapus Kontak</button>
        <button onclick="blockUser('${friendId}')" class="danger"><i class="fas fa-ban"></i> Blokir Pengguna</button>
    `;
    document.querySelector('#privateChatView header').appendChild(privateChatOptionsEl);

    setTimeout(() => {
        document.addEventListener('click', function closeOptions(e) {
            if (!privateChatOptionsEl.contains(e.target) && !e.target.closest('.fa-ellipsis-v')) {
                privateChatOptionsEl.remove();
                privateChatOptionsEl = null;
                document.removeEventListener('click', closeOptions);
            }
        });
    }, 100);
}

// --- GROUP CHAT LOGIC ---
function showCreateGroupModal() {
    const content = `
        <h3><i class="fas fa-plus-square"></i> Buat Grup Baru</h3>
        <form onsubmit="createGroup(event)">
            <input type="text" id="groupNameInput" placeholder="Nama Grup" required>
            <button type="submit">Buat Grup</button>
        </form>
    `;
    showModal(content);
}

function createGroup(e) {
    e.preventDefault();
    const groupName = document.getElementById('groupNameInput').value.trim();
    if (!groupName) return;
    const groupId = `GRP-${generateId()}`;
    db.ref(`groups/${groupId}`).set({
        name: groupName,
        adminId: currentUser.id,
        createdAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        db.ref(`groups/${groupId}/members/${currentUser.id}`).set(true);
        joinGroupChat(groupId, groupName);
        closeModal();
    });
}

function showJoinGroupModal() {
    const content = `
        <h3><i class="fas fa-sign-in-alt"></i> Gabung Grup</h3>
        <form onsubmit="joinGroup(event)">
            <input type="text" id="groupIdInput" placeholder="Masukkan ID Grup" required>
            <button type="submit">Gabung</button>
        </form>
    `;
    showModal(content);
}

function joinGroup(e) {
    e.preventDefault();
    const groupId = document.getElementById('groupIdInput').value.trim().toUpperCase();
    if (!groupId) return;
    db.ref(`groups/${groupId}`).once('value').then(snapshot => {
        if (snapshot.exists()) {
            const groupData = snapshot.val();
            db.ref(`groups/${groupId}/members/${currentUser.id}`).set(true);
            joinGroupChat(groupId, groupData.name);
            closeModal();
        } else {
            showNotification('Grup tidak ditemukan!', 3000);
        }
    });
}

function joinGroupChat(groupId, groupName) {
    currentGroupId = groupId;
    document.getElementById('groupChatTitle').textContent = groupName;
    document.getElementById('displayGroupId').textContent = `ID: ${groupId}`;
    document.getElementById('groupMessagesContainer').innerHTML = '';
    showView('groupChatView');
    
    db.ref(`users/${currentUser.id}/bannedGroups/${groupId}`).once('value').then(snapshot => {
        if (snapshot.exists()) {
            const banEndTime = snapshot.val();
            if (Date.now() < banEndTime) {
                const remainingTime = Math.ceil((banEndTime - Date.now()) / 60000);
                showNotification(`Anda telah dibanned dari grup ini selama ${remainingTime} menit.`, 5000);
                backToMain();
            } else {
                db.ref(`users/${currentUser.id}/bannedGroups/${groupId}`).remove();
            }
        }
    });

    db.ref(`groupMessages/${groupId}`).on('child_added', snapshot => {
        const message = snapshot.val();
        displayMessage('groupMessagesContainer', message);
    });
}

document.getElementById('groupMessageForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('groupMessageInput');
    const text = input.value.trim();
    if (!text || !currentGroupId) return;
    const messageData = {
        senderId: currentUser.id,
        senderName: currentUser.name,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    if (isToxic(text)) {
        const banDuration = 10 * 60 * 1000;
        const banEndTime = Date.now() + banDuration;
        db.ref(`users/${currentUser.id}/bannedGroups/${currentGroupId}`).set(banEndTime);
        showNotification('Anda mengirim kata toxic! Anda dibanned selama 10 menit.', 5000);
        db.ref(`groupMessages/${currentGroupId}`).push(messageData);
        input.value = '';
        backToMain();
        return;
    }
    db.ref(`groupMessages/${currentGroupId}`).push(messageData);
    input.value = '';
});

// --- FITUR UNDANGAN GRUP ---
function showInviteFriendsModal() {
    if (!currentGroupId) return;
    db.ref(`users/${currentUser.id}/friends`).once('value').then(snapshot => {
        const friends = snapshot.val();
        let content = `<h3><i class="fas fa-user-plus"></i> Undang Teman ke Grup</h3><ul class="member-list">`;
        if (!friends) {
            content += '<p>Anda belum memiliki teman untuk diundang.</p>';
        } else {
            Object.keys(friends).forEach(friendId => {
                db.ref(`users/${friendId}/name`).once('value').then(nameSnap => {
                    const friendName = nameSnap.val();
                    const listItem = document.createElement('li');
                    listItem.className = 'member-item';
                    listItem.innerHTML = `
                        <span>${friendName} (ID: ${friendId})</span>
                        <button onclick="sendGroupInvite('${friendId}', '${friendName}')"><i class="fas fa-paper-plane"></i> Undang</button>
                    `;
                    if (modalBody.querySelector('ul')) {
                        modalBody.querySelector('ul').appendChild(listItem);
                    }
                });
            });
            content += '</ul>';
        }
        showModal(content);
    });
}

function sendGroupInvite(friendId, friendName) {
    if (!currentGroupId) return;
    const groupName = document.getElementById('groupChatTitle').textContent;
    db.ref(`groupInvites/${friendId}`).push({
        groupId: currentGroupId,
        groupName: groupName,
        inviterName: currentUser.name,
        inviterId: currentUser.id,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        showNotification(`Undangan telah dikirim ke ${friendName}!`);
        closeModal(); 
    });
}

function listenForGroupInvites() {
    if (!currentUser) return;
    db.ref(`groupInvites/${currentUser.id}`).on('child_added', snapshot => {
        const inviteId = snapshot.key;
        const invite = snapshot.val();
        const joinBtn = `<button onclick="acceptGroupInvite('${inviteId}', '${invite.groupId}', '${invite.groupName}')">Gabung</button>`;
        const declineBtn = `<button onclick="declineGroupInvite('${inviteId}')">Tolak</button>`;
        const notifMessage = `${invite.inviterName} mengundang Anda ke grup "${invite.groupName}". ${joinBtn} ${declineBtn}`;
        triggerBrowserNotification('Undangan Grup Baru!', { body: `${invite.inviterName} mengundang Anda ke grup "${invite.groupName}".` });
        setTimeout(() => showNotification(notifMessage, 20000), 500);
    });
}

function acceptGroupInvite(inviteId, groupId, groupName) {
    db.ref(`groupInvites/${currentUser.id}/${inviteId}`).remove();
    db.ref(`groups/${groupId}/members/${currentUser.id}`).set(true).then(() => {
        showNotification(`Anda bergabung dengan grup ${groupName}!`);
        joinGroupChat(groupId, groupName);
    });
}

function declineGroupInvite(inviteId) {
    db.ref(`groupInvites/${currentUser.id}/${inviteId}`).remove();
    showNotification('Undangan grup ditolak.');
}

// --- PRIVATE CHAT (FRIENDS) LOGIC ---
function showAddFriendModal() {
    const content = `
        <h3><i class="fas fa-user-plus"></i> Tambah Teman</h3>
        <form onsubmit="sendFriendRequest(event)">
            <input type="text" id="friendIdInput" placeholder="Masukkan ID Publik Teman" required>
            <button type="submit">Kirim Permintaan</button>
        </form>
    `;
    showModal(content);
}

function sendFriendRequest(e) {
    e.preventDefault();
    const friendId = document.getElementById('friendIdInput').value.trim();
    if (!friendId || friendId === currentUser.id || blockedUsers.includes(friendId)) {
        showNotification('ID tidak valid!', 3000);
        return;
    }
    db.ref(`users/${friendId}`).once('value').then(snapshot => {
        if (snapshot.exists()) {
            db.ref(`users/${friendId}/friendRequests/${currentUser.id}`).set({
                fromName: currentUser.name,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                showNotification('Permintaan teman terkirim!');
                closeModal();
            });
        } else {
            showNotification('Pengguna dengan ID tersebut tidak ditemukan.');
        }
    });
}

function listenForFriendRequests() {
    if (!currentUser) return;
    db.ref(`users/${currentUser.id}/friendRequests`).on('child_added', snapshot => {
        const requestId = snapshot.key;
        const request = snapshot.val();
        triggerBrowserNotification('Permintaan Teman Baru!', { body: `${request.fromName} ingin menambahkan Anda sebagai teman.` });
        if (modal.classList.contains('show') && modalBody.querySelector('#pending-requests-list')) {
            showFriendsList();
        } else {
            const acceptBtn = `<button onclick="acceptFriendRequest('${requestId}', '${request.fromName}')">Terima</button>`;
            const declineBtn = `<button onclick="declineFriendRequest('${requestId}')">Tolak</button>`;
            setTimeout(() => showNotification(`Permintaan teman dari ${request.fromName}. ${acceptBtn} ${declineBtn}`, 15000), 500);
        }
    });
}

function acceptFriendRequest(requestId, requestName) {
    db.ref(`users/${currentUser.id}/friends/${requestId}`).set(true);
    db.ref(`users/${requestId}/friends/${currentUser.id}`).set(true);
    db.ref(`users/${currentUser.id}/friendRequests/${requestId}`).remove();
    showNotification(`Anda dan ${requestName} sekarang adalah teman!`);
    if (modal.classList.contains('show')) showFriendsList();
}

function declineFriendRequest(requestId) {
    db.ref(`users/${currentUser.id}/friendRequests/${requestId}`).remove();
    showNotification('Permintaan teman ditolak.');
    if (modal.classList.contains('show')) showFriendsList();
}

function showFriendsList() {
    const friendsRef = db.ref(`users/${currentUser.id}/friends`);
    const requestsRef = db.ref(`users/${currentUser.id}/friendRequests`);
    let content = '<h3><i class="fas fa-user-friends"></i> Daftar Teman</h3>';
    const pendingSection = `
        <div class="pending-requests" id="pending-requests-section">
            <h4>Permintaan Menunggu</h4>
            <ul class="member-list" id="pending-requests-list"></ul>
        </div>
    `;
    content += pendingSection;
    const friendsSection = `
        <h4>Teman</h4>
        <ul class="member-list" id="friends-list"></ul>
    `;
    content += friendsSection;
    showModal(content);

    requestsRef.once('value').then(snapshot => {
        const requests = snapshot.val();
        const listEl = document.getElementById('pending-requests-list');
        listEl.innerHTML = '';
        if (!requests || Object.keys(requests).length === 0) {
            document.getElementById('pending-requests-section').style.display = 'none';
        } else {
            document.getElementById('pending-requests-section').style.display = 'block';
            Object.keys(requests).forEach(requestId => {
                const request = requests[requestId];
                const listItem = document.createElement('li');
                listItem.className = 'member-item';
                listItem.innerHTML = `
                    <span>${request.fromName} (ID: ${requestId})</span>
                    <div>
                        <button onclick="acceptFriendRequest('${requestId}', '${request.fromName}')">Terima</button>
                        <button class="danger" onclick="declineFriendRequest('${requestId}')">Tolak</button>
                    </div>
                `;
                listEl.appendChild(listItem);
            });
        }
    });

    friendsRef.once('value').then(snapshot => {
        const friends = snapshot.val();
        const listEl = document.getElementById('friends-list');
        listEl.innerHTML = '';
        if (!friends) {
            listEl.innerHTML = '<p>Anda belum memiliki teman.</p>';
        } else {
            Object.keys(friends).forEach(friendId => {
                db.ref(`users/${friendId}`).once('value').then(userSnap => {
                    const friendData = userSnap.val();
                    const listItem = document.createElement('li');
                    listItem.className = 'member-item';
                    listItem.innerHTML = `
                        <div class="member-item-info">
                            <button class="view-profile-btn" onclick="showPublicProfileModal('${friendId}')" title="Lihat Profil"><i class="fas fa-eye"></i></button>
                            <span>${friendData.name} (ID: ${friendId})</span>
                        </div>
                        <button onclick="startPrivateChat('${friendId}', '${friendData.name}')"><i class="fas fa-comment"></i> Chat</button>
                    `;
                    listEl.appendChild(listItem);
                });
            });
        }
    });
}

function startPrivateChat(friendId, friendName) {
    if (blockedUsers.includes(friendId)) {
        showNotification('Anda tidak dapat mengirim pesan ke pengguna yang diblokir.');
        return;
    }
    currentPrivateChatId = [currentUser.id, friendId].sort().join('_');
    document.getElementById('privateChatTitle').textContent = `Chat dengan ${friendName}`;
    document.getElementById('privateMessagesContainer').innerHTML = '';
    closeModal();
    showView('privateChatView');
    db.ref(`privateMessages/${currentPrivateChatId}`).on('child_added', snapshot => {
        const message = snapshot.val();
        if (!blockedUsers.includes(message.senderId)) {
            displayMessage('privateMessagesContainer', message);
        }
    });
}

document.getElementById('privateMessageForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('privateMessageInput');
    const text = input.value.trim();
    if (!text || !currentPrivateChatId) return;
    const messageData = {
        senderId: currentUser.id,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    db.ref(`privateMessages/${currentPrivateChatId}`).push(messageData);
    input.value = '';
});

// --- ONLINE USERS ---
function showOnlineUsersModal() {
    let content = '<h3><i class="fas fa-globe"></i> User Online</h3><ul class="online-list">';
    const usersRef = db.ref('users');
    usersRef.orderByChild('isOnline').equalTo(true).on('value', snapshot => {
        const onlineUsers = snapshot.val();
        modalBody.querySelector('ul').innerHTML = '';
        if (!onlineUsers) {
            modalBody.querySelector('ul').innerHTML = '<p>Tidak ada user online.</p>';
        } else {
            Object.keys(onlineUsers).forEach(userId => {
                if (userId === currentUser.id || blockedUsers.includes(userId)) return;
                const userData = onlineUsers[userId];
                const listItem = document.createElement('li');
                listItem.className = 'online-item';
                listItem.innerHTML = `
                    <div class="online-item-info">
                        <div class="status"></div>
                        <button class="view-profile-btn" onclick="showPublicProfileModal('${userId}')" title="Lihat Profil"><i class="fas fa-eye"></i></button>
                        <span>${userData.name} (ID: ${userId})</span>
                    </div>
                    <button onclick="sendFriendRequestById('${userId}', '${userData.name}')"><i class="fas fa-user-plus"></i> Tambah</button>
                `;
                modalBody.querySelector('ul').appendChild(listItem);
            });
        }
    });
    content += '</ul>';
    showModal(content);
}

function sendFriendRequestById(userId, name) {
    db.ref(`users/${currentUser.id}/friends/${userId}`).once('value').then(friendSnap => {
        if (friendSnap.exists()) {
            showNotification('Anda sudah berteman dengan pengguna ini.');
            return;
        }
        db.ref(`users/${userId}/friendRequests/${currentUser.id}`).once('value').then(requestSnap => {
            if (requestSnap.exists()) {
                showNotification('Anda sudah mengirim permintaan kepada pengguna ini.');
                return;
            }
            db.ref(`users/${userId}/friendRequests/${currentUser.id}`).set({
                fromName: currentUser.name,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                showNotification(`Permintaan teman terkirim ke ${name}!`);
            });
        });
    });
}

// --- ADMIN & MEMBER LIST ---
function showGroupMembers() {
    if (!currentGroupId) return;
    db.ref(`groups/${currentGroupId}`).once('value').then(groupSnapshot => {
        const groupData = groupSnapshot.val();
        const isAdmin = groupData.adminId === currentUser.id;
        db.ref(`groups/${currentGroupId}/members`).once('value').then(membersSnapshot => {
            const members = membersSnapshot.val();
            let content = `<h3><i class="fas fa-users"></i> Anggota Grup</h3><ul class="member-list">`;
            Object.keys(members).forEach(memberId => {
                db.ref(`users/${memberId}`).once('value').then(userSnap => {
                    const memberData = userSnap.val();
                    const memberItem = document.createElement('li');
                    memberItem.className = 'member-item';
                    let actionButtons = '';
                    if (isAdmin && memberId !== currentUser.id) {
                        actionButtons = `
                            <button onclick="kickMember('${memberId}')">Kick</button>
                            <button onclick="banMember('${memberId}')">Ban</button>
                        `;
                    }
                    memberItem.innerHTML = `
                        <div class="member-item-info">
                            <button class="view-profile-btn" onclick="showPublicProfileModal('${memberId}')" title="Lihat Profil"><i class="fas fa-eye"></i></button>
                            <span>${memberData.name} (ID: ${memberId}) ${isAdmin && memberId === currentUser.id ? '<small>(Admin)</small>' : ''}</span>
                        </div>
                        ${actionButtons}
                    `;
                    if (modalBody.querySelector('ul')) {
                        modalBody.querySelector('ul').appendChild(memberItem);
                    }
                });
            });
            content += '</ul>';
            showModal(content);
        });
    });
}

function kickMember(memberId) {
    if (!currentGroupId) return;
    if (confirm('Apakah Anda yakin ingin menendang anggota ini?')) {
        db.ref(`groups/${currentGroupId}/members/${memberId}`).remove();
        showNotification('Anggota telah dikeluarkan dari grup.');
        closeModal();
    }
}

function banMember(memberId) {
    if (!currentGroupId) return;
    const duration = prompt('Masukkan durasi ban (dalam menit):', '60');
    if (duration && !isNaN(duration)) {
        const banDuration = parseInt(duration) * 60 * 1000;
        const banEndTime = Date.now() + banDuration;
        db.ref(`users/${memberId}/bannedGroups/${currentGroupId}`).set(banEndTime);
        db.ref(`users/${memberId}/notifications`).push({
            message: `Anda telah dibanned dari grup selama ${duration} menit oleh admin.`,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        db.ref(`groups/${currentGroupId}/members/${memberId}`).remove();
        showNotification(`Anggota telah dibanned selama ${duration} menit.`);
        closeModal();
    }
}

// --- CONTACT VIEW ---
function showContactView() {
    showView('contactView');
}

// --- MESSAGE DISPLAY ---
function displayMessage(containerId, message) {
    const container = document.getElementById(containerId);
    const messageEl = document.createElement('div');
    messageEl.classList.add('message');
    const isOwn = message.senderId === currentUser.id;
    if (isOwn) {
        messageEl.classList.add('own');
    }
    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    if (containerId === 'groupMessagesContainer' && !isOwn) {
        const nameEl = document.createElement('strong');
        nameEl.textContent = `${message.senderName}: `;
        bubble.appendChild(nameEl);
    }
    const textEl = document.createElement('span');
    textEl.textContent = message.text;
    bubble.appendChild(textEl);
    messageEl.appendChild(bubble);
    const metaEl = document.createElement('div');
    metaEl.classList.add('message-meta');
    const date = new Date(message.timestamp);
    metaEl.textContent = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    messageEl.appendChild(metaEl);
    container.appendChild(messageEl);
    container.scrollTop = container.scrollHeight;
}

// --- NOTIFICATION LISTENER ---
function listenForNotifications() {
    if (!currentUser) return;
    db.ref(`users/${currentUser.id}/notifications`).on('child_added', snapshot => {
        const notif = snapshot.val();
        showNotification(notif.message, 8000);
        triggerBrowserNotification('Notifikasi Admin', { body: notif.message });
        snapshot.ref.remove();
    });
}

// --- TOXICITY FILTER ---
const toxicWords = ['bego', 'goblok', 'anjing', 'bangsat', 'asu', 'kontol', 'memek', 'tolol'];
function isToxic(message) {
    const lowerCaseMessage = message.toLowerCase();
    return toxicWords.some(word => lowerCaseMessage.includes(word));
}

// --- STATUS FUNCTIONS ---
function showStatusView() {
    showView('statusView');
    loadStatuses();
}

function loadStatuses() {
    const statusContainer = document.getElementById('statusContainer');
    statusContainer.innerHTML = '';
    if (statusListener) statusListener.off();
    statusListener = db.ref('statuses').on('value', snapshot => {
        statusContainer.innerHTML = '';
        const statuses = snapshot.val();
        if (!statuses) {
            statusContainer.innerHTML = '<p style="width:100%; text-align:center; color:var(--text-muted);">Belum ada status.</p>';
            return;
        }
        const now = Date.now();
        Object.keys(statuses).forEach(statusId => {
            const status = statuses[statusId];
            if (status.expiresAt < now) {
                db.ref(`statuses/${statusId}`).remove();
                return;
            }
            renderStatusThumbnail(status);
        });
    });
}

function renderStatusThumbnail(status) {
    const statusContainer = document.getElementById('statusContainer');
    const thumbnailDiv = document.createElement('div');
    thumbnailDiv.className = 'status-thumbnail';
    thumbnailDiv.innerHTML = `<img src="${status.imageUrl}" alt="${status.userName}'s status">`;
    thumbnailDiv.onclick = () => showFullStatusModal(status);
    statusContainer.appendChild(thumbnailDiv);
}

function showFullStatusModal(status) {
    fullStatusImage.src = status.imageUrl;
    fullStatusCaption.innerHTML = `<p>${status.caption || ''}</p><small>${status.userName} • ${new Date(status.timestamp).toLocaleString('id-ID')}</small>`;
    fullStatusModal.classList.add('show');
}

function closeFullStatusModal() {
    fullStatusModal.classList.remove('show');
}

function showUploadStatusModal() {
    const content = `
        <h3><i class="fas fa-image"></i> Unggah Status Baru</h3>
        <form id="uploadStatusForm" onsubmit="uploadStatusToGitHub(event)">
            <label for="statusImageInput" id="statusImageLabel">
                <i class="fas fa-cloud-upload-alt" style="font-size: 3rem; color: var(--primary-color);"></i>
                <p>Klik untuk memilih gambar</p>
            </label>
            <input type="file" id="statusImageInput" accept="image/*" required onchange="previewStatusImage(event)">
            <img id="statusImagePreview" alt="Preview">
            <textarea id="statusCaptionInput" placeholder="Tulis caption..." maxlength="150"></textarea>
            <button type="submit" id="uploadStatusBtn"><i class="fas fa-upload"></i> Unggah</button>
        </form>
    `;
    showModal(content);
}

function previewStatusImage(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('statusImagePreview');
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        }
        reader.readAsDataURL(file);
    }
}

async function uploadStatusToGitHub(event) {
    event.preventDefault();
    const fileInput = document.getElementById('statusImageInput');
    const captionInput = document.getElementById('statusCaptionInput');
    const uploadBtn = document.getElementById('uploadStatusBtn');
    
    if (!fileInput.files[0]) {
        showNotification('Pilih gambar terlebih dahulu.');
        return;
    }

    const file = fileInput.files[0];
    const fileName = `${currentUser.id}-${Date.now()}.${file.name.split('.').pop()}`;
    const githubApiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}${fileName}`;

    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64data = reader.result.split(',')[1];
        
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengunggah...';

        try {
            const response = await fetch(githubApiUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Upload status image for ${currentUser.name}`,
                    content: base64data,
                }),
            });

            if (!response.ok) throw new Error('Gagal mengunggah ke GitHub.');

            const data = await response.json();
            const imageUrl = data.content.download_url;

            const statusData = {
                userId: currentUser.id,
                userName: currentUser.name,
                imageUrl: imageUrl,
                caption: captionInput.value.trim(),
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                expiresAt: Date.now() + (1 * 60 * 60 * 1000)
            };
            
            await db.ref('statuses').push(statusData);
            
            showNotification('Status berhasil diunggah!');
            closeModal();
            loadStatuses();

        } catch (error) {
            console.error('Upload error:', error);
            showNotification('Terjadi kesalahan saat mengunggah status.');
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Unggah';
        }
    };
    reader.readAsDataURL(file);
}

// --- MISC ---
function backToMain() {
    if (statusListener) {
        statusListener.off();
        statusListener = null;
    }
    if (currentGroupId) db.ref(`groupMessages/${currentGroupId}`).off();
    if (currentPrivateChatId) db.ref(`privateMessages/${currentPrivateChatId}`).off();
    currentGroupId = null;
    currentPrivateChatId = null;
    showView('mainView');
}

function logout() {
    if (confirm('Apakah Anda yakin ingin keluar?')) {
        db.ref(`users/${currentUser.id}/isOnline`).set(false);
        db.ref(`users/${currentUser.id}/connections`).remove();
        localStorage.removeItem('chatUserName');
        localStorage.removeItem('chatUserPrivacyId');
        currentUser = null;
        showView('loginView');
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('ID berhasil disalin!');
    });
}

function shareId(id) {
    if (navigator.share) {
        navigator.share({
            title: 'ID ChatKu Saya',
            text: `Tambahkan saya sebagai teman di ChatKu dengan ID: ${id}`,
        }).catch(err => console.log('Error sharing:', err));
    } else {
        copyToClipboard(id);
    }
}

// --- INITIALIZE ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
});