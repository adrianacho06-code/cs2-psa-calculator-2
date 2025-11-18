// ===== PSA Calculator Logic =====
let psaState = {
    currentIteration: 0,
    baseSensitivity: 0,
    currentSensitivity: 0,
    dpi: 0,
    history: []
};

// Precisión mejorada: Factor de refinamiento más preciso
const REFINEMENT_FACTOR = 0.12; // 12% de variación por iteración

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        // Initialize Firebase
        await loadFirebaseScript();
        
        // Initialize stats and load data
        await initializeStats();
        await loadProPlayers();
        await loadComments();
        await updateVisitorCount();
        
        console.log('✅ Aplicación inicializada correctamente');
    } catch (error) {
        console.log('⚠️ Error inicializando aplicación:', error);
        // Fallback: initialize basic functionality
        await loadProPlayers();
        await loadComments();
    }
}

// Load Firebase SDK if not already loaded
function loadFirebaseScript() {
    return new Promise((resolve, reject) => {
        if (typeof firebase !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
        script.onload = () => {
            const compatScript = document.createElement('script');
            compatScript.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js';
            compatScript.onload = resolve;
            compatScript.onerror = reject;
            document.head.appendChild(compatScript);
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ===== PSA Calculator Functions =====
function startPSA() {
    const baseSens = parseFloat(document.getElementById('baseSensitivity').value);
    const dpi = parseInt(document.getElementById('mouseDPI').value);
    
    if (!baseSens || !dpi || baseSens <= 0 || dpi <= 0) {
        showToast('⚠️ Por favor ingresa valores válidos para la sensibilidad y DPI');
        return;
    }
    
    if (baseSens < 0.1 || baseSens > 10) {
        showToast('⚠️ La sensibilidad debe estar entre 0.1 y 10');
        return;
    }
    
    if (dpi < 100 || dpi > 16000) {
        showToast('⚠️ El DPI debe estar entre 100 y 16000');
        return;
    }
    
    // Inicializar estado
    psaState.baseSensitivity = baseSens;
    psaState.currentSensitivity = baseSens;
    psaState.dpi = dpi;
    psaState.currentIteration = 1;
    psaState.history = [baseSens];
    
    // Mostrar primera iteración
    showIteration();
    updateProgress();
    
    showToast('✓ Calculadora PSA iniciada. Comienza la iteración 1');
}

function showIteration() {
    // Ocultar paso inicial
    document.getElementById('step0').classList.remove('active');
    
    // Mostrar paso de iteración
    const iterationStep = document.getElementById('stepIteration');
    iterationStep.style.display = 'block';
    setTimeout(() => iterationStep.classList.add('active'), 50);
    
    // Actualizar título y badge
    document.getElementById('iterationTitle').textContent = `Iteración ${psaState.currentIteration}`;
    document.getElementById('currentIteration').textContent = psaState.currentIteration;
    
    // Calcular sensibilidades con factor de refinamiento decreciente
    const iterationFactor = REFINEMENT_FACTOR * (1 - (psaState.currentIteration - 1) / 10);
    const variation = psaState.currentSensitivity * iterationFactor;
    
    const lowerSens = parseFloat((psaState.currentSensitivity - variation).toFixed(3));
    const baseSens = parseFloat(psaState.currentSensitivity.toFixed(3));
    const higherSens = parseFloat((psaState.currentSensitivity + variation).toFixed(3));
    
    // Actualizar UI con valores
    document.getElementById('lowerSens').textContent = lowerSens.toFixed(3);
    document.getElementById('baseSens').textContent = baseSens.toFixed(3);
    document.getElementById('higherSens').textContent = higherSens.toFixed(3));
    
    // Mostrar valores sugeridos y eDPI
    const edpi = Math.round(dpi * baseSens);
    const cmPer360 = calculateCmPer360(dpi, baseSens);
    
    document.getElementById('baseEdpi').textContent = edpi;
    document.getElementById('baseCmPer360').textContent = cmPer360.toFixed(2);
}

function calculateEdpi(dpi, sensitivity) {
    return Math.round(dpi * sensitivity);
}

function calculateCmPer360(dpi, sensitivity) {
    const cmPer360 = (2.54 * 360) / (sensitivity * dpi * 0.022);
    return cmPer360;
}

function updateProgress() {
    const progress = (psaState.currentIteration - 1) * (100 / 7);
    document.getElementById('progress-bar').style.width = progress + '%';
    document.getElementById('progress-text').textContent = `${psaState.currentIteration - 1} de 7 completadas`;
}

function recordResult(result) {
    psaState.history.push(psaState.currentSensitivity);
    const edpi = calculateEdpi(psaState.dpi, psaState.currentSensitivity);
    
    // Crear elemento de historial
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.innerHTML = `
        <span class="iteration">Iteración ${psaState.currentIteration}</span>
        <span class="result">Sensibilidad: ${psaState.currentSensitivity.toFixed(3)}</span>
        <span class="edpi">eDPI: ${edpi}</span>
    `;
    
    document.getElementById('history-list').appendChild(historyItem);
}

function testSensitivity(sensitivity) {
    psaState.currentSensitivity = sensitivity;
    recordResult(sensitivity);
    
    // Mostrar feedback visual
    showToast(`✓ Probando sensibilidad: ${sensitivity.toFixed(3)}`);
}

function performIteration(result) {
    // Registrar resultado actual
    recordResult(psaState.currentSensitivity);
    
    // Si es la última iteración, mostrar resultados
    if (psaState.currentIteration >= 7) {
        showFinalResults();
        return;
    }
    
    // Calcular nueva sensibilidad para próxima iteración
    if (result === 'lower') {
        psaState.currentSensitivity = psaState.currentSensitivity - 
            (psaState.currentSensitivity * REFINEMENT_FACTOR * (1 - (psaState.currentIteration - 1) / 10));
    } else if (result === 'higher') {
        psaState.currentSensitivity = psaState.currentSensitivity + 
            (psaState.currentSensitivity * REFINEMENT_FACTOR * (1 - (psaState.currentIteration - 1) / 10));
    } // Si es 'base', mantener sensibilidad actual
    
    // Redondear a 3 decimales
    psaState.currentSensitivity = parseFloat(psaState.currentSensitivity.toFixed(3));
    
    // Aumentar iteración y mostrar siguiente
    psaState.currentIteration++;
    
    if (psaState.currentIteration <= 7) {
        setTimeout(() => {
            showIteration();
            updateProgress();
        }, 1500);
    } else {
        setTimeout(() => {
            showFinalResults();
        }, 1500);
    }
}

function showFinalResults() {
    // Ocultar paso de iteración
    document.getElementById('stepIteration').classList.remove('active');
    
    // Mostrar resultados finales
    const finalStep = document.getElementById('stepResult');
    finalStep.style.display = 'block';
    setTimeout(() => finalStep.classList.add('active'), 50);
    
    // Calcular sensibilidad final
    const finalSensitivity = psaState.currentSensitivity;
    const finalEdpi = calculateEdpi(psaState.dpi, finalSensitivity);
    const finalCmPer360 = calculateCmPer360(psaState.dpi, finalSensitivity);
    
    // Actualizar UI con resultados finales
    document.getElementById('finalSensitivity').textContent = finalSensitivity.toFixed(3);
    document.getElementById('finalEdpi').textContent = finalEdpi;
    document.getElementById('finalCmPer360').textContent = finalCmPer360.toFixed(2);
    document.getElementById('finalDpi').textContent = psaState.dpi;
    
    // Agregar botón para ajustar sensibilidad en juego
    document.getElementById('gameInstructions').innerHTML = `
        <p><strong>Para aplicar esta configuración en CS2:</strong></p>
        <ol>
            <li>Abre CS2 y ve a Configuración → Teclado y Mouse</li>
            <li>Cambia la sensibilidad a: <strong>${finalSensitivity.toFixed(3)}</strong></li>
            <li>Mantén tu DPI en: <strong>${psaState.dpi}</strong></li>
            <li>Confirma que tu eDPI es: <strong>${finalEdpi}</strong></li>
        </ol>
    `;
    
    // Incrementar contador de cálculos completados
    incrementCalculationCount();
    
    showToast('🎉 ¡Cálculo PSA completado!');
}

function resetPSA() {
    // Reiniciar estado
    psaState = {
        currentIteration: 0,
        baseSensitivity: 0,
        currentSensitivity: 0,
        dpi: 0,
        history: []
    };
    
    // Limpiar UI
    document.getElementById('stepIteration').classList.remove('active');
    document.getElementById('stepResult').classList.remove('active');
    document.getElementById('step0').classList.add('active');
    document.getElementById('stepIteration').style.display = 'none';
    document.getElementById('stepResult').style.display = 'none';
    document.getElementById('history-list').innerHTML = '';
    document.getElementById('progress-bar').style.width = '0%';
    document.getElementById('progress-text').textContent = '0 de 7 completadas';
    
    // Limpiar campos de entrada
    document.getElementById('baseSensitivity').value = '';
    document.getElementById('mouseDPI').value = '';
    
    showToast('✓ Calculadora reiniciada');
}

// ===== Statistics and Data Management =====
async function initializeStats() {
    try {
        // Initialize Firebase and load global stats
        await loadFirebaseScript();
        await getGlobalStats();
    } catch (error) {
        console.log('⚠️ Firebase no disponible, usando localStorage');
        // Fallback to localStorage
        const visits = parseInt(localStorage.getItem('cs2_psa_visits') || '0');
        const calculations = parseInt(localStorage.getItem('cs2_psa_calculations') || '0');
        const comments = parseInt(localStorage.getItem('cs2_psa_comments_count') || '0');
        updateStatsDisplay(visits, calculations, comments);
    }
}

function formatNumber(num) {
    return new Intl.NumberFormat('es-ES').format(num);
}

function updateStatsDisplay(visits, calculations, comments) {
    const visitsElement = document.getElementById('visitor-count');
    const calculationsElement = document.getElementById('calculation-count');
    const commentsElement = document.getElementById('comment-count');
    
    if (visitsElement) visitsElement.textContent = formatNumber(visits);
    if (calculationsElement) calculationsElement.textContent = formatNumber(calculations);
    if (commentsElement) commentsElement.textContent = formatNumber(comments);
}

// ===== Professional Players Data =====
function loadProPlayers() {
    const container = document.getElementById('pro-players');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Group players by team
    const teams = {};
    proPlayers.forEach(player => {
        if (!teams[player.team]) {
            teams[player.team] = [];
        }
        teams[player.team].push(player);
    });
    
    // Create team sections
    Object.keys(teams).sort().forEach(teamName => {
        const teamSection = document.createElement('div');
        teamSection.className = 'team-section';
        
        const teamTitle = document.createElement('h3');
        teamTitle.textContent = teamName;
        teamSection.appendChild(teamTitle);
        
        const teamGrid = document.createElement('div');
        teamGrid.className = 'pro-grid';
        
        teams[teamName].forEach(player => {
            const playerCard = createPlayerCard(player);
            teamGrid.appendChild(playerCard);
        });
        
        teamSection.appendChild(teamGrid);
        container.appendChild(teamSection);
    });
}

function createPlayerCard(player) {
    const card = document.createElement('div');
    card.className = 'pro-card';
    
    card.innerHTML = `
        <div class="pro-header">
            <h4>${player.name}</h4>
            <span class="pro-team">${player.team}</span>
        </div>
        <div class="pro-settings">
            <div class="setting-item">
                <span class="setting-label">DPI:</span>
                <span class="setting-value">${player.dpi}</span>
            </div>
            <div class="setting-item">
                <span class="setting-label">Sensibilidad:</span>
                <span class="setting-value">${player.sensitivity}</span>
            </div>
            <div class="setting-item">
                <span class="setting-label">eDPI:</span>
                <span class="setting-value">${player.edpi}</span>
            </div>
            <div class="setting-item">
                <span class="setting-label">Resolución:</span>
                <span class="setting-value">${player.resolution}</span>
            </div>
        </div>
        <div class="pro-actions">
            <button class="btn btn-pro" onclick="applyPlayerSettings(${JSON.stringify(player)})">
                Aplicar Configuración
            </button>
        </div>
    `;
    
    return card;
}

function applyPlayerSettings(player) {
    document.getElementById('baseSensitivity').value = player.sensitivity;
    document.getElementById('mouseDPI').value = player.dpi;
    
    // Update calculated eDPI display
    const edpi = player.dpi * player.sensitivity;
    const cmPer360 = calculateCmPer360(player.dpi, player.sensitivity);
    
    showToast(`✓ Configuración de ${player.name} cargada (eDPI: ${edpi})`);
    
    // Show quick comparison
    if (psaState.dpi > 0) {
        const currentEdpi = psaState.dpi * psaState.currentSensitivity;
        showToast(`Tu eDPI actual: ${currentEdpi} vs ${player.name}: ${edpi}`);
    }
}

// ===== Comments System =====
function loadComments() {
    // Use Firebase function if available
    if (typeof loadCommentsFirebase === 'function') {
        loadCommentsFirebase();
    } else {
        // Fallback to localStorage
        const localComments = JSON.parse(localStorage.getItem('cs2_psa_comments') || '[]');
        displayComments(localComments);
    }
}

async function submitComment(event) {
    event.preventDefault();
    
    const nameInput = document.getElementById('comment-name');
    const commentInput = document.getElementById('comment-text');
    
    const name = nameInput.value.trim();
    const comment = commentInput.value.trim();
    
    if (!name || !comment) {
        showToast('⚠️ Por favor ingresa tu nombre y comentario');
        return;
    }
    
    if (name.length > 50) {
        showToast('⚠️ El nombre debe tener máximo 50 caracteres');
        return;
    }
    
    if (comment.length > 500) {
        showToast('⚠️ El comentario debe tener máximo 500 caracteres');
        return;
    }
    
    try {
        // Use Firebase function if available
        if (typeof addCommentFirebase === 'function') {
            await addCommentFirebase(name, comment);
        } else {
            // Fallback to localStorage
            let localComments = JSON.parse(localStorage.getItem('cs2_psa_comments') || '[]');
            localComments.unshift({
                id: Date.now(),
                name: name,
                comment: comment,
                timestamp: new Date().toISOString()
            });
            
            // Keep only last 100 comments
            localComments = localComments.slice(0, 100);
            localStorage.setItem('cs2_psa_comments', JSON.stringify(localComments));
            localStorage.setItem('cs2_psa_comments_count', localComments.length.toString());
            
            displayComments(localComments);
        }
        
        // Clear form
        nameInput.value = '';
        commentInput.value = '';
        
        showToast('✓ Comentario agregado correctamente');
        
    } catch (error) {
        showToast('⚠️ Error agregando comentario');
        console.error('Comment error:', error);
    }
}

function displayComments(comments) {
    const container = document.getElementById('comments-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (comments.length === 0) {
        container.innerHTML = '<p class="no-comments">No hay comentarios aún. ¡Sé el primero en comentar!</p>';
        return;
    }
    
    comments.forEach(comment => {
        const commentElement = document.createElement('div');
        commentElement.className = 'comment';
        
        const time = comment.timestamp ? new Date(comment.timestamp).toLocaleDateString() : 'Reciente';
        
        commentElement.innerHTML = `
            <div class="comment-header">
                <strong>${escapeHtml(comment.name)}</strong>
                <span class="comment-time">${time}</span>
            </div>
            <div class="comment-content">${escapeHtml(comment.comment)}</div>
        `;
        
        container.appendChild(commentElement);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== UI Utility Functions =====
function showToast(message) {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create new toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Hide toast after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== Event Listeners =====
document.addEventListener('DOMContentLoaded', function() {
    // Calculator form
    const form = document.getElementById('psa-form');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            startPSA();
        });
    }
    
    // Iteration buttons
    const testButtons = document.querySelectorAll('.test-btn');
    testButtons.forEach(button => {
        button.addEventListener('click', function() {
            const sensitivity = parseFloat(this.getAttribute('data-sensitivity'));
            testSensitivity(sensitivity);
            
            // Auto-advance after 2 seconds
            setTimeout(() => {
                const result = this.getAttribute('data-result');
                performIteration(result);
            }, 2000);
        });
    });
    
    // Reset button
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetPSA);
    }
    
    // Comments form
    const commentForm = document.getElementById('comment-form');
    if (commentForm) {
        commentForm.addEventListener('submit', submitComment);
    }
    
    // Auto-save form data
    const baseSensInput = document.getElementById('baseSensitivity');
    const dpiInput = document.getElementById('mouseDPI');
    
    if (baseSensInput && dpiInput) {
        baseSensInput.addEventListener('input', saveFormData);
        dpiInput.addEventListener('input', saveFormData);
        
        // Load saved data
        loadFormData();
    }
});

function saveFormData() {
    const baseSens = document.getElementById('baseSensitivity').value;
    const dpi = document.getElementById('mouseDPI').value;
    
    if (baseSens && dpi) {
        localStorage.setItem('cs2_psa_form_data', JSON.stringify({
            baseSens: baseSens,
            dpi: dpi
        }));
    }
}

function loadFormData() {
    const saved = localStorage.getItem('cs2_psa_form_data');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.baseSens) document.getElementById('baseSensitivity').value = data.baseSens;
            if (data.dpi) document.getElementById('mouseDPI').value = data.dpi;
        } catch (error) {
            console.log('Error loading saved form data');
        }
    }
}