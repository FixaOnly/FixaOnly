// --- KONFIGURASI FIREBASE ANDA ---
const firebaseConfig = {
  apiKey: "AIzaSyDRtF_THDArZUG830_OOpxxDS_pmbo7i3g",
  authDomain: "gggffh-4b2ef.firebaseapp.com",
  projectId: "gggffh-4b2ef",
  storageBucket: "gggffh-4b2ef.appspot.com",
  messagingSenderId: "412227534781",
  appId: "1:412227534781:web:1d43004aeb03c054229cd4"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// --- ELEMEN DOM ---
const views = {
    username: document.getElementById('username-view'),
    landing: document.getElementById('landing-view'),
    join: document.getElementById('join-group-view'),
    chat: document.getElementById('chat-view')
};

const buttons = {
    createGroup: document.getElementById('create-group-btn'),
    joinGroup: document.getElementById('join-group-btn'),
    members: document.getElementById('members-btn'),
    copyId: document.getElementById('copy-id-btn'),
    shareId: document.getElementById('share-id-btn'),
    kickUser: document.getElementById('kick-user-btn'),
    banUser: document.getElementById('ban-user-btn'),
    attachPhoto: document.getElementById('attach-photo-btn'),
    attachFile: document.getElementById('attach-file-btn'),
    recordVoice: document.getElementById('record-voice-btn'),
    cancelFile: document.getElementById('cancel-file-btn')
};

const forms = {
    username: document.getElementById('username-form'),
    join: document.getElementById('join-form'),
    message: document.getElementById('message-form')
};

const inputs = {
    username: document.getElementById('username-input'),
    joinId: document.getElementById('join-id'),
    message: document.getElementById('message-input'),
    banDuration: document.getElementById('ban-duration'),
    fileInput: document.getElementById('file-input')
};

const elements = {
    displayUsername: document.getElementById('display-username'),
    groupIdDisplay: document.getElementById('group-id-display'),
    messagesContainer: document.getElementById('messages-container'),
    membersList: document.getElementById('members-list'),
    membersModal: document.getElementById('members-modal'),
    adminModal: document.getElementById('admin-modal'),
    adminTargetName: document.getElementById('admin-target-name'),
    notification: document.getElementById('notification'),
    filePreview: document.getElementById('file-preview'),
    previewFilename: document.getElementById('preview-filename')
};

// --- STATE MANAJEMEN ---
let currentUser = {
    name: '',
    id: null,
    isAdmin: false
};
let currentGroupId = null;
let messageListeners = [];
let memberListeners = [];
let pendingFile = null;
let mediaRecorder = null;
let audioChunks = [];

// --- FUNGSI HELPER ---
function generateId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = 'device-' + generateId();
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
}

function showView(viewName) {
    console.log(`showView dipanggil dengan: ${viewName}`); // DEBUG
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[viewName].classList.add('active');
    console.log(`Tampilan aktif seharusnya: ${viewName}`); // DEBUG
}

function showNotification(message, duration = 5000) {
    elements.notification.textContent = message;
    elements.notification.classList.add('show');
    setTimeout(() => {
        elements.notification.classList.remove('show');
    }, duration);
}

function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- FUNGSI UTAMA APLIKASI ---
function setUsername(e) {
    e.preventDefault();
    const usernameInput = inputs.username.value.trim();
    console.log("Username yang diketik:", usernameInput); // DEBUG

    if (!usernameInput) {
        showNotification("Username tidak boleh kosong.");
        return;
    }

    const username = sanitizeHTML(usernameInput);
    console.log("Username setelah dibersihkan:", username); // DEBUG

    try {
        localStorage.setItem('chatUsername', username);
        console.log("Username berhasil disimpan ke localStorage."); // DEBUG
        
        currentUser.name = username;
        currentUser.id = getDeviceId();
        
        elements.displayUsername.textContent = username;
        console.log("Mencoba beralih ke tampilan 'landing'..."); // DEBUG
        showView('landing');
        console.log("Tampilan 'landing' seharusnya sudah aktif."); // DEBUG

    } catch (error) {
        console.error("Gagal menyimpan username ke localStorage:", error);
        showNotification("Terjadi kesalahan. Browser Anda mungkin tidak mendukung penyimpanan lokal.");
    }
}

