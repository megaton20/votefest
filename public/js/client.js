// Socket.IO connection
const socket = io();

// Check authentication
const userId = document.querySelector('meta[name="user-id"]')?.content;
const isAuthenticated = !!userId;

if (isAuthenticated) {
    socket.emit('authenticate', userId);
}

// Store vote counts for each contestant
let voteCounts = {};

// Initialize vote counts
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[id^="selected-votes-"]').forEach(el => {
        const contestantId = el.id.replace('selected-votes-', '');
        voteCounts[contestantId] = 1;
    });
    
    // Initial balance check
    if (isAuthenticated) {
        checkWalletBalance();
    }
});

// Real-time vote updates from server
socket.on('vote_update', (data) => {
    console.log('📊 Vote update received:', data);
    const { contestantId, newVotes } = data;
    
    // Update ALL vote count elements for this contestant
    // This includes both the main vote count and any other displays
    const voteElements = document.querySelectorAll(`.vote-count-${contestantId}`);
    voteElements.forEach(el => {
        el.textContent = newVotes.toLocaleString();
    });
    
    // Also update any other places that might show vote counts
    const voteDisplayElements = document.querySelectorAll(`[data-vote-count="${contestantId}"]`);
    voteDisplayElements.forEach(el => {
        el.textContent = newVotes.toLocaleString();
    });
});

// Wallet updates
socket.on('wallet_update', (data) => {
    if (!isAuthenticated) return;
    const coinBalance = document.getElementById('coin-balance');
    if (coinBalance && data.newBalance !== undefined) {
        coinBalance.textContent = data.newBalance;
    }
    
    // Recheck button states when wallet updates
    checkWalletBalance();
});

// Adjust vote count with plus/minus
function adjustVote(contestantId, direction) {
    let currentCount = voteCounts[contestantId] || 1;
    
    if (direction === -1 && currentCount > 1) {
        currentCount--;
    } else if (direction === 1) {
        currentCount++;
    }
    
    voteCounts[contestantId] = currentCount;
    
    // Update main displays
    const voteDisplay = document.getElementById(`selected-votes-${contestantId}`);
    if (voteDisplay) voteDisplay.textContent = currentCount;
    
    const coinDisplay = document.getElementById(`coin-required-${contestantId}`);
    if (coinDisplay) coinDisplay.textContent = currentCount * 10;
    
    // Update all "selected votes" displays for this contestant
    document.querySelectorAll(`.selected-votes-display[data-contestant="${contestantId}"]`).forEach(el => {
        el.textContent = currentCount;
    });
    
    document.querySelectorAll(`.selected-coins-display[data-contestant="${contestantId}"]`).forEach(el => {
        el.textContent = currentCount * 10;
    });
}

// Cast vote with specific count
async function castVote(contestantId, count) {
    if (!isAuthenticated) {
        alert('Please login to vote');
        window.location.href = '/auth/login';
        return;
    }
    
    const coinBalance = document.getElementById('coin-balance');
    const currentBalance = coinBalance ? parseInt(coinBalance.textContent) : 0;
    const coinsRequired = count * 10;
    
    if (currentBalance < coinsRequired) {
        showNotification(`❌ Need ${coinsRequired} coins. You have ${currentBalance}.`, 'error');
        return;
    }
    
    // Find the contestant card for spinner
    const contestantCard = document.querySelector(`.contestant-card[data-contestant-id="${contestantId}"]`);
    
    showSpinner(contestantCard);
    disableVoteButtons(true);
    
    try {
        const response = await fetch('/vote/cast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contestantId, voteCount: count })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (coinBalance && data.newBalance) {
                coinBalance.textContent = data.newBalance;
            }
            
            // Reset counter for this contestant
            voteCounts[contestantId] = 1;
            const voteDisplay = document.getElementById(`selected-votes-${contestantId}`);
            if (voteDisplay) voteDisplay.textContent = '1';
            
            const coinDisplay = document.getElementById(`coin-required-${contestantId}`);
            if (coinDisplay) coinDisplay.textContent = '10';
            
            // Update selected displays
            document.querySelectorAll(`.selected-votes-display[data-contestant="${contestantId}"]`).forEach(el => {
                el.textContent = '1';
            });
            
            document.querySelectorAll(`.selected-coins-display[data-contestant="${contestantId}"]`).forEach(el => {
                el.textContent = '10';
            });
            
            showNotification(`✓ Voted ${count} time(s)!`, 'success');
        } else {
            if (data.error) {
                showNotification(`❌ ${data.error}`, 'error');
                if (data.balance !== undefined && coinBalance) {
                    coinBalance.textContent = data.balance;
                }
            }
        }
    } catch (err) {
        console.error('Vote error:', err);
        showNotification('Failed to cast vote', 'error');
    } finally {
        hideSpinner(contestantCard);
        disableVoteButtons(false);
    }
}

// Cast vote with current selected count
function castVoteWithCurrent(contestantId) {
    const count = voteCounts[contestantId] || 1;
    castVote(contestantId, count);
}

// Spinner functions
function showSpinner(container) {
    if (!container) return;
    
    if (getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'vote-spinner-overlay absolute inset-0 bg-white/80 flex items-center justify-center z-20 rounded-lg';
    overlay.innerHTML = `
        <div class="text-center">
            <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-purple-600 border-t-transparent"></div>
            <p class="text-sm text-gray-600 mt-2">Processing...</p>
        </div>
    `;
    
    container.appendChild(overlay);
}

function hideSpinner(container) {
    if (!container) return;
    const overlay = container.querySelector('.vote-spinner-overlay');
    if (overlay) overlay.remove();
}

function disableVoteButtons(disabled = true) {
    const buttons = document.querySelectorAll('.vote-btn');
    buttons.forEach(btn => {
        btn.disabled = disabled;
        btn.classList.toggle('opacity-50', disabled);
        btn.classList.toggle('cursor-not-allowed', disabled);
    });
}

// Check wallet balance
async function checkWalletBalance() {
    if (!isAuthenticated) return;
    
    try {
        const response = await fetch('/wallet/balance');
        const data = await response.json();
        
        if (data.balance !== undefined) {
            const coinBalance = document.getElementById('coin-balance');
            if (coinBalance) coinBalance.textContent = data.balance;
        }
    } catch (err) {
        console.error('Balance check failed:', err);
    }
}

// Notification system
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.vote-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `vote-notification fixed top-20 right-4 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 z-50 animate-slide-up ${
        type === 'success' ? 'bg-green-100 border border-green-200 text-green-800' :
        type === 'error' ? 'bg-red-100 border border-red-200 text-red-800' :
        'bg-blue-100 border border-blue-200 text-blue-800'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Also listen for leaderboard updates which might contain vote changes
socket.on('leaderboard_update', (leaderboard) => {
    console.log('📊 Leaderboard update received');
    if (leaderboard && leaderboard.length) {
        leaderboard.forEach(contestant => {
            const voteElement = document.querySelector(`.vote-count-${contestant.id}`);
            if (voteElement) {
                voteElement.textContent = contestant.votes.toLocaleString();
            }
        });
    }
});

// Make functions global
window.adjustVote = adjustVote;
window.castVote = castVote;
window.castVoteWithCurrent = castVoteWithCurrent;
window.showNotification = showNotification;

// Add styles if not present
if (!document.getElementById('vote-styles')) {
    const style = document.createElement('style');
    style.id = 'vote-styles';
    style.textContent = `
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-slide-up { animation: slideUp 0.3s ease-out; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .vote-spinner-overlay { backdrop-filter: blur(2px); }
    `;
    document.head.appendChild(style);
}