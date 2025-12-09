// =================================================================
// 1. CONFIGURATION FIREBASE
// =================================================================
// ATTENTION : REMPLACER CES VALEURS PAR VOTRE CONFIGURATION FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBRf-NwthSNFBF0dS0zir6SZn98H8VZZ8I",
  authDomain: "comptes-91724.firebaseapp.com",
  projectId: "comptes-91724",
  storageBucket: "comptes-91724.firebasestorage.app",
  messagingSenderId: "624257037522",
  appId: "1:624257037522:web:09469d86cec54afa86a90b"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// =================================================================
// 2. REFERENCES DOM ET VARIABLES D'ÉTAT
// =================================================================
const authButton = document.getElementById('auth-button');
const authStatus = document.getElementById('auth-status');
const appContent = document.getElementById('app-content');
const transactionForm = document.getElementById('transaction-form');
const transactionsTbody = document.getElementById('transactions-tbody');
const totalRevenuEl = document.getElementById('total-revenu');
const totalDepenseEl = document.getElementById('total-depense');
const soldeNetEl = document.getElementById('solde-net');
const monthFilter = document.getElementById('month-filter');

// Modal d'authentification
const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const submitAuthBtn = document.getElementById('submit-auth-btn');
const toggleModeBtn = document.getElementById('toggle-mode-btn');
const closeButton = document.querySelector('.modal-content .close-button');
const dateInput = document.getElementById('date'); // Référence au champ de date

let currentUser = null;
let isLoginMode = true; // État initial: Connexion

// =================================================================
// 3. FONCTIONS UTILITAIRES POUR LA DATE
// =================================================================

/**
 * Gère le formatage automatique (ajout des '/') et le saut de champ (auto-tab).
 * @param {Event} event 
 */
function handleDateInput(event) {
    const input = event.target;
    let value = input.value.replace(/[^0-9]/g, ''); // N'autorise que les chiffres

    // Longueur actuelle
    const len = value.length;
    
    // Application du format JJ/MM/AAAA
    if (len > 2 && len <= 4) {
        value = value.substring(0, 2) + '/' + value.substring(2);
    } else if (len > 4) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4) + '/' + value.substring(4, 8);
    }

    input.value = value;

    // Sauts automatiques (auto-tab)
    if (len === 2 && event.data && input.value[2] !== '/') {
        // Saute au mois après 2 chiffres pour le jour
        input.value += '/';
        
    } else if (len === 4 && event.data && input.value[5] !== '/') {
        // Saute à l'année après 2 chiffres pour le mois
        input.value = value.substring(0, 5) + '/' + value.substring(5);
        
    } else if (len === 10) {
        // Saute au champ suivant (Montant) après avoir entré la date complète
        document.getElementById('montant').focus();
    }
}

// Ajout du listener pour la saisie de date
dateInput.addEventListener('input', handleDateInput);


/**
 * Convertit le format JJ/MM/AAAA en AAAA-MM-JJ pour Firebase.
 * @param {string} dateString Date au format JJ/MM/AAAA
 * @returns {string|null} Date au format AAAA-MM-JJ ou null si invalide
 */
function convertDateToStandard(dateString) {
    const parts = dateString.split('/');
    if (parts.length === 3) {
        const [day, month, year] = parts;
        // Vérifie le format de base (deux chiffres pour jour/mois, quatre pour l'année)
        if (day.length === 2 && month.length === 2 && year.length === 4) {
             // Vérifie si c'est une date valide (utilise le constructeur Date pour la validation)
            const d = new Date(`${year}-${month}-${day}`);
            if (d.getFullYear() == year && (d.getMonth() + 1) == month && d.getDate() == day) {
                return `${year}-${month}-${day}`;
            }
        }
    }
    return null; // Date invalide
}

// =================================================================
// 4. LOGIQUE D'AUTHENTIFICATION (MODAL)
// =================================================================

// Initialiser le filtre de mois au mois actuel
function initializeMonthFilter() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const currentMonthString = `${year}-${month}`;
    monthFilter.value = currentMonthString;
}
initializeMonthFilter();

