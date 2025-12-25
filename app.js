// --- 1. CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBXRdDsXLzDpksSXTQb8EVrRaEU5s4Xfm0",
    authDomain: "progest-e4b55.firebaseapp.com",
    projectId: "progest-e4b55",
    storageBucket: "progest-e4b55.firebasestorage.app",
    messagingSenderId: "195166049754",
    appId: "1:195166049754:web:246a8ef1e7653603eb5ce3"
};

// --- 2. IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, updateProfile, signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

let db, auth;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("✅ Firebase Initialisé");
} catch (e) { console.error("Erreur Firebase:", e); }

// --- 3. DEALS MANAGER ---
window.dealsManager = {
    fakeDeals: [
        { title: "Bosch Professional 103 pièces Jeu de forets et d'embouts", price: 34, old: 50, link: "https://amzn.to/3KTfEh0", img: "https://m.media-amazon.com/images/I/811e1lAbH7L._AC_SX569_.jpg", hot: true },
        { title: "Bosch Professional scie circulaire GKS 190", price: 122, old: 130, link: "https://amzn.to/3KW1EmQ", img: "https://m.media-amazon.com/images/I/51crVNWfQlL._AC_SX569_.jpg", hot: false },
        { title: "Makita DDF482Z Perceuse visseuse 60 nm 18 V Bleu", price: 79, old: 117, link: "https://amzn.to/4oR8nwo", img: "https://m.media-amazon.com/images/I/71bmqgnZQdL._AC_SY679_.jpg", hot: true },
        { title: "Makita DBO180Z Ponceuse Excentrique Ø 125 mm", price: 93, old: 118, link: "https://amzn.to/3MXR6UI", img: "https://m.media-amazon.com/images/I/51txDg7nshL._AC_SX569_.jpg", hot: false }
    ],
    render() {
        const g = document.getElementById('deals-grid'); if (!g) return;
        g.innerHTML = '';
        this.fakeDeals.forEach(d => {
            const discount = Math.round(((d.old - d.price) / d.old) * 100);
            const fire = d.hot ? '<i class="fa-solid fa-fire text-orange-500 animate-pulse absolute top-3 left-3 text-lg bg-white rounded-full p-1 shadow"></i>' : '';
            g.innerHTML += `
            <div class="glass rounded-2xl overflow-hidden shadow-lg card-hover relative group">
                ${fire} <span class="promo-badge">-${discount}%</span>
                <div class="h-48 bg-white flex items-center justify-center p-4 relative">
                    <img src="${d.img}" class="h-full object-contain group-hover:scale-110 transition-transform duration-500">
                </div>
                <div class="p-5">
                    <h3 class="font-bold text-slate-900 dark:text-white mb-2 leading-tight h-10 overflow-hidden">${d.title}</h3>
                    <div class="flex items-end gap-2 mb-4"><span class="text-2xl font-black text-red-500">${d.price}€</span><span class="text-sm text-slate-400 line-through mb-1">${d.old}€</span></div>
                    <a href="${d.link}" target="_blank" class="block w-full py-3 bg-slate-900 dark:bg-brand-600 text-white font-bold text-center rounded-xl hover:bg-slate-700 transition-colors btn-action">Voir l'offre</a>
                </div>
            </div>`;
        });
    }
};

