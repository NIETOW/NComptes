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

// NOUVELLES RÉFÉRENCES DOM POUR LE FORMULAIRE PRINCIPAL
const dayInput = document.getElementById('day-input');
const typeDepenseRadio = document.getElementById('type-depense');
const typeRevenuRadio = document.getElementById('type-revenu');
const categorieSelect = document.getElementById('categorie');

// NOUVELLES RÉFÉRENCES DOM POUR LE RÉSUMÉ PAR CATÉGORIE
const revenueCategoryListEl = document.getElementById('revenue-category-list');
const expenseCategoryListEl = document.getElementById('expense-category-list');

// Modal d'authentification
const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const submitAuthBtn = document.getElementById('submit-auth-btn');
const toggleModeBtn = document.getElementById('toggle-mode-btn');
const closeButton = document.querySelector('#auth-modal .close-button'); // Sélecteur plus précis

// Modal d'édition
const editModal = document.getElementById('edit-modal');
const editTransactionForm = document.getElementById('edit-transaction-form');
const editTransactionIdInput = document.getElementById('edit-transaction-id');
const editDayInput = document.getElementById('edit-day-input');
const editMontantInput = document.getElementById('edit-montant');
const editDescriptionInput = document.getElementById('edit-description');
const editCategorieSelect = document.getElementById('edit-categorie');
const editRecurrentCheckbox = document.getElementById('edit-recurrent');
const editTypeDepenseRadio = document.getElementById('edit-type-depense');
const editTypeRevenuRadio = document.getElementById('edit-type-revenu');


let currentUser = null;
let isLoginMode = true; // État initial: Connexion


// NOUVEAU: Catégories séparées
const EXPENSE_CATEGORIES = [
    "Alimentation", "Logement", "Transport", "Loisirs", "Factures", "Santé", "Vêtements", "Autres Dépenses"
];
const REVENUE_CATEGORIES = [
    "Salaire", "Indemnités", "Cadeau", "Remboursement", "Investissement", "Autres Revenus"
];


// =================================================================
// 3. FONCTIONS UTILITAIRES POUR LA DATE & CATÉGORIES
// =================================================================

/**
 * Combine le jour (JJ) avec le mois/année (MM/AAAA) du filtre pour créer la date standard.
 * @param {string} dayString Jour au format JJ (Ex: "09")
 * @returns {string|null} Date au format AAAA-MM-JJ ou null si invalide
 */
function createStandardDate(dayString) {
    const monthFilterValue = monthFilter.value; // Format AAAA-MM
    const day = String(dayString).padStart(2, '0');

    if (!monthFilterValue || !day) return null;

    const date = new Date(`${monthFilterValue}-${day}`);
    
    // Vérifie si la date est valide et correspond au mois filtré
    if (isNaN(date.getTime())) return null;

    const [year, month] = monthFilterValue.split('-');
    
    // Assure que le jour est dans le bon mois/année (pour éviter les sauts de mois avec des jours invalides comme 31/02)
    if (date.getMonth() + 1 !== parseInt(month) || date.getFullYear() !== parseInt(year)) {
        return null;
    }

    return `${year}-${month}-${day}`; // Format AAAA-MM-JJ
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

/**
 * Extrait le jour (JJ) à partir du format AAAA-MM-JJ.
 * @param {string} standardDate 
 * @returns {number} Jour
 */
function getDayFromStandardDate(standardDate) {
    if (!standardDate || standardDate.length !== 10) return 1;
    return parseInt(standardDate.split('-')[2], 10);
}

/**
 * Remplit le sélecteur de catégorie en fonction du type de transaction.
 * @param {HTMLSelectElement} selectElement Le sélecteur à remplir.
 * @param {string} type 'revenu' ou 'depense'.
 * @param {string} selectedValue La valeur à présélectionner.
 */
function populateCategories(selectElement, type, selectedValue = '') {
    selectElement.innerHTML = '<option value="">-- Choisir une catégorie --</option>';
    const categories = type === 'revenu' ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;

    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        if (cat === selectedValue) {
            option.selected = true;
        }
        selectElement.appendChild(option);
    });
}