function checkUsername() {
    console.log("Memeriksa username yang tersimpan..."); // DEBUG
    const savedUsername = localStorage.getItem('chatUsername');
    console.log("Username yang ditemukan di localStorage:", savedUsername); // DEBUG

    if (savedUsername) {
        currentUser.name = savedUsername;
        currentUser.id = getDeviceId();
        elements.displayUsername.textContent = savedUsername;
        console.log("Username ditemukan, menampilkan tampilan 'landing'."); // DEBUG
        showView('landing');
    } else {
        console.log("Tidak ada username, menampilkan tampilan 'username'."); // DEBUG
        showView('username');
    }
}

async function createGroup() {
    const groupId = generateId();
    currentUser.isAdmin = true;
    currentGroupId = groupId;

    try {
        await db.collection('groups').doc(groupId).set({ createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        await db.collection('groups').doc(groupId).collection('members').doc(currentUser.id).set({
            name: currentUser.name,
            joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
            isAdmin: true
        });
        enterChatView();
    } catch (error) {
        console.error("Error creating group: ", error);
        showNotification("Gagal membuat grup. Coba lagi.");
    }
}

async function joinGroup(e) {
    e.preventDefault();
    const groupId = sanitizeHTML(inputs.joinId.value.trim().toUpperCase());
    if (!groupId) return;

    const banDoc = await db.collection('groups').doc(groupId).collection('bannedUsers').doc(currentUser.id).get();
    if (banDoc.exists) {
        const banData = banDoc.data();
        if (!banData.bannedUntil || banData.bannedUntil.toDate() > new Date()) {
            showNotification("Anda telah di-ban dari grup ini.");
            return;
        } else {
            await banDoc.ref.delete();
        }
    }

    currentUser.isAdmin = false;
    currentGroupId = groupId;

    try {
        const groupRef = db.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();
        if (!groupDoc.exists) {
            showNotification("Grup tidak ditemukan.");
            return;
        }

        await groupRef.collection('members').doc(currentUser.id).set({
            name: currentUser.name,
            joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
            isAdmin: false
        });
        enterChatView();
    } catch (error) {
        console.error("Error joining group: ", error);
        showNotification("Gagal bergabung. Coba lagi.");
    }
}

function enterChatView() {
    showView('chat');
    elements.groupIdDisplay.textContent = `ID: ${currentGroupId}`;
    setupChatListeners();
    adjustForKeyboard();
}

function setupChatListeners() {
    const messageListener = db.collection('groups').doc(currentGroupId).collection('messages')
        .orderBy('timestamp')
        .onSnapshot(snapshot => {
            elements.messagesContainer.innerHTML = '';
            snapshot.forEach(doc => {
                displayMessage(doc.data());
            });
            scrollToBottom();
        });
    messageListeners.push(messageListener);

    const memberListener = db.collection('groups').doc(currentGroupId).collection('members')
        .onSnapshot(snapshot => {
            updateMembersList(snapshot);
            if (!snapshot.docs.some(doc => doc.id === currentUser.id)) {
                showNotification('Anda telah dikeluarkan dari grup.');
                leaveChat();
            }
        });
    memberListeners.push(memberListener);

    const banListener = db.collection('groups').doc(currentGroupId).collection('bannedUsers').doc(currentUser.id)
        .onSnapshot(doc => {
            if (doc.exists) {
                const banData = doc.data();
                const bannedBy = banData.bannedBy || 'Admin';
                const duration = banData.bannedUntil ? ` sampai ${banData.bannedUntil.toDate().toLocaleString()}` : ' secara permanen.';
                showNotification(`Anda telah di-BAN oleh ${bannedBy}${duration}`, 10000);
                leaveChat();
            }
        });
    memberListeners.push(banListener);
}

async function displayMessage(message) {
    const messageEl = document.createElement('div');
    const isSent = message.senderId === currentUser.id;
    messageEl.classList.add('message', isSent ? 'sent' : 'received');

    let content = '';
    if (message.type === 'text') {
        content = `<div>${sanitizeHTML(message.text)}</div>`;
    } else if (message.type === 'image') {
        content = `<img src="${message.fileUrl}" alt="Image" loading="lazy">`;
    } else if (message.type === 'file') {
        content = `<a href="${message.fileUrl}" target="_blank" download="${message.fileName}">📄 ${message.fileName}</a>`;
    } else if (message.type === 'audio') {
        content = `<audio controls src="${message.fileUrl}"></audio>`;
    }

    const senderInfo = `<div class="sender">${sanitizeHTML(message.senderName)}</div>`;
    messageEl.innerHTML = isSent ? content : senderInfo + content;
    elements.messagesContainer.appendChild(messageEl);
}

function updateMembersList(snapshot) {
    elements.membersList.innerHTML = '';
    snapshot.forEach(doc => {
        const member = doc.data();
        const li = document.createElement('li');
        const memberInfo = document.createElement('div');
        memberInfo.classList.add('member-info');
        memberInfo.innerHTML = `<span class="name">${sanitizeHTML(member.name)}</span> ${member.isAdmin ? '(Admin)' : ''}`;
        li.appendChild(memberInfo);

        if (currentUser.isAdmin && doc.id !== currentUser.id) {
            const memberActions = document.createElement('div');
            memberActions.classList.add('member-actions');
            const kickBtn = document.createElement('button'); kickBtn.textContent = 'Kick'; kickBtn.classList.add('btn', 'warning'); kickBtn.onclick = () => showAdminModal(member.name, doc.id, 'kick');
            const banBtn = document.createElement('button'); banBtn.textContent = 'Ban'; banBtn.classList.add('btn', 'danger'); banBtn.onclick = () => showAdminModal(member.name, doc.id, 'ban');
            memberActions.appendChild(kickBtn); memberActions.appendChild(banBtn);
            li.appendChild(memberActions);
        }
        elements.membersList.appendChild(li);
    });
}

async function sendMessage(e) {
    e.preventDefault();
    const text = inputs.message.value.trim();
    if (!text && !pendingFile) return;

    let messageData = {
        senderName: currentUser.name,
        senderId: currentUser.id,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        type: 'text',
        text: text
    };

    if (pendingFile) {
        const filePath = `groups/${currentGroupId}/${pendingFile.name}`;
        const fileRef = storage.ref().child(filePath);
        await fileRef.put(pendingFile);
        const fileUrl = await fileRef.getDownloadURL();

        messageData.type = pendingFile.type.startsWith('image/') ? 'image' : 'file';
        messageData.fileName = pendingFile.name;
        messageData.fileUrl = fileUrl;
        
        clearPendingFile();
    }

    try {
        await db.collection('groups').doc(currentGroupId).collection('messages').add(messageData);
        inputs.message.value = '';
        scrollToBottom();
    } catch (error) {
        console.error("Error sending message: ", error);
        showNotification("Gagal mengirim pesan.");
    }
}

function leaveChat() {
    messageListeners.forEach(unsubscribe => unsubscribe());
    memberListeners.forEach(unsubscribe => unsubscribe());
    messageListeners = [];
    memberListeners = [];
    
    if (currentUser.id && currentGroupId) {
        db.collection('groups').doc(currentGroupId).collection('members').doc(currentUser.id).delete();
    }
    
    currentUser.isAdmin = false;
    currentGroupId = null;
    showView('landing');
}

// --- FITUR MEDIA (PHOTO, FILE, VN) ---
function handleFileSelect(e, isPhoto = false) {
    const file = e.target.files[0];
    if (file) {
        if (isPhoto && !file.type.startsWith('image/')) {
            showNotification('File yang dipilih bukan gambar.');
            return;
        }
        pendingFile = file;
        elements.previewFilename.textContent = file.name;
        elements.filePreview.style.display = 'flex';
    }
}

function clearPendingFile() {
    pendingFile = null;
    inputs.fileInput.value = '';
    elements.filePreview.style.display = 'none';
}

// --- FITUR VOICE NOTE (VN) ---
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
            const audioFile = new File([audioBlob], `vn-${Date.now()}.mp3`, { type: 'audio/mp3' });
            
            const filePath = `groups/${currentGroupId}/${audioFile.name}`;
            const fileRef = storage.ref().child(filePath);
            await fileRef.put(audioFile);
            const fileUrl = await fileRef.getDownloadURL();

            const messageData = {
                senderName: currentUser.name,
                senderId: currentUser.id,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                type: 'audio',
                fileUrl: fileUrl
            };

            await db.collection('groups').doc(currentGroupId).collection('messages').add(messageData);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        buttons.recordVoice.classList.add('recording');
        showNotification('Sedang merekam... Lepas untuk selesai.');
    } catch (error) {
        console.error("Error starting recording:", error);
        showNotification('Gagal mengakses mikrofon.');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        buttons.recordVoice.classList.remove('recording');
    }
}