// --- 4. DATA SERVICE ---
const DataService = {
    userId: null, isPremium: false,
    _getLocal(k) { return JSON.parse(localStorage.getItem('pg_' + k) || '[]'); },
    _saveLocal(k, v) { localStorage.setItem('pg_' + k, JSON.stringify(v)); },
    escapeHtml(text) {
        if (!text) return text;
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },
    async get(c) {
        console.log(`Getting ${c}, User: ${this.userId}, DB: ${!!db}`);
        if (db && this.userId && !this.userId.startsWith('demo_')) {
            try {
                const q = query(collection(db, c), where("uid", "==", this.userId));
                const s = await getDocs(q);
                this._online(true);
                return s.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) {
                console.error("Firestore Get Error:", e);
                this._online(false);
            }
        }
        return this._getLocal(c);
    },
    async add(c, d) {
        d.uid = this.userId || 'guest';
        d.created_at = new Date().toISOString();
        if (db && this.userId && !this.userId.startsWith('demo_')) {
            try {
                const r = await addDoc(collection(db, c), d);
                this._online(true);
                return { id: r.id, ...d };
            } catch (e) {
                console.error("Firestore Add Error:", e);
                alert(`Erreur sauvegarde Cloud: ${e.message}. Sauvegarde locale...`);
                this._online(false);
            }
        }
        const i = this._getLocal(c);
        d.id = 'loc_' + Date.now();
        i.push(d);
        this._saveLocal(c, i);
        return d;
    },
    async delete(c, id) {
        if (db && !id.startsWith('loc_') && this.userId && !this.userId.startsWith('demo_')) {
            try {
                await deleteDoc(doc(db, c, id));
                this._online(true);
                return;
            } catch (e) {
                console.error("Firestore Delete Error:", e);
                this._online(false);
            }
        }
        this._saveLocal(c, this._getLocal(c).filter(x => x.id !== id));
    },
    async saveSettings(d) {
        this._saveLocal('settings', [d]);
        if (db && this.userId && !this.userId.startsWith('demo_')) {
            try { await this.add('settings', d); } catch { }
        }
    },
    _online(s) {
        const h = s ? '<span class="w-1.5 h-1.5 bg-green-500 rounded-full status-dot"></span> ONLINE' : 'OFFLINE';
        const d = document.getElementById('badge-status-desktop');
        if (d) d.innerHTML = h;
    },
    checkPremium() { return true; },
    upgrade() {
        this.isPremium = true;
        alert("🎉 Bienvenue dans la Beta !");
        document.getElementById('modal-premium').classList.add('hidden');
        localStorage.setItem('pg_premium', 'true');
    },
    initPremium() {
        this.isPremium = localStorage.getItem('pg_premium') === 'true';
    },
    async calculateSavings() {
        let total = 0;
        const quoteCount = parseInt(localStorage.getItem('pg_count_quotes') || '0');
        const invoiceCount = parseInt(localStorage.getItem('pg_count_invoices') || '0');
        const siteCount = parseInt(localStorage.getItem('pg_count_sites') || '0');
        total += (quoteCount * 15) + (invoiceCount * 10) + (siteCount * 5);
        const el = document.getElementById('stat-savings');
        if (el) {
            el.innerText = total.toLocaleString('fr-FR') + ' €';
        }
        return total;
    },
    incrementCounter(type) {
        const key = 'pg_count_' + type;
        const current = parseInt(localStorage.getItem(key) || '0');
        localStorage.setItem(key, current + 1);
        this.calculateSavings();
    }
};
window.DataService = DataService;
DataService.initPremium();

// --- 5. AUTH MANAGER ---
window.authManager = {
    loginEmail: async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        const btn = document.querySelector('#view-login .btn-action');
        const originalBtnContent = btn.innerHTML;

        console.log("👉 Login Clicked:", email);
        if (!email || !password) return alert("Veuillez remplir l'email et le mot de passe.");
        if (!auth) return alert("Erreur CRITIQUE : Firebase n'est pas chargé.");

        if (errorDiv) errorDiv.classList.add('hidden');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connexion...';
        btn.disabled = true;

        try {
            const remember = document.getElementById('login-remember').checked;
            await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
            console.log("🆕 Attempting Creation...");
            await createUserWithEmailAndPassword(auth, email, password);
            console.log("✅ Created Successfully");
        } catch (e) {
            console.log("⚠️ Creation failed, trying LOGIN...", e.code);
            try {
                console.log("🔑 Attempting Sign In...");
                await signInWithEmailAndPassword(auth, email, password);
                console.log("✅ Logged in Successfully");
            } catch (loginErr) {
                console.error("❌ Login Failed:", loginErr);
                btn.innerHTML = originalBtnContent;
                btn.disabled = false;
                if (errorDiv) {
                    if (loginErr.code === 'auth/invalid-credential' || loginErr.code === 'auth/wrong-password') {
                        errorDiv.innerText = "Email ou mot de passe incorrect.";
                    } else {
                        errorDiv.innerText = "Erreur: " + loginErr.message;
                    }
                    errorDiv.classList.remove('hidden');
                } else {
                    alert("Erreur Connexion : " + loginErr.message);
                }
            }
        }
    },
    logout: async () => {
        if (confirm("Déconnexion ?")) {
            if (auth && auth.currentUser) await signOut(auth);
            window.location.reload();
        }
    }
};