// Initialiser le sélecteur de catégorie au chargement et ajouter les écouteurs de changement de type
document.addEventListener('DOMContentLoaded', () => {
    // Initialisation pour le formulaire principal
    populateCategories(categorieSelect, 'depense');
    typeDepenseRadio.addEventListener('change', () => populateCategories(categorieSelect, 'depense'));
    typeRevenuRadio.addEventListener('change', () => populateCategories(categorieSelect, 'revenu'));

    // Écouteurs pour le modal d'édition
    editTypeDepenseRadio.addEventListener('change', () => {
        populateCategories(editCategorieSelect, 'depense');
    });
    editTypeRevenuRadio.addEventListener('change', () => {
        populateCategories(editCategorieSelect, 'revenu');
    });
});


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
    const input = document.getElementById('auth-password'); 
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.add('fa-eye');
        icon.classList.remove('fa-eye-slash');
    }
};

// Gestionnaire d'ouverture du modal
if (authButton) {
    authButton.addEventListener('click', () => {
        authModal.classList.remove('hidden');
    });
}

// Gestionnaires de fermeture du modal
if (closeButton) {
    closeButton.addEventListener('click', () => authModal.classList.add('hidden'));
}

window.addEventListener('click', (e) => {
    if (e.target === authModal) {
        authModal.classList.add('hidden');
    }
    // Fermeture du modal d'édition
    if (e.target === editModal) {
        editModal.classList.add('hidden');
    }
});

// Basculer entre Connexion et Inscription
if (toggleModeBtn) {
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
}

// Soumission du formulaire d'authentification
if (authForm) {
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
}

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
        
        // Le nouvel écouteur pour le bouton de connexion doit être réattaché
        const newAuthButton = document.getElementById('auth-button');
        if (newAuthButton) {
            newAuthButton.addEventListener('click', () => authModal.classList.remove('hidden'));
        }

        appContent.classList.add('hidden');
        transactionsTbody.innerHTML = '';
        updateSummary(0, 0);
        displayCategorySummary({}, {}); // Réinitialiser le résumé par catégorie
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
if (transactionForm) {
    transactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentUser) return;

        const dayValue = dayInput.value;
        const standardDateValue = createStandardDate(dayValue);

        if (!standardDateValue) {
            alert(`Jour '${dayValue}' invalide pour le mois sélectionné ou format incorrect.`);
            return; 
        }

        const type = document.querySelector('input[name="type"]:checked').value;
        
        const transaction = {
            date: standardDateValue, 
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
            dayInput.value = '';
            document.getElementById('type-depense').checked = true;
            populateCategories(categorieSelect, 'depense');
        } catch (error) {
            console.error("Erreur lors de l'ajout : ", error);
            alert("Erreur lors de l'ajout de la transaction.");
        }
    });
}


// Modifier une transaction (Ouverture du modal)
window.openEditModal = async function(id) {
    if (!currentUser) return;
    
    try {
        const doc = await getUserTransactionsRef().doc(id).get();
        if (!doc.exists) {
            alert("Transaction introuvable.");
            return;
        }
        const data = { id: doc.id, ...doc.data() };

        // Remplissage du modal
        editTransactionIdInput.value = data.id;
        editMontantInput.value = data.montant;
        editDescriptionInput.value = data.description;
        editDayInput.value = getDayFromStandardDate(data.date);
        editRecurrentCheckbox.checked = data.recurrent;

        // Type de transaction et Catégorie
        const isRevenu = data.type === 'revenu';
        if (isRevenu) {
            editTypeRevenuRadio.checked = true;
            editTypeDepenseRadio.checked = false;
        } else {
            editTypeDepenseRadio.checked = true;
            editTypeRevenuRadio.checked = false;
        }
        
        // Remplir dynamiquement les catégories, puis sélectionner la bonne
        populateCategories(editCategorieSelect, data.type, data.categorie);
        
        editModal.classList.remove('hidden');

    } catch (error) {
        console.error("Erreur lors de l'ouverture du modal d'édition : ", error);
        alert("Impossible de charger la transaction.");
    }
}