// --- FITUR ADMIN ---
let targetUserId = null; let targetAction = null;
function showAdminModal(userName, userId, action) {
    targetUserId = userId; targetAction = action;
    elements.adminTargetName.textContent = userName;
    elements.adminModal.style.display = 'block';
}
async function performAdminAction() {
    if (!targetUserId || !targetAction) return;
    const durationMinutes = parseInt(inputs.banDuration.value, 10);
    const bannedUntil = durationMinutes > 0 ? new Date(Date.now() + durationMinutes * 60 * 1000) : null;
    try {
        if (targetAction === 'kick') {
            await db.collection('groups').doc(currentGroupId).collection('members').doc(targetUserId).delete();
        } else if (targetAction === 'ban') {
            await db.collection('groups').doc(currentGroupId).collection('bannedUsers').doc(targetUserId).set({
                bannedBy: currentUser.name,
                bannedAt: firebase.firestore.FieldValue.serverTimestamp(),
                bannedUntil: bannedUntil ? firebase.firestore.Timestamp.fromDate(bannedUntil) : null
            });
            await db.collection('groups').doc(currentGroupId).collection('members').doc(targetUserId).delete();
        }
        elements.adminModal.style.display = 'none';
        inputs.banDuration.value = '';
    } catch (error) {
        console.error("Error performing admin action: ", error);
        showNotification("Gagal melakukan aksi admin.");
    }
}