// Afficher/Masquer le mot de passe (UX Sécurité)
window.togglePasswordVisibility = function() {
    const icon = document.querySelector('.toggle-password i');
    if (authPasswordInput.type === 'password') {
        authPasswordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        authPasswordInput.type = 'password';
        icon.classList.add('fa-eye');
        icon.classList.remove('fa-eye-slash');
    }
};

// Gestionnaire d'ouverture du modal
authButton.addEventListener('click', () => {
    authModal.classList.remove('hidden');
});

// Gestionnaires de fermeture du modal
closeButton.addEventListener('click', () => authModal.classList.add('hidden'));
window.addEventListener('click', (e) => {
    if (e.target === authModal) {
        authModal.classList.add('hidden');
    }
});

// Basculer entre Connexion et Inscription
toggleModeBtn.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        submitAuthBtn.textContent = 'Connexion';
        toggleModeBtn.textContent = "Pas de compte ? S'inscrire";
    } else {
        submitAuthBtn.textContent = "S'inscrire";
        toggleModeBtn.textContent = "Déjà un compte ? Se Connecter";
    }
});

// Soumission du formulaire d'authentification
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEmailInput.value;
    const password = authPasswordInput.value;

    try {
        if (isLoginMode) {
            await auth.signInWithEmailAndPassword(email, password);
        } else {
            await auth.createUserWithEmailAndPassword(email, password);
        }
        authModal.classList.add('hidden'); // Fermer le modal en cas de succès
    } catch (error) {
        alert(`Erreur d'authentification : ${error.message}`);
    }
});

function logout() {
    auth.signOut();
}

// État de l'utilisateur
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        // Mettre à jour l'UX après connexion
        authStatus.innerHTML = `
            Connecté: <strong>${user.email}</strong> 
            <button id="logout-button" class="btn secondary ml-10"><i class="fas fa-sign-out-alt"></i> Déconnexion</button>
        `;
        document.getElementById('logout-button').addEventListener('click', logout);
        appContent.classList.remove('hidden');
        
        // Lancer l'écoute des transactions
        listenForTransactions();
        monthFilter.addEventListener('change', listenForTransactions);

    } else {
        // Mettre à jour l'UX après déconnexion
        currentUser = null;
        authStatus.innerHTML = '<button id="auth-button" class="btn primary"><i class="fas fa-sign-in-alt"></i> Se Connecter</button>';
        document.getElementById('auth-button').addEventListener('click', () => authModal.classList.remove('hidden'));
        appContent.classList.add('hidden');
        transactionsTbody.innerHTML = '';
        updateSummary(0, 0);
        monthFilter.removeEventListener('change', listenForTransactions);
    }
});

// =================================================================
// 5. GESTION DES TRANSACTIONS (CRUD)
// =================================================================

function getUserTransactionsRef() {
    if (!currentUser) return null;
    return db.collection('users').doc(currentUser.uid).collection('transactions');
}

// Ajouter une transaction
transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUser) return;

    const rawDateValue = dateInput.value;
    const standardDateValue = convertDateToStandard(rawDateValue);

    // ** VALIDATION ET CONVERSION DE DATE **
    if (!standardDateValue) {
        alert("Format de date invalide. Veuillez utiliser JJ/MM/AAAA (Ex: 09/12/2025).");
        return; 
    }
    // ** FIN DE LA VALIDATION **

    const type = document.querySelector('input[name="type"]:checked').value;
    
    const transaction = {
        date: standardDateValue, // Date au format AAAA-MM-JJ pour la BDD et le tri
        description: document.getElementById('description').value,
        type: type, 
        montant: parseFloat(document.getElementById('montant').value),
        categorie: document.getElementById('categorie').value,
        recurrent: document.getElementById('recurrent').checked,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await getUserTransactionsRef().add(transaction);
        transactionForm.reset();
        document.getElementById('type-depense').checked = true;
    } catch (error) {
        console.error("Erreur lors de l'ajout : ", error);
        alert("Erreur lors de l'ajout de la transaction.");
    }
});

