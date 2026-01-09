// message-view.js - Message View Page Logic

// Get message ID from URL
function getMessageIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Fetch message data from API
async function fetchMessageData(messageId) {
    try {
        // For now, simulate API call with localStorage data
        // In production, replace with actual API call
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate loading
        
        // Check localStorage for saved messages
        const savedMessages = JSON.parse(localStorage.getItem('unsaid_messages') || '[]');
        const message = savedMessages.find(msg => msg.id === messageId);
        
        if (message) {
            return {
                success: true,
                data: message
            };
        }
        
        // If not found in localStorage, simulate fetching from server
        const sampleMessages = [
            {
                id: 'msg_001',
                category: 'confession',
                content: "I've never told anyone this, but I sometimes drive to empty parking lots just to cry where no one can see me. It's the only place where I feel safe enough to let everything out without judgment.",
                timestamp: '2 minutes ago',
                readCount: 12,
                status: 'unread',
                expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes from now
            },
            {
                id: 'msg_002',
                category: 'vent',
                content: "I'm so tired of pretending everything is okay when I'm drowning inside. The mask gets heavier every day, and I don't know how much longer I can keep wearing it.",
                timestamp: '5 minutes ago',
                readCount: 8,
                status: 'read',
                expiresAt: Date.now() + (3 * 60 * 1000) // 3 minutes from now
            },
            {
                id: 'msg_003',
                category: 'judge',
                content: "Is it wrong that I secretly enjoy when my coworker fails? They're always getting praised for doing the bare minimum while I carry the team silently in the background.",
                timestamp: '12 minutes ago',
                readCount: 15,
                status: 'unread',
                expiresAt: Date.now() + (2 * 60 * 1000) // 2 minutes from now
            },
            {
                id: 'msg_004',
                category: 'dare',
                content: "I dare someone to delete all their social media for a week and see how it feels to exist without validation from strangers. You might be surprised by what you discover about yourself.",
                timestamp: '18 minutes ago',
                readCount: 21,
                status: 'read',
                expiresAt: Date.now() + (1 * 60 * 1000) // 1 minute from now
            }
        ];
        
        const foundMessage = sampleMessages.find(msg => msg.id === messageId) || sampleMessages[0];
        
        return {
            success: true,
            data: foundMessage
        };
        
    } catch (error) {
        console.error('Error fetching message:', error);
        return {
            success: false,
            error: 'Failed to load message'
        };
    }
}

// Fetch related messages
async function fetchRelatedMessages(category, currentId) {
    try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const relatedMessages = [
            {
                id: 'msg_005',
                category: 'confession',
                content: "I pretend to be confident but I doubt every decision I make. The imposter syndrome is real.",
                timestamp: '25 minutes ago',
                readCount: 7
            },
            {
                id: 'msg_006',
                category: 'confession',
                content: "I've been stealing office supplies for years. Just small things - pens, sticky notes.",
                timestamp: '30 minutes ago',
                readCount: 9
            },
            {
                id: 'msg_007',
                category: category,
                content: "Sometimes I wonder if anyone would notice if I just disappeared for a while.",
                timestamp: '35 minutes ago',
                readCount: 11
            }
        ];
        
        return relatedMessages.filter(msg => msg.id !== currentId);
    } catch (error) {
        console.error('Error fetching related messages:', error);
        return [];
    }
}

// Update UI with message data
function updateMessageUI(message) {
    // Update category
    const categoryEl = document.getElementById('message-category');
    categoryEl.className = `message-category-large ${message.category}`;
    categoryEl.textContent = message.category.charAt(0).toUpperCase() + message.category.slice(1);
    
    // Update stats
    document.getElementById('read-count').textContent = `${message.readCount || 0} readers`;
    document.getElementById('timestamp').textContent = message.timestamp;
    document.getElementById('message-id').textContent = `#${message.id.toUpperCase()}`;
    
    // Update content
    document.getElementById('message-body').textContent = message.content;
    
    // Update page title
    document.title = `${message.category.charAt(0).toUpperCase() + message.category.slice(1)} | Unsaid`;
    
    // Setup vanishing timer if message hasn't expired
    if (message.expiresAt && message.expiresAt > Date.now()) {
        setupVanishingTimer(message.expiresAt);
    }
    
    // Mark message as read
    markMessageAsRead(message.id);
}

