// --- KONFIGURASI & INISIALISASI FIREBASE ---
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
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- GLOBAL VARIABLES ---
let currentUser = null;
let currentGroupId = null;
let currentPrivateChatId = null;
let blockedUsers = []; // Cache for blocked users
let privateChatOptionsEl = null; // For dropdown menu

// --- DOM ELEMENTS ---
const views = document.querySelectorAll('.view');
const loginForm = document.getElementById('loginForm');
const nameInput = document.getElementById('nameInput');
const privacyIdInput = document.getElementById('privacyIdInput');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const notification = document.getElementById('notification');

// --- HELPER FUNCTIONS ---
function generateId() {
    // Fungsi ini tetap digunakan untuk ID lain seperti Grup, dll.
    return Math.random().toString().substring(2, 10);
}

// --- FUNGSI BARU UNTUK ID PENGGUNA ---
const USER_ID_PREFIX = "FIXA-"; // Awalan untuk ID pengguna

function generateUserId() {
    // Menghasilkan ID dengan awalan "FIXA-" diikuti 9 karakter acak
    const randomPart = Math.random().toString().substring(2, 11);
    return USER_ID_PREFIX + randomPart;
}

// --- FUNGSI BARU UNTUK VISIBILITY ---
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

// --- AUTH & USER SETUP ---
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
        <form onsubmit="createAccount(event)">
            <input type="text" id="newNameInput" placeholder="Nama Anda" required>
            <div class="password-container">
                <input type="password" id="newPrivacyIdInput" placeholder="ID Privasi Anda" required readonly>
                <button type="button" class="toggle-visibility-btn" onclick="toggleInputVisibility('newPrivacyIdInput', this)">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
            <button type="submit">Buat Akun</button>
        </form>
    `;
    showModal(content);
    // Generate ID dan tampilkan di input
    const privacyId = generateUserId(); // Menggunakan fungsi baru
    document.getElementById('newPrivacyIdInput').value = privacyId;
}

function createAccount(e) {
    e.preventDefault();
    const name = document.getElementById('newNameInput').value.trim();
    const privacyId = document.getElementById('newPrivacyIdInput').value.trim();
    if (!name || !privacyId) return;

    const publicId = generateUserId(); // Menggunakan fungsi baru
    db.ref(`usersByPrivacyId/${privacyId}`).set(publicId).then(() => {
        db.ref(`users/${publicId}`).set({
            name: name,
            privacyId: privacyId,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        localStorage.setItem('chatUserName', name);
        localStorage.setItem('chatUserPrivacyId', privacyId);
        loginUser(name, privacyId);
        closeModal();
    }).catch(err => {
        showNotification('ID Privasi sudah digunakan. Silakan coba lagi atau buat yang baru.');
    });
}

function loginUser(name, privacyId) {
    db.ref(`usersByPrivacyId/${privacyId}`).once('value').then(snapshot => {
        if (snapshot.exists()) {
            const publicId = snapshot.val();
            db.ref(`users/${publicId}`).once('value').then(userSnap => {
                const userData = userSnap.val();
                currentUser = { name: userData.name, id: publicId, privacyId: userData.privacyId };
                
                document.getElementById('displayName').textContent = currentUser.name;
                
                // --- Setup ID Pengguna (Selalu Terlihat) ---
                const userIdSpan = document.getElementById('displayUserId');
                userIdSpan.innerText = `ID: ${currentUser.id}`; // Tampilkan ID lengkap tanpa sensor

                // --- Setup ID Privasi (Dapat Disembunyikan) ---
                const privacyIdSpan = document.getElementById('displayPrivacyId');
                const fullPrivacyText = `ID Privasi: ${currentUser.privacyId}`;
                const maskedPrivacyText = `ID Privasi: ${currentUser.privacyId.substring(0, 10)}***`;
                
                privacyIdSpan.setAttribute('data-full-text', fullPrivacyText);
                privacyIdSpan.setAttribute('data-masked-text', maskedPrivacyText);
                privacyIdSpan.innerText = maskedPrivacyText; // Tampilkan dalam keadaan tersembunyi awalnya

                showView('mainView');
                setupUserPresence();
                loadBlockedUsers();
                listenForNotifications();
                listenForFriendRequests();
                listenForGroupInvites();
                requestNotificationPermission();
            });
        } else {
            showNotification('ID Privasi atau Nama salah.', 3000);
        }
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
    backToMain(); // Go back to main to avoid chatting with blocked user
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
    if (privateChatOptionsEl) { // If already open, close it
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

    // Close on click outside
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

    const groupId = `GRP-${generateId()}`; // Menggunakan generateId() biasa untuk grup
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
        const banDuration = 10 * 60 * 1000; // 10 minutes
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
                db.ref(`users/${friendId}/name`).once('value').then(nameSnap => {
                    const friendName = nameSnap.val();
                    const listItem = document.createElement('li');
                    listItem.className = 'member-item';
                    listItem.innerHTML = `
                        <span>${friendName} (ID: ${friendId})</span>
                        <button onclick="startPrivateChat('${friendId}', '${friendName}')"><i class="fas fa-comment"></i> Chat</button>
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
                    <span><div class="status"></div> ${userData.name} (ID: ${userId})</span>
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
                db.ref(`users/${memberId}/name`).once('value').then(nameSnap => {
                    const memberName = nameSnap.val();
                    const memberItem = document.createElement('li');
                    memberItem.className = 'member-item';
                    let actionButtons = '';
                    if (isAdmin && memberId !== currentUser.id) {
                        actionButtons = `
                            <button onclick="kickMember('${memberId}')">Kick</button>
                            <button onclick="banMember('${memberId}')">Ban</button>
                        `;
                    }
                    memberItem.innerHTML = `<span>${memberName} (ID: ${memberId}) ${isAdmin && memberId === currentUser.id ? '<small>(Admin)</small>' : ''}</span> ${actionButtons}`;
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

// --- MISC ---
function backToMain() {
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