// Sauvegarder les modifications
if (editTransactionForm) {
    editTransactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;

        const id = editTransactionIdInput.value;
        const dayValue = editDayInput.value;
        const standardDateValue = createStandardDate(dayValue);

        if (!standardDateValue) {
            alert(`Jour '${dayValue}' invalide pour le mois sélectionné ou format incorrect.`);
            return; 
        }

        const type = document.querySelector('input[name="edit-type"]:checked').value;

        const updatedTransaction = {
            date: standardDateValue,
            description: editDescriptionInput.value,
            type: type, 
            montant: parseFloat(editMontantInput.value),
            categorie: editCategorieSelect.value,
            recurrent: editRecurrentCheckbox.checked,
        };

        try {
            await getUserTransactionsRef().doc(id).update(updatedTransaction);
            editModal.classList.add('hidden');
        } catch (error) {
            console.error("Erreur lors de la mise à jour : ", error);
            alert("Erreur lors de la mise à jour de la transaction.");
        }
    });
}


// Écouter les changements en temps réel
function listenForTransactions() {
    if (!currentUser) return;

    const [year, month] = monthFilter.value.split('-').map(Number);
    
    // Filtre de date pour Firestore
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
        
        row.insertCell().textContent = t.description + (t.recurrent ? ' (Rép.)' : '');
        row.insertCell().textContent = t.categorie;
        row.insertCell().innerHTML = t.type === 'revenu' ? '<i class="fas fa-arrow-up revenue-text"></i>' : '<i class="fas fa-arrow-down expense-text"></i>';

        const montantCell = row.insertCell();
        montantCell.className = 'right-align';
        montantCell.innerHTML = `<span class="${montantClass}">${montantDisplay}</span>`;

        const actionCell = row.insertCell();
        actionCell.className = 'action-buttons-wrapper';
        
        // Bouton Modifier
        const editButton = document.createElement('button');
        editButton.innerHTML = '<i class="fas fa-edit"></i>'; 
        editButton.className = 'edit-button';
        editButton.title = 'Modifier la transaction';
        editButton.onclick = () => openEditModal(t.id);
        actionCell.appendChild(editButton);

        // Bouton Supprimer
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>'; 
        deleteButton.className = 'delete-button';
        deleteButton.title = 'Supprimer la transaction';
        deleteButton.onclick = () => deleteTransaction(t.id);
        actionCell.appendChild(deleteButton);
    });
}

// Calculer le résumé global et par catégorie
function calculateSummary(transactions) {
    let totalRevenu = 0;
    let totalDepense = 0;
    const revenueCategories = {};
    const expenseCategories = {};

    transactions.forEach(t => {
        if (t.type === 'revenu') {
            totalRevenu += t.montant;
            revenueCategories[t.categorie] = (revenueCategories[t.categorie] || 0) + t.montant;
        } else if (t.type === 'depense') {
            totalDepense += t.montant;
            expenseCategories[t.categorie] = (expenseCategories[t.categorie] || 0) + t.montant;
        }
    });

    updateSummary(totalRevenu, totalDepense);
    displayCategorySummary(revenueCategories, expenseCategories);
}

// Mettre à jour l'UX du résumé global
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

/**
 * Affiche le résumé des totaux par catégorie.
 * @param {object} revenues Objet {categorie: total} pour les revenus.
 * @param {object} expenses Objet {categorie: total} pour les dépenses.
 */
function displayCategorySummary(revenues, expenses) {
    // Fonction utilitaire pour rendre la liste
    const renderList = (container, totals, type) => {
        container.innerHTML = '';
        // Trie par montant décroissant
        const sortedCategories = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
        
        if (sortedCategories.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: var(--color-subtext);">Pas de ${type} enregistré(e)s ce mois.</p>`;
            return;
        }

        sortedCategories.forEach(cat => {
            const total = totals[cat];
            const div = document.createElement('div');
            div.className = 'category-item';
            div.innerHTML = `
                <span>${cat}</span>
                <span class="amount ${type === 'revenu' ? 'revenue-text' : 'expense-text'}">${total.toFixed(2)} €</span>
            `;
            container.appendChild(div);
        });
    };

    renderList(revenueCategoryListEl, revenues, 'revenu');
    renderList(expenseCategoryListEl, expenses, 'depense');
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