// Setup vanishing timer
function setupVanishingTimer(expiresAt) {
    const timerEl = document.getElementById('vanishing-timer');
    const timerText = document.getElementById('timer-text');
    
    timerEl.style.display = 'flex';
    
    function updateTimer() {
        const now = Date.now();
        const timeLeft = expiresAt - now;
        
        if (timeLeft <= 0) {
            timerText.textContent = 'Message has vanished';
            timerEl.style.background = 'var(--text-muted)';
            clearInterval(timerInterval);
            
            // Update message status after vanishing
            setTimeout(() => {
                showMessageVanished();
            }, 2000);
            
            return;
        }
        
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        
        timerText.textContent = `Vanishing in ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Change color when less than 1 minute
        if (timeLeft < 60000) {
            timerEl.style.background = 'linear-gradient(135deg, var(--accent-red) 0%, var(--accent-red-dark) 100%)';
        }
    }
    
    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
}

// Show related messages
async function showRelatedMessages(category, currentId) {
    const relatedContainer = document.getElementById('related-messages');
    const relatedMessages = await fetchRelatedMessages(category, currentId);
    
    if (relatedMessages.length === 0) {
        relatedContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No similar whispers found.</p>';
        return;
    }
    
    relatedContainer.innerHTML = relatedMessages.map(message => `
        <a href="message-view.html?id=${message.id}" class="related-item">
            <span class="related-category" style="
                color: var(--category-${message.category});
                border-color: var(--category-${message.category});
                background: ${getCategoryBgColor(message.category)};
            ">
                ${message.category.charAt(0).toUpperCase() + message.category.slice(1)}
            </span>
            <div class="related-content">${message.content}</div>
            <div class="related-meta">
                <span>${message.readCount} readers</span>
                <span>${message.timestamp}</span>
            </div>
        </a>
    `).join('');
}

function getCategoryBgColor(category) {
    const colors = {
        confession: 'rgba(229, 57, 53, 0.1)',
        vent: 'rgba(156, 39, 176, 0.1)',
        judge: 'rgba(33, 150, 243, 0.1)',
        dare: 'rgba(76, 175, 80, 0.1)'
    };
    return colors[category] || 'rgba(255, 255, 255, 0.1)';
}

// Mark message as read
function markMessageAsRead(messageId) {
    // Update localStorage or send to API
    const readMessages = JSON.parse(localStorage.getItem('unsaid_read_messages') || '[]');
    if (!readMessages.includes(messageId)) {
        readMessages.push(messageId);
        localStorage.setItem('unsaid_read_messages', JSON.stringify(readMessages));
    }
}

// Show message vanished state
function showMessageVanished() {
    const messageContent = document.getElementById('message-content');
    const timerEl = document.getElementById('vanishing-timer');
    
    messageContent.innerHTML = `
        <div class="message-view-header">
            <h1 class="message-view-title">Message Vanished</h1>
            <a href="chat.html" class="back-button">← Back to Confessions</a>
        </div>
        
        <div class="message-view-card" style="text-align: center; padding: 60px 40px;">
            <div style="font-size: 4rem; margin-bottom: 20px;">🕳️</div>
            <h2 style="font-family: 'Montserrat', sans-serif; margin-bottom: 15px;">This Whisper Has Disappeared</h2>
            <p style="color: var(--text-muted); margin-bottom: 30px;">
                Like all whispers on Unsaid, this message has vanished after being read.
                Its secrets are gone forever, leaving no trace behind.
            </p>
            <a href="chat.html" class="back-button" style="display: inline-flex;">
                💬 Read Other Whispers
            </a>
        </div>
    `;
    
    if (timerEl) {
        timerEl.style.display = 'none';
    }
}

// Message actions
function replyToMessage() {
    const messageBody = document.getElementById('message-body');
    const content = messageBody.textContent.substring(0, 100);
    localStorage.setItem('unsaid_reply_context', content);
    window.location.href = 'chat.html?reply=true';
}

function saveMessage() {
    const messageId = getMessageIdFromURL();
    const savedMessages = JSON.parse(localStorage.getItem('unsaid_saved_messages') || '[]');
    
    // Check if already saved
    if (!savedMessages.includes(messageId)) {
        savedMessages.push(messageId);
        localStorage.setItem('unsaid_saved_messages', JSON.stringify(savedMessages));
        
        // Show feedback
        alert('Message saved locally. You can view saved messages from your profile.');
    } else {
        alert('Message already saved.');
    }
}

function reportMessage() {
    const messageId = getMessageIdFromURL();
    const reportReason = prompt('Please briefly describe why you are reporting this message:');
    
    if (reportReason && reportReason.trim()) {
        const reports = JSON.parse(localStorage.getItem('unsaid_reports') || '[]');
        reports.push({
            messageId,
            reason: reportReason.trim(),
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('unsaid_reports', JSON.stringify(reports));
        
        alert('Thank you for your report. Our moderators will review this message.');
    }
}

// Initialize message view page
async function initMessageView() {
    const messageId = getMessageIdFromURL();
    
    if (!messageId) {
        window.location.href = 'chat.html';
        return;
    }
    
    // Show loading state
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('message-content');
    const errorEl = document.getElementById('error');
    
    try {
        const result = await fetchMessageData(messageId);
        
        if (result.success) {
            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';
            
            updateMessageUI(result.data);
            await showRelatedMessages(result.data.category, messageId);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error loading message:', error);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initMessageView);