// --- UI/UX INTERAKSI ---
function scrollToBottom() { elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight; }
function adjustForKeyboard() {
    const initialHeight = window.innerHeight;
    window.addEventListener('resize', () => {
        if (window.innerHeight < initialHeight) {
            document.body.style.height = initialHeight + 'px';
        } else {
            document.body.style.height = '100vh';
        }
        scrollToBottom();
    });
}

// --- EVENT LISTENERS ---
forms.username.addEventListener('submit', setUsername);
buttons.createGroup.addEventListener('click', createGroup);
buttons.joinGroup.addEventListener('click', () => showView('join'));
forms.join.addEventListener('submit', joinGroup);
forms.message.addEventListener('submit', sendMessage);
buttons.members.addEventListener('click', () => { elements.membersModal.style.display = 'block'; });
buttons.copyId.addEventListener('click', () => { navigator.clipboard.writeText(currentGroupId).then(() => showNotification('ID Grup disalin!')); });
buttons.shareId.addEventListener('click', async () => {
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Gabung Grup Chat Saya',
                text: `Gabung ke grup chat saya dengan ID: ${currentGroupId}`,
                url: window.location.href
            });
        } catch (err) { console.log('Error sharing:', err); }
    } else {
        navigator.clipboard.writeText(`${window.location.href}#join-${currentGroupId}`).then(() => { showNotification('Link gabung disalin!'); });
    }
});
buttons.attachPhoto.addEventListener('click', () => { inputs.fileInput.setAttribute('accept', 'image/*'); inputs.fileInput.click(); });
buttons.attachFile.addEventListener('click', () => { inputs.fileInput.setAttribute('accept', '.pdf,.doc,.docx,.zip'); inputs.fileInput.click(); });
inputs.fileInput.addEventListener('change', (e) => handleFileSelect(e));
buttons.cancelFile.addEventListener('click', clearPendingFile);

// Voice Note Events
buttons.recordVoice.addEventListener('mousedown', startRecording);
buttons.recordVoice.addEventListener('mouseup', stopRecording);
buttons.recordVoice.addEventListener('mouseleave', stopRecording);
buttons.recordVoice.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
buttons.recordVoice.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });

// Modal events
document.querySelectorAll('.close-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.target.closest('.modal').style.display = 'none'; }); });
window.addEventListener('click', (e) => { if (e.target.classList.contains('modal')) { e.target.style.display = 'none'; } });
buttons.kickUser.addEventListener('click', () => performAdminAction());
buttons.banUser.addEventListener('click', () => performAdminAction());

// Inisialisasi
window.addEventListener('load', () => {
    console.log("Aplikasi dimuat. Menjalankan checkUsername..."); // DEBUG
    checkUsername();
});