// Écouter les changements en temps réel
function listenForTransactions() {
    if (!currentUser) return;

    const [year, month] = monthFilter.value.split('-').map(Number);
    
    // Pour Firestore, on filtre sur la date au format AAAA-MM-JJ
    const startDateString = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const endDateString = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    getUserTransactionsRef()
        .where('date', '>=', startDateString) 
        .where('date', '<=', endDateString) 
        .orderBy('date', 'desc')
        .onSnapshot(snapshot => {
            const transactions = [];
            snapshot.forEach(doc => {
                transactions.push({ id: doc.id, ...doc.data() }); 
            });
            
            displayTransactions(transactions);
            calculateSummary(transactions);

        }, error => {
            console.error("Erreur de snapshot : ", error);
        });
}

/**
 * Convertit le format AAAA-MM-JJ (BDD) en JJ/MM/AAAA (Affichage UX)
 * @param {string} standardDate 
 * @returns {string}
 */
function displayDateFormat(standardDate) {
    if (!standardDate || standardDate.length !== 10) return standardDate;
    const parts = standardDate.split('-'); // [AAAA, MM, JJ]
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // JJ/MM/AAAA
}


// Afficher les transactions dans le tableau (UX)
function displayTransactions(transactions) {
    transactionsTbody.innerHTML = ''; 
    
    transactions.forEach(t => {
        const row = transactionsTbody.insertRow();
        const montant = t.montant;
        const montantDisplay = (t.type === 'depense' ? '-' : '') + montant.toFixed(2) + ' €';
        const montantClass = t.type === 'depense' ? 'expense-text' : 'revenue-text';
        
        // Affichage de la date au format convivial JJ/MM/AAAA
        row.insertCell().textContent = displayDateFormat(t.date); 
        
        row.insertCell().textContent = t.description;
        row.insertCell().textContent = t.categorie;
        row.insertCell().innerHTML = t.type === 'revenu' ? '<i class="fas fa-arrow-up revenue-text"></i>' : '<i class="fas fa-arrow-down expense-text"></i>';

        const montantCell = row.insertCell();
        montantCell.className = 'right-align';
        montantCell.innerHTML = `<span class="${montantClass}">${montantDisplay}</span>`;

        const actionCell = row.insertCell();
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>'; // Icône poubelle pour l'UX
        deleteButton.className = 'delete-button';
        deleteButton.title = 'Supprimer la transaction';
        deleteButton.onclick = () => deleteTransaction(t.id);
        actionCell.appendChild(deleteButton);
    });
}

// Calculer le résumé
function calculateSummary(transactions) {
    let totalRevenu = 0;
    let totalDepense = 0;

    transactions.forEach(t => {
        if (t.type === 'revenu') {
            totalRevenu += t.montant;
        } else if (t.type === 'depense') {
            totalDepense += t.montant;
        }
    });

    updateSummary(totalRevenu, totalDepense);
}

// Mettre à jour l'UX du résumé
function updateSummary(totalRevenu, totalDepense) {
    const soldeNet = totalRevenu - totalDepense;

    totalRevenuEl.textContent = totalRevenu.toFixed(2) + ' €';
    totalDepenseEl.textContent = totalDepense.toFixed(2) + ' €';
    soldeNetEl.textContent = soldeNet.toFixed(2) + ' €';
    
    // Mettre à jour la couleur du solde net (UX)
    soldeNetEl.classList.remove('revenue-text', 'expense-text');
    if (soldeNet > 0) {
        soldeNetEl.classList.add('revenue-text');
    } else if (soldeNet < 0) {
        soldeNetEl.classList.add('expense-text');
    }
}

// Supprimer une transaction
async function deleteTransaction(id) {
    if (confirm("Confirmez-vous la suppression de cette transaction ?")) {
        try {
            await getUserTransactionsRef().doc(id).delete();
        } catch (error) {
            console.error("Erreur lors de la suppression : ", error);
            alert("Erreur lors de la suppression de la transaction.");
        }
    }
}