// --- CORE MANAGERS ---
window.router = {
    navigate: (id) => {
        document.querySelectorAll('.view-section').forEach(e => { if (e.id !== 'view-login') { e.classList.remove('active'); e.classList.add('hidden'); } });
        const target = document.getElementById('view-' + id);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('active');
            target.style.display = (id === 'home') ? 'block' : '';
            if (id === 'home' && window.dashboard) window.dashboard.load();
            if (id === 'devis' && window.editorManager) window.editorManager.init();
            if (id === 'items' && window.itemManager) window.itemManager.render();
            if (id === 'clients' && window.clientManager) window.clientManager.render();
            if (id === 'calendar' && window.calendarManager) window.calendarManager.render();
            if (id === 'expenses' && window.expensesManager) window.expensesManager.init();
            if (id === 'settings' && window.settingsManager) window.settingsManager.load();
            if (id === 'deals' && window.dealsManager) window.dealsManager.render();
        }
        document.querySelectorAll('.nav-item, .nav-btn, .nav-btn-mobile').forEach(b => {
            b.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'text-brand-600', 'text-slate-400', 'text-red-500');
            if (b.classList.contains('nav-btn-mobile')) b.classList.add('text-slate-400');
            const targetId = b.dataset.target || (b.id ? b.id.replace('nav-', '') : '');
            if (targetId === id) {
                if (b.classList.contains('nav-item') || b.classList.contains('nav-btn')) {
                    b.classList.add('bg-slate-100', 'dark:bg-slate-800', 'text-brand-600');
                } else {
                    b.classList.add(id === 'deals' ? 'text-red-500' : 'text-brand-600');
                }
                b.classList.remove('text-slate-400');
            }
        });
    }
};

window.dashboard = {
    chartInstance: null,
    async load() {
        try {
            const d = await DataService.get('docs');
            const e = await DataService.get('expenses');
            let r = 0, s = 0, exp = 0;
            d.forEach(x => { if (x.status === 'validated' || x.type === 'facture') { r += x.ttc; s++; } });
            e.forEach(x => exp += x.amount);
            const margin = r - exp;

            if (document.getElementById('stat-revenue')) document.getElementById('stat-revenue').innerText = r.toFixed(0) + ' €';
            if (document.getElementById('stat-signed')) document.getElementById('stat-signed').innerText = s;
            if (document.getElementById('stat-margin')) {
                document.getElementById('stat-margin').innerText = margin.toFixed(2) + ' €';
                document.getElementById('stat-margin').className = margin >= 0 ? "text-2xl font-black text-green-600" : "text-2xl font-black text-red-600";
            }
            this.loadChart();
        } catch (e) { console.error("Dashboard Load Error:", e); }
    },
    async loadChart() {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;
        const year = parseInt(document.getElementById('chart-year').value);
        const docs = await DataService.get('docs');
        const monthlyData = Array(12).fill(0);
        docs.forEach(d => {
            if (d.status === 'validated' || d.type === 'facture') {
                const date = new Date(d.date);
                if (date.getFullYear() === year) monthlyData[date.getMonth()] += d.ttc;
            }
        });
        if (this.chartInstance) this.chartInstance.destroy();
        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
                datasets: [{ label: 'CA', data: monthlyData, borderColor: '#3b82f6', tension: 0.4 }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
};

window.editorManager = {
    AI_PROMPT: `Tu es un expert du bâtiment. Analyser cette photo pour un DEVIS.
IMPORTANT : Réponds UNIQUEMENT au format JSON strict :
[{"d": "Description", "q": 1, "p": 100}]`,
    lines: [],
    marketPrices: { 'prise': 25, 'interrupteur': 20, 'peinture': 35, 'placo': 45 },
    async analyzePhoto(input) {
        if (input.files && input.files[0]) {
            const btn = input.previousElementSibling;
            const originalContent = btn.innerHTML;
            try {
                btn.innerHTML = 'IA réfléchit...';
                const base64Image = await this.fileToBase64(input.files[0]);
                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: this.AI_PROMPT, imageBase64: base64Image })
                });
                if (!response.ok) throw new Error("Erreur serveur");
                const jsonResponse = await response.json();
                if (this.lines.length === 1 && !this.lines[0].d) this.lines = [];
                jsonResponse.forEach(r => this.lines.push({ d: r.d, q: r.q || 1, p: r.p || 0, tva: 0.2 }));
                this.renderLines();
                DataService.incrementCounter('quotes');
                alert("Analyse terminée !");
            } catch (e) {
                alert(`Erreur IA : ${e.message}`);
            } finally {
                btn.innerHTML = originalContent;
            }
        }
    },
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = error => reject(error);
        });
    },
    init() {
        this.lines = [{ d: '', q: 1, p: 0, tva: 0.2 }];
        this.renderLines();
        document.getElementById('editor-date').valueAsDate = new Date();
    },
    updateTotals() {
        let ht = 0, tvaTotal = 0;
        this.lines.forEach(l => { ht += l.q * l.p; tvaTotal += (l.q * l.p) * l.tva; });
        document.getElementById('editor-total-ht').innerText = ht.toFixed(2) + '€';
        document.getElementById('editor-total-tva').innerText = tvaTotal.toFixed(2) + '€';
        document.getElementById('editor-total-ttc').innerText = (ht + tvaTotal).toFixed(2) + '€';
    },
    renderLines() {
        const e = document.getElementById('editor-lines');
        e.innerHTML = '';
        this.lines.forEach((l, i) => {
            e.innerHTML += `<div class="glass p-3 rounded-xl flex gap-2 items-center flex-wrap mb-2">
                <button onclick="editorManager.removeLine(${i})" class="text-red-500 px-2"><i class="fa-solid fa-times"></i></button>
                <input class="flex-1 bg-transparent" value="${DataService.escapeHtml(l.d)}" oninput="editorManager.up(${i},'d',this.value)" placeholder="Prestation">
                <input class="w-14 text-center bg-slate-100 rounded" type="number" value="${l.q}" oninput="editorManager.up(${i},'q',this.value)">
                <input class="w-20 text-right bg-slate-100 rounded" type="number" value="${l.p}" oninput="editorManager.up(${i},'p',this.value)">
                <select class="w-16 bg-slate-100 rounded text-xs" onchange="editorManager.up(${i},'tva',this.value)">
                    <option value="0.2" ${l.tva == 0.2 ? 'selected' : ''}>20%</option>
                    <option value="0.1" ${l.tva == 0.1 ? 'selected' : ''}>10%</option>
                </select>
            </div>`;
        });
        this.updateTotals();
    },
    up(i, k, v) { this.lines[i][k] = k === 'd' ? v : parseFloat(v) || 0; this.updateTotals(); },
    addLine() { this.lines.push({ d: '', q: 1, p: 0, tva: 0.2 }); this.renderLines(); },
    removeLine(i) { if (this.lines.length > 1) { this.lines.splice(i, 1); this.renderLines(); } },
    async saveDocument() {
        // Simple save logic
        await DataService.add('docs', {
            type: 'devis', date: new Date().toISOString(),
            clientName: document.getElementById('editor-client-preview').innerText,
            lines: this.lines, ht: 0, ttc: 0, status: 'draft'
        });
        alert('Sauvegardé !'); router.navigate('home');
    }
};

