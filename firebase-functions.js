// ===== FIREBASE FUNCTIONS FOR PSA CALCULATOR =====

// ===== VISITOR COUNTER =====
async function updateVisitorCount() {
    try {
        // Check if user is a bot
        const userAgent = navigator.userAgent.toLowerCase();
        const botPatterns = ['bot', 'crawler', 'spider', 'crawling', 'bot/'];
        const isBot = botPatterns.some(pattern => userAgent.includes(pattern));
        
        if (isBot) return; // Don't count bots

        // Update global visitor counter
        const docRef = db.collection(COLLECTIONS.visitors).doc(DOCUMENTS.visitorCount);
        
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            
            if (doc.exists) {
                const currentCount = doc.data().count || 0;
                transaction.update(docRef, { 
                    count: currentCount + 1,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // First visitor ever
                transaction.set(docRef, { 
                    count: 1,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        });

        // Update localStorage for fallback
        localStorage.setItem('cs2_psa_visits_firebase', 'true');
        
        // Refresh UI
        await getGlobalStats();
        
    } catch (error) {
        console.log('Firebase error, using localStorage:', error);
        // Fallback to localStorage
        let visits = parseInt(localStorage.getItem('cs2_psa_visits') || '0');
        visits++;
        localStorage.setItem('cs2_psa_visits', visits.toString());
    }
}

// ===== CALCULATION COUNTER =====
async function incrementCalculationCount() {
    try {
        const docRef = db.collection(COLLECTIONS.calculations).doc(DOCUMENTS.calculationCount);
        
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            
            if (doc.exists) {
                const currentCount = doc.data().count || 0;
                transaction.update(docRef, { 
                    count: currentCount + 1,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                transaction.set(docRef, { 
                    count: 1,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        });

        await getGlobalStats();
        
    } catch (error) {
        console.log('Firebase calculation error:', error);
        // Fallback to localStorage
        let calculations = parseInt(localStorage.getItem('cs2_psa_calculations') || '0');
        calculations++;
        localStorage.setItem('cs2_psa_calculations', calculations.toString());
    }
}

// ===== GET GLOBAL STATISTICS =====
async function getGlobalStats() {
    try {
        // Get visitor count
        const visitorDoc = await db.collection(COLLECTIONS.visitors).doc(DOCUMENTS.visitorCount).get();
        const visitorCount = visitorDoc.exists ? (visitorDoc.data().count || 0) : 0;
        
        // Get calculation count
        const calcDoc = await db.collection(COLLECTIONS.calculations).doc(DOCUMENTS.calculationCount).get();
        const calculationCount = calcDoc.exists ? (calcDoc.data().count || 0) : 0;
        
        // Get comment count
        const commentsQuery = await db.collection(COLLECTIONS.comments)
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();
        
        const commentCount = commentsQuery.empty ? 0 : 
            (await db.collection(COLLECTIONS.comments).get()).size;

        // Update UI
        updateStatsDisplay(visitorCount, calculationCount, commentCount);
        
        return { visitorCount, calculationCount, commentCount };
        
    } catch (error) {
        console.log('Firebase stats error:', error);
        // Fallback to localStorage
        const visits = parseInt(localStorage.getItem('cs2_psa_visits') || '0');
        const calculations = parseInt(localStorage.getItem('cs2_psa_calculations') || '0');
        const comments = parseInt(localStorage.getItem('cs2_psa_comments_count') || '0');
        
        updateStatsDisplay(visits, calculations, comments);
        return { visitorCount: visits, calculationCount: calculations, commentCount: comments };
    }
}

// ===== COMMENTS SYSTEM =====
async function addComment(name, comment) {
    try {
        // Sanitize inputs
        const cleanName = name.trim().substring(0, 50);
        const cleanComment = comment.trim().substring(0, 500);
        
        if (!cleanName || !cleanComment) {
            throw new Error('Nombre y comentario son requeridos');
        }
        
        // Check if comment already exists (prevent spam)
        const existingComments = await db.collection(COLLECTIONS.comments)
            .where('name', '==', cleanName)
            .where('comment', '==', cleanComment)
            .limit(1)
            .get();
            
        if (!existingComments.empty) {
            throw new Error('Este comentario ya existe');
        }
        
        // Add new comment
        const docRef = await db.collection(COLLECTIONS.comments).add({
            name: cleanName,
            comment: cleanComment,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            ip: 'client-side' // For privacy, we can't get real IP on frontend
        });
        
        // Update localStorage for fallback
        let localComments = JSON.parse(localStorage.getItem('cs2_psa_comments') || '[]');
        localComments.unshift({
            id: docRef.id,
            name: cleanName,
            comment: cleanComment,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 100 comments in localStorage
        localComments = localComments.slice(0, 100);
        localStorage.setItem('cs2_psa_comments', JSON.stringify(localComments));
        localStorage.setItem('cs2_psa_comments_count', localComments.length.toString());
        
        // Refresh comments display
        await loadComments();
        
        return { success: true };
        
    } catch (error) {
        console.log('Firebase comment error:', error);
        // Fallback to localStorage
        let localComments = JSON.parse(localStorage.getItem('cs2_psa_comments') || '[]');
        localComments.unshift({
            id: 'local_' + Date.now(),
            name: name.trim().substring(0, 50),
            comment: comment.trim().substring(0, 500),
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 100 comments
        localComments = localComments.slice(0, 100);
        localStorage.setItem('cs2_psa_comments', JSON.stringify(localComments));
        localStorage.setItem('cs2_psa_comments_count', localComments.length.toString());
        
        await loadComments();
        return { success: true };
    }
}

async function loadComments() {
    try {
        // Get comments from Firebase
        const commentsQuery = await db.collection(COLLECTIONS.comments)
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();
            
        let comments = [];
        commentsQuery.forEach((doc) => {
            const data = doc.data();
            comments.push({
                id: doc.id,
                name: data.name || 'Anónimo',
                comment: data.comment || '',
                timestamp: data.timestamp ? data.timestamp.toDate() : new Date()
            });
        });
        
        // If no Firebase comments, try localStorage fallback
        if (comments.length === 0) {
            const localComments = JSON.parse(localStorage.getItem('cs2_psa_comments') || '[]');
            comments = localComments.map(c => ({
                ...c,
                timestamp: new Date(c.timestamp)
            }));
        }
        
        // Display comments
        displayComments(comments);
        
    } catch (error) {
        console.log('Firebase load comments error:', error);
        // Fallback to localStorage
        const localComments = JSON.parse(localStorage.getItem('cs2_psa_comments') || '[]');
        const comments = localComments.map(c => ({
            ...c,
            timestamp: new Date(c.timestamp)
        }));
        displayComments(comments);
    }
}

// ===== UTILITY FUNCTIONS =====
function updateStatsDisplay(visits, calculations, comments) {
    const visitsElement = document.getElementById('visitor-count');
    const calculationsElement = document.getElementById('calculation-count');
    const commentsElement = document.getElementById('comment-count');
    
    if (visitsElement) visitsElement.textContent = visits.toLocaleString();
    if (calculationsElement) calculationsElement.textContent = calculations.toLocaleString();
    if (commentsElement) commentsElement.textContent = comments.toLocaleString();
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
        
        const time = comment.timestamp instanceof Date ? 
            comment.timestamp.toLocaleDateString() : 
            new Date(comment.timestamp).toLocaleDateString();
        
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