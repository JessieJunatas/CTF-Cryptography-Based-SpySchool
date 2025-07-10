// UI Management for Spy School Game

// Timer management is now handled by the server and client.js
// No local timer logic needed here

// Game messages management
function showGameMessage(message, duration = 3000) {
    const gameMessages = document.getElementById('gameMessages');
    if (gameMessages) {
        gameMessages.textContent = message;
        gameMessages.style.display = 'block';
        
        setTimeout(() => {
            gameMessages.textContent = '';
            gameMessages.style.display = 'none';
        }, duration);
    }
}

// Player list management
function updatePlayerList(players) {
    const playersList = document.getElementById('players');
    if (playersList) {
        playersList.innerHTML = '';
        
        players.forEach(player => {
            const li = document.createElement('li');
            li.textContent = `${player.name}`;
            
            if (player.isKiller) {
                li.textContent += ' (Killer)';
                li.style.color = '#ff0000';
            } else {
                li.style.color = '#00ff00';
            }
            
            if (player.eliminated) {
                li.textContent += ' (Eliminated)';
                li.style.color = '#555555';
                li.style.textDecoration = 'line-through';
            }
            
            playersList.appendChild(li);
        });
    }
}

// Cipher key display
function displayCipherKeyGrid(cipherKey) {
    const cipherKeyDisplay = document.getElementById('cipherKeyDisplay');
    if (cipherKeyDisplay) {
        cipherKeyDisplay.innerHTML = '';
        
        for (let letter in cipherKey) {
            const keyPair = document.createElement('div');
            keyPair.className = 'cipher-pair';
            keyPair.textContent = `${letter} → ${cipherKey[letter]}`;
            keyPair.style.padding = '0.2rem';
            keyPair.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            keyPair.style.borderRadius = '3px';
            keyPair.style.textAlign = 'center';
            keyPair.style.fontSize = '0.9rem';
            cipherKeyDisplay.appendChild(keyPair);
        }
    }
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Style the notification
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.padding = '1rem';
    notification.style.borderRadius = '5px';
    notification.style.zIndex = '1000';
    notification.style.maxWidth = '300px';
    notification.style.wordWrap = 'break-word';
    
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#00ff00';
            notification.style.color = '#000000';
            break;
        case 'error':
            notification.style.backgroundColor = '#ff0000';
            notification.style.color = '#ffffff';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ffaa00';
            notification.style.color = '#000000';
            break;
        default:
            notification.style.backgroundColor = '#0088ff';
            notification.style.color = '#ffffff';
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Clue counter update
function updateClueCounter(solved, total = 3) {
    const clueCounter = document.getElementById('clueCounter');
    if (clueCounter) {
        clueCounter.textContent = `Clues Found: ${solved}/${total}`;
        
        if (solved === total) {
            clueCounter.style.color = '#00ff00';
            clueCounter.style.fontWeight = 'bold';
        }
    }
}

// Role display update
function updateRoleDisplay(isKiller, groupName) {
    const roleDisplay = document.getElementById('roleDisplay');
    if (roleDisplay) {
        const role = isKiller ? 'Killer' : 'Spy';
        roleDisplay.textContent = `${groupName} - Role: ${role}`;
        roleDisplay.style.color = isKiller ? '#ff0000' : '#00ff00';
    }
}

// Game over screen management
function showGameOverScreen(winner, type) {
    const gameScreen = document.getElementById('gameScreen');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const gameOverTitle = document.getElementById('gameOverTitle');
    const gameOverMessage = document.getElementById('gameOverMessage');
    
    if (gameScreen) gameScreen.classList.add('hidden');
    if (gameOverScreen) gameOverScreen.classList.remove('hidden');
    
    if (type === 'spy') {
        if (gameOverTitle) gameOverTitle.textContent = '🕵️ Spies Win! 🕵️';
        if (gameOverMessage) gameOverMessage.textContent = `${winner} successfully decoded all clues and identified the Killer!`;
    } else {
        if (gameOverTitle) gameOverTitle.textContent = '💀 Killer Wins! 💀';
        if (gameOverMessage) gameOverMessage.textContent = 'The Killer eliminated all Spy groups before they could solve the mystery!';
    }
}

// Play again functionality
document.addEventListener('DOMContentLoaded', () => {
    const playAgainBtn = document.getElementById('playAgainBtn');
    if (playAgainBtn) {
        playAgainBtn.addEventListener('click', () => {
            location.reload();
        });
    }
});

// Interaction prompt management
function showInteractionPrompt(show = true) {
    const interactionPrompt = document.getElementById('interactionPrompt');
    if (interactionPrompt) {
        if (show) {
            interactionPrompt.classList.remove('hidden');
        } else {
            interactionPrompt.classList.add('hidden');
        }
    }
}

// Cipher tool management
function openCipherInterface(clue) {
    const cipherTool = document.getElementById('cipherTool');
    const encryptedMessage = document.getElementById('encryptedMessage');
    const decryptionInput = document.getElementById('decryptionInput');
    
    if (cipherTool) cipherTool.classList.remove('hidden');
    if (encryptedMessage) encryptedMessage.textContent = clue.encrypted;
    if (decryptionInput) {
        decryptionInput.value = '';
        decryptionInput.focus();
    }
}

function closeCipherInterface() {
    const cipherTool = document.getElementById('cipherTool');
    if (cipherTool) cipherTool.classList.add('hidden');
}

// Initialize UI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Timer is now managed by server and client.js
    
    // Add escape key listener to close cipher tool
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeCipherInterface();
        }
    });
    
    // Add enter key listener for cipher submission
    const decryptionInput = document.getElementById('decryptionInput');
    if (decryptionInput) {
        decryptionInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                const submitBtn = document.getElementById('submitDecryption');
                if (submitBtn) submitBtn.click();
            }
        });
    }
});