window.clientManager = {
    async render() {
        const e = document.getElementById('clients-list-body');
        const c = await DataService.get('clients');
        e.innerHTML = '';
        c.forEach(x => e.innerHTML += `<div class="p-4 border mb-2 flex justify-between"><span>${x.name}</span><button onclick="clientManager.del('${x.id}')">Suppr</button></div>`);
    },
    openAddModal() { uiManager.openGenericModal('Nouveau Client', `<input id="new-c-name" class="w-full border p-2 mb-2"><button onclick="clientManager.save()" class="bg-blue-600 text-white p-2 rounded">Ajouter</button>`); },
    async save() {
        const n = document.getElementById('new-c-name').value;
        if (n) { await DataService.add('clients', { name: n }); uiManager.closeGenericModal(); this.render(); }
    },
    async del(i) { if (confirm('Supprimer ?')) { await DataService.delete('clients', i); this.render(); } }
};

window.uiManager = {
    openGenericModal(t, c) { const m = document.getElementById('modal-generic'); m.innerHTML = `<div class="fixed inset-0 bg-black/50" onclick="uiManager.closeGenericModal()"></div><div class="glass w-full max-w-md p-6 rounded-xl z-10 m-auto relative bg-white"><h3 class="font-bold mb-4">${t}</h3><div>${c}</div></div>`; m.classList.remove('hidden'); m.classList.add('flex'); },
    closeGenericModal() { document.getElementById('modal-generic').classList.add('hidden'); document.getElementById('modal-generic').classList.remove('flex'); }
};

// INIT
if (auth) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Utilisateur connecté:", user.uid);
            DataService.userId = user.uid;
            document.getElementById('view-login').classList.add('hidden');
            document.getElementById('view-login').classList.remove('active');
            router.navigate('home');
        } else {
            console.log("Utilisateur déconnecté");
            DataService.userId = null;
            document.getElementById('view-login').classList.remove('hidden');
            document.getElementById('view-login').classList.add('active');
        }
    });
}
