// Get the current host (works for both localhost and IP addresses)
const socket = io(window.location.origin);

let scene, camera, renderer;
let player, players = {};
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let canInteract = false;
let flashlightOn = false;
let clock = new THREE.Clock();
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let isJumping = false;
let jumpVelocity = 0;
let onGround = true;
const gravity = -9.8;
const jumpStrength = 5; // Increased for higher jumps
const groundLevel = 0.9;
let raycaster = new THREE.Raycaster();
let interactableObjects = [];
let doors = [];
let currentClueId = null;

const speed = 1.0; // slower movement speed for better control
const interactionDistance = 3;

let groupName = '';
let isKiller = false;
let cipherKey = {};
let solvedCluesCount = 0;
let killerCanEliminate = false;


let isSpectator = false;
let gameStartTime = 0;
const ELIMINATION_COOLDOWN = 60000; // 1 minute after game start (matches server)
let spectatorTargetIndex = 0;
let alivePlayerIds = [];

const loginScreen = document.getElementById('loginScreen');
const waitingScreen = document.getElementById('waitingScreen');
const roleAssignmentScreen = document.getElementById('roleAssignmentScreen');
const gameScreen = document.getElementById('gameScreen');
const joinBtn = document.getElementById('joinBtn');
const groupNameInput = document.getElementById('groupName');
const roleDisplay = document.getElementById('roleDisplay');
const timerDisplay = document.getElementById('timer');
const playersList = document.getElementById('players');
const clueCounter = document.getElementById('clueCounter');
const interactionPrompt = document.getElementById('interactionPrompt');
const cipherTool = document.getElementById('cipherTool');
const encryptedMessageDiv = document.getElementById('encryptedMessage');
const cipherKeyDisplay = document.getElementById('cipherKeyDisplay');
const decryptionInput = document.getElementById('decryptionInput');
const submitDecryption = document.getElementById('submitDecryption');
const closeCipher = document.getElementById('closeCipher');

document.addEventListener('DOMContentLoaded', () => {
    if (submitDecryption) {
        submitDecryption.addEventListener('click', () => {
            const solution = decryptionInput.value.trim().toUpperCase();
            console.log('Submit button clicked. Solution:', solution);
            console.log('Current clue ID:', currentClueId);
            if (solution.length > 0) {
                if (socket.connected) {
                    console.log('Socket connected. Emitting solveClue event with data:', { clueId: currentClueId, solution: solution });
                    socket.emit('solveClue', { clueId: currentClueId, solution: solution });
                } else {
                    console.error('Socket not connected. Cannot emit solveClue.');
                    showNotification('Connection lost. Please try again.', 'error');
                }
                // Hide any previous error message
                const errorMessage = document.getElementById('errorMessage');
                if (errorMessage) {
                    errorMessage.classList.remove('visible');
                }
            } else {
                // Show message if input is empty
                showNotification('Please enter a solution!', 'warning');
            }
        });
    }

    if (closeCipher) {
        closeCipher.addEventListener('click', () => {
            closeCipherTool();
            showNotification('Cipher tool closed.', 'info');
        });
    }
});
const gameMessages = document.getElementById('gameMessages');

// Role assignment elements
const spinnerWheel = document.getElementById('spinnerWheel');
const roleCountdown = document.getElementById('roleCountdown');
const assignedRole = document.getElementById('assignedRole');
const roleResult = document.getElementById('roleResult');
const roleDescription = document.getElementById('roleDescription');

// Game state variables
let canInteractWithClues = false;
let currentRoom = null;
let roomIndicator = null;

// Store for tracking flashlight update timing
let lastFlashlightUpdate = 0;
const FLASHLIGHT_UPDATE_INTERVAL = 100; // Update every 100ms instead of every frame

// Room indicator UI element - REMOVED
// function createRoomIndicator() {
//     roomIndicator = document.createElement('div');
//     roomIndicator.id = 'roomIndicator';
//     roomIndicator.style.position = 'absolute';
//     roomIndicator.style.top = '10px';
//     roomIndicator.style.left = '10px';
//     roomIndicator.style.padding = '8px 12px';
//     roomIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
//     roomIndicator.style.color = 'white';
//     roomIndicator.style.fontSize = '18px';
//     roomIndicator.style.fontWeight = 'bold';
//     roomIndicator.style.borderRadius = '5px';
//     roomIndicator.style.pointerEvents = 'none';
//     roomIndicator.style.zIndex = '1000';
//     roomIndicator.style.display = 'none';
//     document.body.appendChild(roomIndicator);
// }

// Update room indicator based on player position - REMOVED
// function updateRoomIndicator() {
//     if (!player) return;

//     const pos = player.position;

//     // Determine which room player is in by checking bounding boxes
//     let foundRoom = null;

//     // Rooms defined as objects with bounding box min/max
//     const rooms = [
//         { name: 'Library', minX: -15, maxX: -5, minZ: -20, maxZ: -10 },
//         { name: 'Classroom', minX: 6, maxX: 14, minZ: 4, maxZ: 16 },
//         { name: 'Office', minX: -8, maxX: -2, minZ: 11, maxZ: 19 },
//         { name: 'Cafeteria', minX: 10, maxX: 20, minZ: -15, maxZ: -5 }
//     ];

//     for (const room of rooms) {
//         if (pos.x >= room.minX && pos.x <= room.maxX && pos.z >= room.minZ && pos.z <= room.maxZ) {
//             foundRoom = room.name;
//             break;
//         }
//     }

//     if (foundRoom !== currentRoom) {
//         currentRoom = foundRoom;
//         if (currentRoom) {
//             roomIndicator.textContent = `Room: ${currentRoom}`;
//             roomIndicator.style.display = 'block';
//         } else {
//             roomIndicator.style.display = 'none';
//         }
//     }
// }

joinBtn.addEventListener('click', () => {
    const name = groupNameInput.value.trim();
    if (name.length > 0) {
        groupName = name;
        socket.emit('joinGame', groupName);
        loginScreen.classList.add('hidden');
        waitingScreen.classList.remove('hidden');
    }
});

// Waiting room handlers
socket.on('waitingRoomUpdate', (data) => {
    const waitingPlayersList = document.getElementById('waitingPlayersList');
    const playersNeededText = document.getElementById('playersNeeded');
    
    waitingPlayersList.innerHTML = '';
    data.players.forEach(playerName => {
        const li = document.createElement('li');
        li.textContent = playerName;
        waitingPlayersList.appendChild(li);
    });
    
    if (data.playersNeeded > 0) {
        playersNeededText.textContent = `Waiting for ${data.playersNeeded} more players...`;
    } else {
        playersNeededText.textContent = 'Starting game soon...';
    }
});

socket.on('countdownStarted', (timeLeft) => {
    const countdownDisplay = document.getElementById('countdownDisplay');
    countdownDisplay.textContent = `Game starting in ${timeLeft} seconds...`;
    countdownDisplay.classList.remove('hidden');
});

socket.on('countdownUpdate', (timeLeft) => {
    const countdownDisplay = document.getElementById('countdownDisplay');
    countdownDisplay.textContent = `Game starting in ${timeLeft} seconds...`;
});

socket.on('countdownCancelled', () => {
    const countdownDisplay = document.getElementById('countdownDisplay');
    countdownDisplay.classList.add('hidden');
});

socket.on('gameStarting', () => {
    waitingScreen.classList.add('hidden');
});

socket.on('gameJoined', (data) => {
    cipherKey = data.cipherKey;
    waitingScreen.classList.add('hidden');
    roleAssignmentScreen.classList.remove('hidden');
    
    // Start role assignment process
    let timeLeft = 1;
    roleCountdown.textContent = timeLeft;
    
    // Allow movement but disable interactions during countdown
    canInteractWithClues = false;
    init();
    animate();
    
    const countdownInterval = setInterval(() => {
        timeLeft--;
        roleCountdown.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            
            // Set the role
            isKiller = data.isKiller;
            
            // Show assigned role
            assignedRole.classList.remove('hidden');
            assignedRole.classList.add(isKiller ? 'killer' : 'spy');
            roleResult.textContent = isKiller ? 'You are the KILLER' : 'You are a SPY';
            roleDescription.textContent = isKiller ? 
                'Eliminate all spies before they solve the clues!' : 
                'Find and solve 3 clues while avoiding the killer!';
            
                // Enable interactions after 2 seconds
                setTimeout(() => {
                    roleAssignmentScreen.classList.add('hidden');
                    gameScreen.classList.remove('hidden');
                    canInteractWithClues = true;
                    isSpectator = false;
                    gameStartTime = Date.now();
                    
                    // Display role and player name
                    roleDisplay.innerHTML = `
                        <div>Player: ${groupName}</div>
                        <div>Role: ${isKiller ? 'Killer' : 'Spy'}</div>
                    `;
                    
                    // Hide timer display for all players
                    const timerDisplay = document.getElementById('timer');
                    if (timerDisplay) {
                        timerDisplay.style.display = 'none';
                        timerDisplay.textContent = '';
                    }
                    
                    // Show eliminate control only for killers
                    const eliminateControl = document.getElementById('eliminateControl');
                    if (eliminateControl) {
                        eliminateControl.style.display = isKiller ? 'block' : 'none';
                        if (isKiller) {
                            eliminateControl.textContent = 'K: Eliminate (Available in 1 minute)';
                        }
                    }
                    
                    displayCipherKey();
                    
                    // Create room indicator - REMOVED
                    // createRoomIndicator();
                }, 2000);
        }
    }, 1000);
});

socket.on('gameFull', (message) => {
    alert(message);
    waitingScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
});

socket.on('updatePlayers', (groups) => {
    playersList.innerHTML = '';
    groups.forEach(g => {
        const li = document.createElement('li');
        // Only show eliminated status, never show killer status to other players
        li.textContent = g.name + (g.eliminated ? ' (Eliminated)' : '');
        playersList.appendChild(li);
        
        // Create player mesh if it doesn't exist and it's not the current player
        if (g.id !== socket.id && !players[g.id]) {
            // Create player container
            const playerContainer = new THREE.Group();
            
            //basic geometric model for players
            const otherPlayer = createBasicPlayerModel(false); // Default to spy
            playerContainer.add(otherPlayer);

            // Create player name label
            const nameSprite = createPlayerNameSprite(g.name);
            nameSprite.position.y = 2.5; // Position above player head
            playerContainer.add(nameSprite);

            // Set initial position
            playerContainer.position.set(g.position.x || 0, g.position.y || 0, g.position.z || 0);
            playerContainer.userData = { id: g.id, name: g.name };
            
            // IMPORTANT: Set userData on all child meshes for raycasting
            playerContainer.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.userData = { id: g.id, name: g.name, playerId: g.id };
                }
            });
            
            scene.add(playerContainer);
            players[g.id] = playerContainer;

            // Add a point light to make player more visible
            const playerLight = new THREE.PointLight(0xffffff, 0.5, 5);
            playerLight.position.set(0, 1.5, 0);
            playerContainer.add(playerLight);
        }
    });
});

// Function to create player name sprite
function createPlayerNameSprite(name) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;

    // Set up text style
    context.font = 'bold 32px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Add text shadow for better visibility
    context.shadowColor = 'black';
    context.shadowBlur = 4;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;

    // Draw the text
    context.fillText(name, canvas.width / 2, canvas.height / 2);

    // Create sprite from canvas
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        depthTest: false // Make sure name is always visible
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2, 0.5, 1); // Adjust size as needed

    return sprite;
}

socket.on('playerMoved', (data) => {
    if (players[data.id]) {
        const playerContainer = players[data.id];
        const oldPosition = playerContainer.position.clone();
        playerContainer.position.set(data.position.x, data.position.y, data.position.z); 
        
        // Check if player is moving to trigger walk animation
        const isMoving = oldPosition.distanceTo(playerContainer.position) > 0.01;
        
        // Update animation based on movement
        if (playerContainer.userData && playerContainer.userData.walkAction && playerContainer.userData.idleAction) {
            if (isMoving && !playerContainer.userData.isMoving) {
                // Start walking
                playerContainer.userData.isMoving = true;
                playerContainer.userData.idleAction.fadeOut(0.2);
                playerContainer.userData.walkAction.reset().fadeIn(0.2).play();
            } else if (!isMoving && playerContainer.userData.isMoving) {
                // Stop walking
                playerContainer.userData.isMoving = false;
                playerContainer.userData.walkAction.fadeOut(0.2);
                playerContainer.userData.idleAction.reset().fadeIn(0.2).play();
            }
        }
        
        // Update name sprite to always face camera
        const nameSprite = playerContainer.children.find(child => child instanceof THREE.Sprite);
        if (nameSprite) {
            nameSprite.quaternion.copy(camera.quaternion);
        }
    } else {
        // Create player container
        const playerContainer = new THREE.Group();
        
        // Create player model
        const otherPlayer = createBasicPlayerModel(false); // Default to spy
        playerContainer.add(otherPlayer);

        // Create name sprite
        const nameSprite = createPlayerNameSprite(data.name || 'Unknown');
        nameSprite.position.y = 2.5; // Position above player head
        playerContainer.add(nameSprite);

        // Set position
        playerContainer.position.set(data.position.x, data.position.y, data.position.z);
        playerContainer.userData = { id: data.id, name: data.name || 'Unknown' };
        
        // IMPORTANT: Set userData on all child meshes for raycasting
        playerContainer.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.userData = { id: data.id, name: data.name || 'Unknown', playerId: data.id };
            }
        });
        
        scene.add(playerContainer);
        players[data.id] = playerContainer;

        // Add a point light to make player more visible
        const playerLight = new THREE.PointLight(0xffffff, 0.3, 3);
        playerLight.position.set(0, 1.5, 0);
        playerContainer.add(playerLight);
    }
});

socket.on('clueData', (clue) => {
    openCipherTool(clue);
});

socket.on('clueCorrect', (clueId) => {
    solvedCluesCount++;
    clueCounter.textContent = `Clues Found: ${solvedCluesCount}/3`;

    // Remove clue object from scene and interactableObjects
    for (let i = 0; i < interactableObjects.length; i++) {
        if (interactableObjects[i].userData.clueId === clueId) {
            scene.remove(interactableObjects[i]);
            interactableObjects.splice(i, 1);
            break;
        }
    }

    // Show success message and close cipher tool
    showNotification('Correct! Clue solved successfully!', 'success');
    closeCipherTool();
});

socket.on('playerEliminated', (playerId) => {
    if (players[playerId]) {
        // Change color of all parts in the player model
        players[playerId].traverse((object) => {
            if (object instanceof THREE.Mesh && object.material) {
                object.material.color.set(0x555555);
            }
        });

        // If this is the current player being eliminated
        if (playerId === socket.id) {
            // Enable spectator mode
            isSpectator = true;
            
            // Hide UI elements for spectators
            const eliminateControl = document.getElementById('eliminateControl');
            const clueCounter = document.getElementById('clueCounter');
            const interactionPrompt = document.getElementById('interactionPrompt');
            const controls = document.getElementById('controls');
            
            if (eliminateControl) eliminateControl.style.display = 'none';
            if (clueCounter) clueCounter.style.display = 'none';
            if (interactionPrompt) interactionPrompt.style.display = 'none';
            if (controls) controls.style.display = 'none';
            
            // Update alive players list for spectating
            updateAlivePlayersList();
            
            // Start spectating the first alive player
            if (alivePlayerIds.length > 0) {
                spectatorTargetIndex = 0;
                spectatePlayer(alivePlayerIds[spectatorTargetIndex]);
            }
            
            showMessage('You have been eliminated! Use E/Q to cycle through players. You are now spectating.');
        } else {
            showMessage('A player has been eliminated!');
            // Update alive players list if we're already spectating
            if (isSpectator) {
                updateAlivePlayersList();
            }
        }
    }
});

socket.on('gameWon', (data) => {
    showGameOver(data);
});

socket.on('eliminationReady', () => {
    if (isKiller) {
        killerCanEliminate = true;
        const eliminateControl = document.getElementById('eliminateControl');
        if (eliminateControl) {
            eliminateControl.textContent = 'K: ELIMINATION READY! Press K to eliminate';
            eliminateControl.style.color = '#ff4444';
            eliminateControl.style.fontWeight = 'bold';
        }
        showMessage('You can eliminate a player now! Press K when looking at a player to eliminate them.');
    }
});

socket.on('eliminationUsed', () => {
    if (isKiller) {
        killerCanEliminate = false;
        const eliminateControl = document.getElementById('eliminateControl');
        if (eliminateControl) {
            eliminateControl.textContent = 'K: Elimination on cooldown (1:00)';
            eliminateControl.style.color = '#666666';
            eliminateControl.style.fontWeight = 'normal';
        }
        showMessage('Elimination used. Wait 1 minute for next opportunity.');
    }
});

socket.on('clueProgress', (data) => {
    if (isKiller) {
        showMessage(`🚨 ALERT: ${data.playerName} solved clue ${data.clueId}! (${data.playerCluesCount}/3 clues) | Total progress: ${data.playersWithClues}/${data.totalPlayers} players have clues`);
        
        // Update killer's HUD with clue progress
        const clueProgressDiv = document.getElementById('clueProgress') || createClueProgressDiv();
        clueProgressDiv.innerHTML = `
            <h4>🔍 Spy Progress</h4>
            <div>Players with clues: ${data.playersWithClues}/${data.totalPlayers}</div>
            <div>Total clues solved: ${data.totalSolvedClues}</div>
            <div>Latest: ${data.playerName} (${data.playerCluesCount}/3)</div>
        `;
    }
});

socket.on('playerDisconnected', (data) => {
    // Show notification for player disconnection
    const roleText = data.wasKiller ? ' (Killer)' : '';
    showNotification(` ${data.name}${roleText} left the game`, 'disconnect');
    
    // Remove player from scene if they exist
    if (players[data.id]) {
        // Clean up flashlight if it exists
        if (players[data.id].userData && players[data.id].userData.flashlight) {
            scene.remove(players[data.id].userData.flashlight);
            scene.remove(players[data.id].userData.flashlightTarget);
        }
        
        scene.remove(players[data.id]);
        delete players[data.id];
    }
});

// Handle elimination message for eliminated players
socket.on('playerEliminatedMessage', (message) => {
    showMessage(message);
    
    // Show elimination overlay
    const eliminationOverlay = document.createElement('div');
    eliminationOverlay.style.position = 'fixed';
    eliminationOverlay.style.top = '0';
    eliminationOverlay.style.left = '0';
    eliminationOverlay.style.width = '100%';
    eliminationOverlay.style.height = '100%';
    eliminationOverlay.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
    eliminationOverlay.style.color = 'white';
    eliminationOverlay.style.display = 'flex';
    eliminationOverlay.style.flexDirection = 'column';
    eliminationOverlay.style.justifyContent = 'center';
    eliminationOverlay.style.alignItems = 'center';
    eliminationOverlay.style.fontSize = '48px';
    eliminationOverlay.style.fontWeight = 'bold';
    eliminationOverlay.style.zIndex = '10000';
    eliminationOverlay.innerHTML = `
        <div>💀 YOU HAVE BEEN ELIMINATED! 💀</div>
        <div style="font-size: 24px; margin-top: 20px;">Returning to lobby...</div>
    `;
    document.body.appendChild(eliminationOverlay);
    
    // Remove overlay after 3 seconds
    setTimeout(() => {
        if (eliminationOverlay.parentNode) {
            eliminationOverlay.parentNode.removeChild(eliminationOverlay);
        }
    }, 3000);
});

// Handle return to lobby for eliminated players
socket.on('returnToLobby', () => {
    // Reset to login screen
    gameScreen.classList.add('hidden');
    waitingScreen.classList.add('hidden');
    roleAssignmentScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    
    // Reset form
    groupNameInput.value = '';
    
    // Clear scene
    if (scene) {
        scene.clear();
    }
    
    // Reset ALL player data
    players = {};
    solvedCluesCount = 0;
    flashlightOn = false;
    isKiller = false;
    killerCanEliminate = false;
    isSpectator = false;
    
    showMessage('You have been returned to the lobby. You can join a new game when this one ends.');
});

socket.on('gameTerminated', (data) => {
    // Show game termination notification
    showNotification(`🚨 Game Terminated: ${data.reason}`, 'error');
    
    // Redirect to login screen after a delay
    setTimeout(() => {
        gameScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        
        // Reset form
        groupNameInput.value = '';
        
        // Clear scene
        if (scene) {
            scene.clear();
        }
        
        // Reset ALL player data including role
        players = {};
        solvedCluesCount = 0;
        flashlightOn = false;
        isKiller = false; // Reset killer status
        killerCanEliminate = false; // Reset elimination ability
        
        showMessage('Game terminated. Please join a new game.');
    }, 3000);
});

socket.on('gameWon', (data) => {
    showGameOver(data);
    
    // Reset role after game ends
    setTimeout(() => {
        isKiller = false;
        killerCanEliminate = false;
    }, 1000);
});

socket.on('gameMessage', (message) => {
    showMessage(message);
});

// Add socket event handlers for door synchronization
socket.on('doorStateChange', (data) => {
    // Find the door by name and update its state
    const door = doors.find(d => d.name === data.doorName);
    if (door) {
        door.isOpen = data.isOpen;
        door.isAnimating = true;

        // Animate the door to the new position
        const startPos = door.position.clone();
        const endPos = new THREE.Vector3(data.position.x, data.position.y, data.position.z);

        animateDoor(door, startPos, endPos, 300);
    }
});

// Add socket event handlers for flashlight synchronization
socket.on('playerFlashlightUpdate', (data) => {
    const playerContainer = players[data.playerId];
    if (playerContainer && data.playerId !== socket.id) {
        // Find or create flashlight for this player
        let playerFlashlight = playerContainer.userData.flashlight;
        
        if (!playerFlashlight && data.isOn) {
            // Create flashlight for other player
            playerFlashlight = new THREE.SpotLight(0xffffff, 0.8);
            playerFlashlight.angle = Math.PI / 6;
            playerFlashlight.penumbra = 0.1;
            playerFlashlight.decay = 2;
            playerFlashlight.distance = 15;
            playerFlashlight.castShadow = true;
            
            // Create target for the flashlight
            const flashlightTarget = new THREE.Object3D();
            scene.add(flashlightTarget);
            playerFlashlight.target = flashlightTarget;
            
            scene.add(playerFlashlight);
            playerContainer.userData.flashlight = playerFlashlight;
            playerContainer.userData.flashlightTarget = flashlightTarget;
        }
        
        if (playerFlashlight) {
            // Update flashlight state
            playerFlashlight.visible = data.isOn;
            
            if (data.isOn) {
                // Update flashlight position and direction
                playerFlashlight.position.set(data.position.x, data.position.y, data.position.z);
                playerContainer.userData.flashlightTarget.position.set(data.target.x, data.target.y, data.target.z);
            }
        }
    }
});


// Add socket event handlers for flashlight synchronization
socket.on('flashlightToggle', (data) => {
    if (players[data.playerId] && data.playerId !== socket.id) {
        // Create or update other player's flashlight
        createOrUpdatePlayerFlashlight(data.playerId, data.isOn, data.position, data.direction);
        
        // Show/hide the physical flashlight object
        const playerContainer = players[data.playerId];
        if (playerContainer && playerContainer.children) {
            const playerModel = playerContainer.children.find(child => child.userData && child.userData.flashlightObject);
            if (playerModel && playerModel.userData.flashlightObject) {
                playerModel.userData.flashlightObject.visible = data.isOn;
            }
        }
    }
});

socket.on('flashlightUpdate', (data) => {
    if (players[data.playerId] && data.playerId !== socket.id) {
        // Update other player's flashlight direction
        updatePlayerFlashlight(data.playerId, data.position, data.direction, data.isOn);
        
        // Ensure physical flashlight object is visible when flashlight is on
        const playerContainer = players[data.playerId];
        if (playerContainer && playerContainer.children) {
            const playerModel = playerContainer.children.find(child => child.userData && child.userData.flashlightObject);
            if (playerModel && playerModel.userData.flashlightObject) {
                playerModel.userData.flashlightObject.visible = data.isOn;
            }
        }
    }
});

function createOrUpdatePlayerFlashlight(playerId, isOn, position, direction) {
    const playerContainer = players[playerId];
    if (!playerContainer) return;

    // Remove existing flashlight if any
    if (playerContainer.userData.flashlight) {
        scene.remove(playerContainer.userData.flashlight.light);
        scene.remove(playerContainer.userData.flashlight.target);
        scene.remove(playerContainer.userData.flashlight.cone);
    }

    if (isOn) {
        // Create flashlight for other player
        const flashlight = new THREE.SpotLight(0xffffff, 1.0);
        flashlight.angle = Math.PI / 8;
        flashlight.penumbra = 0.3;
        flashlight.decay = 1;
        flashlight.distance = 20;
        flashlight.castShadow = false; // Disable shadows for other players' flashlights for performance
        scene.add(flashlight);

        const flashlightTarget = new THREE.Object3D();
        scene.add(flashlightTarget);
        flashlight.target = flashlightTarget;

        // Create visible light cone
        const coneGeometry = new THREE.ConeGeometry(0.1, 15, 6, 1, true);
        const coneMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.05,
            side: THREE.DoubleSide
        });
        const lightCone = new THREE.Mesh(coneGeometry, coneMaterial);
        lightCone.rotation.x = Math.PI / 2;
        scene.add(lightCone);

        // Store flashlight system
        playerContainer.userData.flashlight = {
            light: flashlight,
            target: flashlightTarget,
            cone: lightCone
        };

        // Update position and direction
        updatePlayerFlashlight(playerId, position, direction, true);
    } else {
        playerContainer.userData.flashlight = null;
    }
}

function updatePlayerFlashlight(playerId, position, direction, isOn) {
    const playerContainer = players[playerId];
    if (!playerContainer || !playerContainer.userData.flashlight) return;

    const flashlightSystem = playerContainer.userData.flashlight;
    
    if (isOn && flashlightSystem) {
        // Update flashlight position to player's camera height (eye level)
        const eyeLevelY = position.y + 0.7; // Add eye height offset
        flashlightSystem.light.position.set(position.x, eyeLevelY, position.z);
        
        // Update target position
        const targetDistance = 15;
        flashlightSystem.target.position.set(
            position.x + direction.x * targetDistance,
            eyeLevelY + direction.y * targetDistance,
            position.z + direction.z * targetDistance
        );

        // Update light cone position and rotation
        flashlightSystem.cone.position.set(
            position.x + direction.x * 7.5,
            eyeLevelY + direction.y * 7.5,
            position.z + direction.z * 7.5
        );
        flashlightSystem.cone.lookAt(flashlightSystem.target.position);
        flashlightSystem.cone.visible = true;
    }
}

function createClueProgressDiv() {
    const clueProgressDiv = document.createElement('div');
    clueProgressDiv.id = 'clueProgress';
    clueProgressDiv.style.position = 'absolute';
    clueProgressDiv.style.top = '120px';
    clueProgressDiv.style.left = '20px';
    clueProgressDiv.style.background = 'rgba(255, 0, 0, 0.8)';
    clueProgressDiv.style.color = 'white';
    clueProgressDiv.style.padding = '10px';
    clueProgressDiv.style.borderRadius = '5px';
    clueProgressDiv.style.fontSize = '14px';
    clueProgressDiv.style.fontFamily = 'monospace';
    clueProgressDiv.style.border = '2px solid #ff4444';
    document.body.appendChild(clueProgressDiv);
    return clueProgressDiv;
}

socket.on('timerUpdate', (data) => {
    const timerDisplay = document.getElementById('timer');
    if (timerDisplay) {
        // Hide timer completely for all players
        timerDisplay.style.display = 'none';
        
        //update elimination control for killers
        if (isKiller) {
            const eliminateControl = document.getElementById('eliminateControl');
            if (eliminateControl) {
                if (data.canEliminate && data.minutes === 0 && data.seconds === 0) {
                    eliminateControl.textContent = 'K: ELIMINATION READY! Press K to eliminate';
                    eliminateControl.style.color = '#ff4444';
                    eliminateControl.style.fontWeight = 'bold';
                } else {
                    const timeString = `${data.minutes}:${data.seconds.toString().padStart(2, '0')}`;
                    eliminateControl.textContent = `K: Elimination on cooldown (${timeString})`;
                    eliminateControl.style.color = '#666666';
                    eliminateControl.style.fontWeight = 'normal';
                }
            }
        }
    }
});

function updateAlivePlayersList() {
    alivePlayerIds = Object.keys(players).filter(id => {
        const player = players[id];
        return player && player.userData && !player.userData.eliminated && id !== socket.id;
    });
}

function spectatePlayer(playerId) {
    if (!players[playerId]) return;
    const targetPlayer = players[playerId];
    // Position camera at some offset behind and above the target player
    const offset = new THREE.Vector3(0, 2, 5);
    const targetPosition = targetPlayer.position.clone();
    camera.position.copy(targetPosition).add(offset);
    camera.lookAt(targetPosition);
    showMessage(`Spectating: ${targetPlayer.userData.name || 'Unknown'}`);
}

function cycleSpectatorTarget(direction) {
    if (alivePlayerIds.length === 0) return;
    spectatorTargetIndex = (spectatorTargetIndex + direction + alivePlayerIds.length) % alivePlayerIds.length;
    spectatePlayer(alivePlayerIds[spectatorTargetIndex]);
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Complete darkness

    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 0); // Adjusted eye level height for proper spawn

    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('gameCanvas'),
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Minimal ambient light for very dark atmosphere
    const ambientLight = new THREE.AmbientLight(0x111111, 0.2);
    scene.add(ambientLight);

    // Create school layout
    createSchool();

    // Create player container for first-person player
    const playerContainer = new THREE.Group();
    
    // Player collision box (invisible in first-person)
    const geometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
    const material = new THREE.MeshStandardMaterial({ color: isKiller ? 0xff0000 : 0x00ff00, visible: false });
    player = new THREE.Mesh(geometry, material);
    player.position.set(0, 0.9, 0); // Spawn slightly above ground to ensure proper landing
    player.castShadow = true;
    player.receiveShadow = true;
    playerContainer.add(player);
    
    // Add character model to the player container (but make it invisible for first-person)
    const characterModel = createBasicPlayerModel(isKiller, false);
    characterModel.position.set(0, 0, 0);
    characterModel.visible = false; // Hide first-person player's own model to prevent blocking view
    playerContainer.add(characterModel);
    
    // Set up player container
    playerContainer.position.set(0, 0, 0);
    playerContainer.userData = { id: socket.id, name: groupName };
    scene.add(playerContainer);
    players[socket.id] = playerContainer;

    // Create flashlight system
    flashlightSystem = createFlashlight();

    // Add doors to each room
    createDoors();

    
    // Add all wall-mounted letter clues (both first and second floor) using unified logic
    addWallMountedLetter(-7, 2.5, 10, 1, 'east'); // Cafeteria - back wall (inside the room)
    addWallMountedLetter(11, 2.5, 15, 2, 'south');     // Classroom A - back wall  
    addWallMountedLetter(5, 2.5, 11, 3, 'west');   // Office - back wall
    
    // Second floor clues - using same logic as first floor
    const secondFloorHeight = 20 * 0.2; // Calculate second floor height (4 units)
    addWallMountedLetter(5, secondFloorHeight + 2.5, -20, 4, 'north'); // Second Floor Library - back wall
    addWallMountedLetter(24, secondFloorHeight + 2.5, 16, 5, 'east'); // Conference Room - left wall
    addWallMountedLetter(-24.2, secondFloorHeight + 2.5, 15.5, 6, 'west'); // Art Room - back wall


    // Event listeners
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onWindowResize);

    // Request pointer lock for first-person controls and hide cursor
    const canvas = document.getElementById('gameCanvas');
    canvas.addEventListener('click', () => {
        canvas.requestPointerLock();
    });

    // Handle pointer lock change
    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === canvas) {
            console.log('Pointer locked');
        } else {
            console.log('Pointer unlocked');
        }
    });

    // Track key states for door interaction
    let eKeyPressed = false;
    
    // Interaction key
    document.addEventListener('keydown', (event) => {
        // Don't process interaction keys if cipher tool is open
        if (!cipherTool.classList.contains('hidden')) {
            return;
        }
        
        if (event.key === 'e' || event.key === 'E') {
            if (isSpectator) {
                // Spectator controls - cycle to next player
                cycleSpectatorTarget(1);
            } else if (!eKeyPressed) {
                eKeyPressed = true;
                if (canInteract) {
                    interactWithObject();
                }
            }
        }
        if (event.key === 'q' || event.key === 'Q') {
            if (isSpectator) {
                // Spectator controls - cycle to previous player
                cycleSpectatorTarget(-1);
            }
        }
        if (event.key === 'f' || event.key === 'F') {
            toggleFlashlight();
        }
        if (event.key === 'k' || event.key === 'K') {
            console.log('K key pressed, isKiller:', isKiller);
            if (isKiller) {
                if (killerCanEliminate) {
                    eliminatePlayerInSight();
                } else {
                    // Show countdown when killer presses K but can't eliminate yet
                    console.log('Calling showEliminationCountdown()');
                    showEliminationCountdown();
                }
            }
        }
    });

    document.addEventListener('keyup', (event) => {
        if (event.key === 'e' || event.key === 'E') {
            eKeyPressed = false;
            // Close door if player was holding E near a door
            if (canInteract && !isSpectator) {
                closeDoorIfNearby();
            }
        }
    });

    // Mouse click for killer elimination
    document.addEventListener('click', (event) => {
        if (isKiller && killerCanEliminate) {
            const mouse = new THREE.Vector2(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1
            );
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(Object.values(players).filter(p => p !== player));
            if (intersects.length > 0) {
                const target = intersects[0].object;
                socket.emit('killerEliminate', target.userData.id);
            }
        }
    });
}

function addClueObject(x, y, z, clueId) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
    const clueObj = new THREE.Mesh(geometry, material);
    clueObj.position.set(x, y, z);
    clueObj.userData = { clueId: clueId };
    scene.add(clueObj);
    interactableObjects.push(clueObj);
}

function onKeyDown(event) {
    // Don't process movement keys if cipher tool is open or in spectator mode
    if (!cipherTool.classList.contains('hidden') || isSpectator) {
        return;
    }
    
    switch(event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
        case 'Space': 
            event.preventDefault(); // Prevent page scrolling
            if (onGround && !isJumping) {
                isJumping = true;
                jumpVelocity = jumpStrength;
                onGround = false;
            }
            break;
    }
}

function onKeyUp(event) {
    // Don't process movement keys if cipher tool is open or in spectator mode
    if (!cipherTool.classList.contains('hidden') || isSpectator) {
        return;
    }
    
    switch(event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
    }
}

let pitch = 0;
let yaw = 0;
let flashlightSystem;  // Flashlight system variable

function onMouseMove(event) {
    // Only process mouse movement if pointer is locked
    if (document.pointerLockElement === document.getElementById('gameCanvas')) {
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;

        // Update yaw (left/right) based on X movement
        yaw -= movementX * 0.002;

        // Update pitch (up/down) based on Y movement
        pitch += movementY * 0.002;
        pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));

        // Create direction vector for camera and flashlight
        const direction = new THREE.Vector3();
        direction.x = -Math.sin(yaw) * Math.cos(pitch);
        direction.y = -Math.sin(pitch);
        direction.z = -Math.cos(yaw) * Math.cos(pitch);
        direction.normalize();

        // Set camera rotation
        camera.lookAt(camera.position.clone().add(direction));

        // Update flashlight target if flashlight is active
        if (flashlightSystem && flashlightSystem.light) {
            const targetDistance = 5;
            flashlightSystem.target.position.copy(camera.position);
            flashlightSystem.target.position.add(direction.multiplyScalar(targetDistance));
        }

        // Update character body rotation for first-person player (only horizontal rotation)
        if (players[socket.id] && players[socket.id].children) {
            const characterModel = players[socket.id].children.find(child => child.userData && child.userData.isCharacterModel);
            if (characterModel) {
                // Only rotate the character horizontally (Y-axis) to match movement direction, not camera look
                characterModel.rotation.y = yaw + Math.PI; // Add PI to face forward
            }
        }
    }
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Update all player name sprites to face camera and animation mixers
    Object.values(players).forEach(playerContainer => {
        const nameSprite = playerContainer.children.find(child => child instanceof THREE.Sprite);
        if (nameSprite) {
            nameSprite.quaternion.copy(camera.quaternion);
        }
        
        // Update animation mixer if it exists
        if (playerContainer.userData && playerContainer.userData.mixer) {
            playerContainer.userData.mixer.update(delta);
        }
        
        // Handle manual bone animation for models without built-in animations
        if (playerContainer.userData && playerContainer.userData.manualAnimation) {
            updateManualBoneAnimation(playerContainer, delta);
        }
    });

    // Only allow movement if not in spectator mode
    if (!isSpectator) {
        // Store old position for movement detection
        const oldPosition = player.position.clone();
        
        // Apply friction
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        // Calculate movement direction based on camera orientation
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveLeft) - Number(moveRight);
        direction.normalize();

        // Apply movement relative to camera direction (fixed controls)
        if (moveForward || moveBackward) {
            velocity.x -= Math.sin(yaw) * direction.z * speed * delta;
            velocity.z -= Math.cos(yaw) * direction.z * speed * delta;
        }
        if (moveLeft || moveRight) {
            velocity.x -= Math.sin(yaw + Math.PI/2) * direction.x * speed * delta;
            velocity.z -= Math.cos(yaw + Math.PI/2) * direction.x * speed * delta;
        }

        // Calculate new position
        const newX = player.position.x + velocity.x;
        const newZ = player.position.z + velocity.z;

        // Check for wall collisions before updating position
        const playerRadius = 0.3; // Half of player width
        const wallCollision = checkWallCollision(newX, newZ, playerRadius);
        
        // Only update position if there's no wall collision
        if (!wallCollision) {
            player.position.x = newX;
            player.position.z = newZ;
        }

        // Check if player is moving for animation control
        const currentPlayerContainer = players[socket.id];
        if (currentPlayerContainer && currentPlayerContainer.userData) {
            // Check if any movement keys are pressed OR if position actually changed
            const isMovingKeys = moveForward || moveBackward || moveLeft || moveRight;
            const isMovingPosition = oldPosition.distanceTo(player.position) > 0.01;
            const isMoving = isMovingKeys || isMovingPosition;
            
            // Update animation based on movement for first-person player
            if (currentPlayerContainer.userData.walkAction && currentPlayerContainer.userData.idleAction) {
                if (isMoving && !currentPlayerContainer.userData.isMoving) {
                    // Start walking
                    currentPlayerContainer.userData.isMoving = true;
                    if (currentPlayerContainer.userData.currentAction) {
                        currentPlayerContainer.userData.currentAction.fadeOut(0.2);
                    }
                    currentPlayerContainer.userData.walkAction.reset().fadeIn(0.2).play();
                    currentPlayerContainer.userData.currentAction = currentPlayerContainer.userData.walkAction;
                    console.log('Started walk animation');
                } else if (!isMoving && currentPlayerContainer.userData.isMoving) {
                    // Stop walking
                    currentPlayerContainer.userData.isMoving = false;
                    if (currentPlayerContainer.userData.currentAction) {
                        currentPlayerContainer.userData.currentAction.fadeOut(0.2);
                    }
                    currentPlayerContainer.userData.idleAction.reset().fadeIn(0.2).play();
                    currentPlayerContainer.userData.currentAction = currentPlayerContainer.userData.idleAction;
                    console.log('Started idle animation');
                }
            }
        }

        // Handle jumping and gravity
        if (isJumping) {
            // Apply gravity to jump velocity
            jumpVelocity += gravity * delta;
            
            // Calculate new Y position
            const newY = player.position.y + jumpVelocity * delta;
            
            // Check for ceiling collision
            const playerHeight = 1.8; // Player height
            const playerRadius = 0.3; // Player radius
            const ceilingCollision = checkCeilingCollision(player.position.x, newY, player.position.z, playerRadius, playerHeight);
            
            if (ceilingCollision !== null) {
                // Hit ceiling - stop upward movement and start falling
                player.position.y = ceilingCollision;
                jumpVelocity = 0; // Stop upward velocity
                showMessage('Bonk! Hit the ceiling!');
            } else {
                // No ceiling collision, update Y position normally
                player.position.y = newY;
            }
        }
        
        // Always check ground level and handle landing
        let targetGroundHeight = groundLevel;
        
        // Check if player is on stairs and adjust target ground height
        const stairHeight = getStairHeight(player.position.x, player.position.z);
        if (stairHeight !== null) {
            // Apply stair height for proper stair walking
            targetGroundHeight = stairHeight + 0.9; // Player height above stair
        }
        
        // Check if player has landed or is below ground
        if (player.position.y <= targetGroundHeight) {
            player.position.y = targetGroundHeight;
            if (isJumping) {
                isJumping = false;
                jumpVelocity = 0;
                onGround = true;
            }
        } else {
            // Player is in the air
            onGround = false;
            // If player is above ground but not jumping, start falling
            if (!isJumping) {
                isJumping = true;
                jumpVelocity = 0; // Start falling from current position
            }
        }

        // Update camera to player position (first-person)
        camera.position.x = player.position.x;
        camera.position.y = player.position.y + 0.7; // Eye height
        camera.position.z = player.position.z;

        socket.emit('playerMove', { x: player.position.x, y: player.position.y, z: player.position.z });
    }

    // Update flashlight position and direction
    if (flashlightSystem && flashlightSystem.light) {
        // Update flashlight position to match camera
        flashlightSystem.light.position.copy(camera.position);
        
        // Update flashlight target based on camera direction
        const direction = new THREE.Vector3();
        direction.x = -Math.sin(yaw) * Math.cos(pitch);
        direction.y = -Math.sin(pitch);
        direction.z = -Math.cos(yaw) * Math.cos(pitch);
        direction.normalize();
        
        const targetDistance = 15;
        flashlightSystem.target.position.copy(camera.position);
        flashlightSystem.target.position.add(direction.multiplyScalar(targetDistance));
        
        // Update visible light cone position and rotation
        if (flashlightSystem.cone && flashlightOn) {
            flashlightSystem.cone.position.copy(camera.position);
            flashlightSystem.cone.position.add(direction.multiplyScalar(7.5));
            flashlightSystem.cone.lookAt(flashlightSystem.target.position);
        }
        
        // Send flashlight updates to other players at intervals (regardless of cone visibility)
        if (flashlightOn) {
            const now = Date.now();
            if (now - lastFlashlightUpdate > FLASHLIGHT_UPDATE_INTERVAL) {
                console.log('Sending flashlight update:', {
                    playerId: socket.id,
                    position: camera.position,
                    direction: direction,
                    isOn: flashlightOn
                });
                socket.emit('flashlightUpdate', {
                    playerId: socket.id,
                    position: camera.position,
                    direction: direction,
                    isOn: flashlightOn
                });
                lastFlashlightUpdate = now;
            }
        }
    }

    // Only check interaction if not in spectator mode
    if (!isSpectator) {
        checkInteraction();
        // updateRoomIndicator(); // REMOVED - no longer showing room names
    }

    renderer.render(scene, camera);
}

function checkInteraction() {
    canInteract = false;
    interactionPrompt.classList.add('hidden');

    const playerPos = player.position;
    
    // Check for clue interaction
    for (let obj of interactableObjects) {
        const dist = playerPos.distanceTo(obj.position);
        
        // Debug logging for second floor clues
        if (obj.userData.clueId >= 4) { // Second floor clues have IDs 4, 5, 6
            console.log(`Checking second floor clue ${obj.userData.clueId}:`, {
                playerPos: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
                cluePos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
                distance: dist,
                interactionDistance: interactionDistance,
                canInteract: dist < interactionDistance
            });
        }
        
        if (dist < interactionDistance) {
            canInteract = true;
            interactionPrompt.innerHTML = '<div>Press E to interact with clue</div>';
            interactionPrompt.classList.remove('hidden');
            return;
        }
    }
    
    // Check for door interaction
    for (let door of doors) {
        // Skip second floor doors if player is on first floor
        if (door.isSecondFloorDoor && player.position.y < 3.0) {
            continue; // Don't check second floor doors for first floor players
        }
        
        // Skip first floor doors if player is on second floor
        if (!door.isSecondFloorDoor && player.position.y > 3.0) {
            continue; // Don't check first floor doors for second floor players
        }
        
        const dist = playerPos.distanceTo(door.position);
        if (dist < interactionDistance) {
            canInteract = true;
            interactionPrompt.innerHTML = '<div>Press E to open door / Hold E to close door</div>';
            interactionPrompt.classList.remove('hidden');
            return;
        }
    }
}

function interactWithObject() {
    if (!canInteract) return;

    const playerPos = player.position;
    
    // Check for clue interaction first
    for (let obj of interactableObjects) {
        const dist = playerPos.distanceTo(obj.position);
        if (dist < interactionDistance) {
            socket.emit('interactClue', obj.userData.clueId);
            return;
        }
    }
    
    // Check for door interaction
    for (let door of doors) {
        const dist = playerPos.distanceTo(door.position);
        if (dist < interactionDistance) {
            openDoor(door);
            return;
        }
    }
}

function closeDoorIfNearby() {
    if (!canInteract) return;

    const playerPos = player.position;
    for (let door of doors) {
        const dist = playerPos.distanceTo(door.position);
        if (dist < interactionDistance && door.isOpen) {
            closeDoor(door);
            return;
        }
    }
}

function openCipherTool(clue) {
    cipherTool.classList.remove('hidden');
    // Display encrypted message in aligned format (one letter per line)
    encryptedMessageDiv.innerHTML = '';
    for (let char of clue.encrypted) {
        const span = document.createElement('span');
        if (char === ' ') {
            span.innerHTML = '&nbsp;&nbsp;'; // preserve spaces
        } else {
            span.textContent = char;
        }
        span.style.display = 'inline-block';
        span.style.width = '1.2em';
        span.style.textAlign = 'center';
        encryptedMessageDiv.appendChild(span);
    }
    decryptionInput.value = '';
    currentClueId = clue.id;
}

function closeCipherTool() {
    cipherTool.classList.add('hidden');
}

// Function to create wall-mounted letter clues
function addWallMountedLetter(x, y, z, clueId, wallDirection) {
    // Create letter group
    const letterGroup = new THREE.Group();
    
    // Create letter background (small plaque)
    const plaqueGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.1);
    const plaqueMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513, // Brown wood color
        roughness: 0.8 
    });
    const plaque = new THREE.Mesh(plaqueGeometry, plaqueMaterial);
    letterGroup.add(plaque);
    
    // Create letter text using canvas texture
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 128;
    
    // Set background
    context.fillStyle = '#8B4513';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw letter
    context.fillStyle = '#FFD700'; // Gold color for letter
    context.font = 'bold 80px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(String.fromCharCode(64 + clueId), canvas.width / 2, canvas.height / 2); // A, B, C based on clueId
    
    // Create texture and material
    const texture = new THREE.CanvasTexture(canvas);
    const letterMaterial = new THREE.MeshStandardMaterial({ 
        map: texture,
        transparent: true
    });
    
    // Create letter plane
    const letterGeometry = new THREE.PlaneGeometry(0.6, 0.6);
    const letterMesh = new THREE.Mesh(letterGeometry, letterMaterial);
    letterMesh.position.z = 0.06; // Slightly in front of plaque
    letterGroup.add(letterMesh);
    
    // Position and orient based on wall direction
    letterGroup.position.set(x, y, z);
    
    switch(wallDirection) {
        case 'north': // Back wall
            letterGroup.rotation.y = 0;
            break;
        case 'south': // Front wall  
            letterGroup.rotation.y = Math.PI;
            break;
        case 'east': // Right wall
            letterGroup.rotation.y = -Math.PI / 2;
            break;
        case 'west': // Left wall
            letterGroup.rotation.y = Math.PI / 2;
            break;
    }
    
    // Add interaction data
    letterGroup.userData = { clueId: clueId };
    letterGroup.castShadow = true;
    letterGroup.receiveShadow = true;
    
    scene.add(letterGroup);
    interactableObjects.push(letterGroup);
}

function createFlashlight() {
    // Create spotlight for flashlight effect
    const flashlight = new THREE.SpotLight(0xffffff, 1.5);
    flashlight.position.set(0, 0, 0);  // Position will be updated to match camera
    flashlight.angle = Math.PI / 8;  // Narrower beam
    flashlight.penumbra = 0.3;  // Softer edges
    flashlight.decay = 1;
    flashlight.distance = 20;
    flashlight.castShadow = true;
    flashlight.shadow.mapSize.width = 1024; // Reduced shadow map size for better performance
    flashlight.shadow.mapSize.height = 1024;
    flashlight.shadow.camera.near = 0.1;
    flashlight.shadow.camera.far = 25;
    scene.add(flashlight);

    // Create flashlight target that will follow camera direction
    const flashlightTarget = new THREE.Object3D();
    scene.add(flashlightTarget);
    flashlight.target = flashlightTarget;

    // Create visible light cone geometry for other players to see
    const coneGeometry = new THREE.ConeGeometry(0.1, 15, 6, 1, true); // Reduced segments for better performance
    const coneMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.08, // Reduced opacity for better performance
        side: THREE.DoubleSide
    });
    const lightCone = new THREE.Mesh(coneGeometry, coneMaterial);
    lightCone.position.set(0, 0, -7.5); // Position cone in front of light
    lightCone.rotation.x = Math.PI / 2; // Rotate to point forward
    lightCone.visible = false; // Initially hidden
    scene.add(lightCone);

    return { 
        light: flashlight, 
        target: flashlightTarget, 
        cone: lightCone,
        visible: false
    };
}

function toggleFlashlight() {
    flashlightOn = !flashlightOn;
    if (flashlightSystem && flashlightSystem.light) {
        flashlightSystem.light.visible = flashlightOn;
        flashlightSystem.cone.visible = flashlightOn;
        flashlightSystem.visible = flashlightOn;
        
        // Only emit flashlight state when toggling, not continuously
        socket.emit('flashlightToggle', {
            playerId: socket.id,
            isOn: flashlightOn,
            position: player.position,
            direction: {
                x: -Math.sin(yaw) * Math.cos(pitch),
                y: -Math.sin(pitch),
                z: -Math.cos(yaw) * Math.cos(pitch)
            }
        });
    }
}

function showMessage(msg) {
    gameMessages.textContent = msg;
    setTimeout(() => {
        gameMessages.textContent = '';
    }, 3000);
}

function showGameOver(data) {
    gameScreen.classList.add('hidden');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const gameOverTitle = document.getElementById('gameOverTitle');
    const gameOverMessage = document.getElementById('gameOverMessage');
    gameOverScreen.classList.remove('hidden');

    if (data.type === 'spy') {
        gameOverTitle.textContent = 'Spies Win!';
        gameOverMessage.textContent = `${data.winner} solved all clues and identified the Killer!`;
    } else {
        gameOverTitle.textContent = 'Killer Wins!';
        gameOverMessage.textContent = 'The Killer eliminated all Spy groups!';
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Add collision detection function
function checkWallCollision(playerX, playerZ, playerRadius) {
    // Determine if player is on second floor
    const playerHeight = player ? player.position.y : 1.0;
    
    // Check walls with proper bounding box collision
    for (const wall of walls) {
        // Skip stair collision for horizontal movement, but allow platform edge detection
        if (wall.isStair && !wall.isSecondFloor) continue;
        
        // Skip second floor platforms entirely for horizontal collision
        // Second floor platforms should only affect vertical movement (handled in getStairHeight)
        if (wall.isSecondFloor) {
            continue; // Don't check second floor platforms for horizontal collision
        }
        
        // Skip handrails completely - they should not block player movement
        if (wall.isHandrail) {
            continue; // Don't check handrails for collision - they're just visual guides
        }
        
        // Skip first floor room walls if player is on second floor (height > 3), but keep boundary walls
        if (playerHeight > 3.0 && !wall.isStair && !wall.isBoundaryWall && !wall.isSecondFloorRoom) {
            continue; // Don't check first floor room walls when on second floor, but keep boundary walls
        }
        
        // Skip second floor room walls if player is on first floor (height <= 3)
        if (playerHeight <= 3.0 && wall.isSecondFloorRoom) {
            continue; // Don't check second floor room walls when on first floor
        }
        
        // Calculate wall boundaries
        const wallLeft = wall.x - wall.width/2;
        const wallRight = wall.x + wall.width/2;
        const wallTop = wall.z - wall.depth/2;
        const wallBottom = wall.z + wall.depth/2;
        
        // Calculate player boundaries
        const playerLeft = playerX - playerRadius;
        const playerRight = playerX + playerRadius;
        const playerTop = playerZ - playerRadius;
        const playerBottom = playerZ + playerRadius;
        
        // Check for AABB (Axis-Aligned Bounding Box) collision
        if (playerRight > wallLeft && 
            playerLeft < wallRight && 
            playerBottom > wallTop && 
            playerTop < wallBottom) {
            return true; // Collision detected
        }
    }
    
    // Check collision with closed doors
    for (const door of doors) {
        if (!door.isOpen) {
            // Skip second floor doors if player is on first floor
            if (door.isSecondFloorDoor && playerHeight < 3.0) {
                continue; // Don't check second floor doors for first floor players
            }
            
            // Skip first floor doors if player is on second floor
            if (!door.isSecondFloorDoor && playerHeight > 3.0) {
                continue; // Don't check first floor doors for second floor players
            }
            
            const doorLeft = door.position.x - 1.1;
            const doorRight = door.position.x + 1.1;
            const doorTop = door.position.z - 0.15;
            const doorBottom = door.position.z + 0.15;
            
            const playerLeft = playerX - playerRadius;
            const playerRight = playerX + playerRadius;
            const playerTop = playerZ - playerRadius;
            const playerBottom = playerZ + playerRadius;
            
            if (playerRight > doorLeft && 
                playerLeft < doorRight && 
                playerBottom > doorTop && 
                playerTop < doorBottom) {
                return true; // Collision with closed door
            }
        }
    }
    
    return false; // No collision
}


// Add ceiling collision detection function
function checkCeilingCollision(playerX, playerY, playerZ, playerRadius, playerHeight) {
    // Check room ceilings (height = 10 units)
    const roomCeilingHeight = 10;
    
    // Check if player is inside any room and hitting ceiling
    for (const wall of walls) {
        if (!wall.isStair) { // Only check room walls, not stairs
            const withinX = playerX >= wall.x - wall.width/2 && playerX <= wall.x + wall.width/2;
            const withinZ = playerZ >= wall.z - wall.depth/2 && playerZ <= wall.z + wall.depth/2;
            
            if (withinX && withinZ) {
                // Player is inside a room, check ceiling collision
                if (playerY + playerHeight >= roomCeilingHeight) {
                    return roomCeilingHeight - playerHeight; // Return max allowed Y position
                }
            }
        }
    }
    
    // Check second floor ceiling
    if (isOnSecondFloor(playerX, playerZ)) {
        const secondFloorCeilingHeight = 14; // 10 units above second floor (4 + 10)
        if (playerY + playerHeight >= secondFloorCeilingHeight) {
            return secondFloorCeilingHeight - playerHeight;
        }
    }
    
    return null; // No ceiling collision
}

// Create doors for each room
function createDoors() {
    // Library door
    createDoor(19, 0, 4, "Library Door");
    
    // Classroom door A
    createDoor(11, 0, 4, "Classroom A Door");
    // Classroom door B
    createDoor(8, 0, -9, "Classroom B Door");
    // Classroom door C
    createDoor(-1, 0, -9, "Classroom C Door");

    // Principal's office door
    createDoor(4, 0, 4, "Office Door");
    createDoor(-2, 0, 4, "Head Office Door");
    // Cafeteria door
    createDoor(18, 0, -9, "Locker Door");
    createDoor(-15, 0, 4, "Cafeteria Door");
}

function createDoor(x, y, z, name) {
    const textureLoader = new THREE.TextureLoader();
    const doorTexture = textureLoader.load('textures/door.jpg'); // 🔑 Your door image here

    doorTexture.wrapS = doorTexture.wrapT = THREE.RepeatWrapping;
    doorTexture.repeat.set(1, 1); // optional, adjust if you want to tile the door image

    const doorMaterial = new THREE.MeshStandardMaterial({
        map: doorTexture,
        roughness: 0.6
    });

    // Same geometry and position
    const doorGeometry = new THREE.BoxGeometry(2.2, 5, 0.3);
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(x, y + 1.5, z);
    door.castShadow = true;
    door.receiveShadow = true;

    // Door logic unchanged
    door.isOpen = false;
    door.originalPosition = { x: x, y: y + 1.5, z: z };
    door.openPosition = { x: x + 2, y: y + 1.5, z: z }; // Slide to open
    door.name = name;
    door.isAnimating = false;

    scene.add(door);
    doors.push(door);
}


function openDoor(door) {
    if (door.isOpen || door.isAnimating) return;
    
    door.isOpen = true;
    door.isAnimating = true;
    
    // Animate door opening (slide to the right)
    const startPos = door.position.clone();
    const endPos = new THREE.Vector3(door.openPosition.x, door.openPosition.y, door.openPosition.z);
    
    animateDoor(door, startPos, endPos, 300); // Faster animation (300ms)
    showMessage(`${door.name} opened`);
    
    // Emit door state change to other players
    socket.emit('doorStateChange', {
        doorName: door.name,
        isOpen: true,
        position: {
            x: door.openPosition.x,
            y: door.openPosition.y,
            z: door.openPosition.z
        }
    });
}

function closeDoor(door) {
    if (!door.isOpen || door.isAnimating) return;
    
    door.isOpen = false;
    door.isAnimating = true;
    
    // Animate door closing (slide back to original position)
    const startPos = door.position.clone();
    const endPos = new THREE.Vector3(door.originalPosition.x, door.originalPosition.y, door.originalPosition.z);
    
    animateDoor(door, startPos, endPos, 300); // Faster animation (300ms)
    showMessage(`${door.name} closed`);
    
    // Emit door state change to other players
    socket.emit('doorStateChange', {
        doorName: door.name,
        isOpen: false,
        position: {
            x: door.originalPosition.x,
            y: door.originalPosition.y,
            z: door.originalPosition.z
        }
    });
}

function animateDoor(door, startPos, endPos, duration) {
    const startTime = Date.now();
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Smooth easing function
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        // Interpolate position
        door.position.lerpVectors(startPos, endPos, easeProgress);
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            door.isAnimating = false; // Animation complete
        }
    }
    
    animate();
}

// Store walls for collision detection
let walls = [];

function createSchool() {
// Load textures
const textureLoader = new THREE.TextureLoader();

const wallTexture = textureLoader.load('textures/wall.jpg');
wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
wallTexture.repeat.set(50, 1); // Play with these numbers!

const floorTexture = textureLoader.load('textures/floor.jpg');
floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
floorTexture.repeat.set(50, 50);

const wallMaterial = new THREE.MeshStandardMaterial({
  map: wallTexture,
  roughness: 0.7
});

const floorMaterial = new THREE.MeshStandardMaterial({
  map: floorTexture,
  roughness: 0.5,
  metalness: 0.1
});




    // Clear walls array
    walls = [];

    // Main floor
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(50, 50),
        floorMaterial
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Create rooms
    createRoom(18, 0, -14, 10, 4, 10, Math.PI); // Library 
    createRoom(8, 0, -14, 10, 4, 10, Math.PI); // Classroom B
    createRoom(-1, 0, -14, 10, 4, 10, Math.PI); // Classroom C
    createRoom(11, 0, 10, 8, 4, 12); // Classroom A
    createRoom(-15, 0, 11.5, 20, 4, 15); // Cafeteria room
    createRoom(4, 0, 8, 6, 4, 8); // Principal's office
    createRoom(-2, 0, 8, 6, 4, 8 );// Head office
    createRoom(19, 0, 8, 8, 4, 8); // Cafeteria room

    // Create central staircase - moved away from spawn point
    createStaircase(-22.5, 0, -14, Math.PI);

    // Create second floor rooms
    createSecondFloor();

    // Create walls around the school
    const wallThickness = 0.2;
    const wallHeight = 15;
    const wallsData = [
        { x: 0, y: wallHeight / 2, z: -25, width: 50, depth: wallThickness }, // Back wall
        { x: 0, y: wallHeight / 2, z: 25, width: 55, depth: wallThickness }, // Front wall
        { x: -25, y: wallHeight / 2, z: 0, width: wallThickness, depth: 50 }, // Left wall
        { x: 25, y: wallHeight / 2, z: 0, width: wallThickness, depth: 50 } // Right wall
    ];
    wallsData.forEach(data => {
        const wall = new THREE.Mesh(
            new THREE.BoxGeometry(data.width, wallHeight, data.depth),
            wallMaterial
        );
        wall.position.set(data.x, data.y, data.z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        scene.add(wall);
        
        // Add to walls array for collision detection
        walls.push({
            x: data.x,
            z: data.z,
            width: data.width,
            depth: data.depth,
            isBoundaryWall: true // Mark as boundary wall so it's always checked for collision
        });
    }
    );
}

function createRoom(x, y, z, width, height, depth, rotationY = 0) {
    const textureLoader = new THREE.TextureLoader();
    const wallTexture = textureLoader.load('textures/schoolwall.jpg');
    wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(1, 1); // adjust for better tiling

    const wallMaterial = new THREE.MeshStandardMaterial({
        map: wallTexture,
        roughness: 0.7
    });

    const roomGroup = new THREE.Group();

    // Back wall
    const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, 0.2),
        wallMaterial
    );
    backWall.position.set(0, height / 2, depth / 2);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    roomGroup.add(backWall);

    // Front wall with door opening
    const frontWallLeft = new THREE.Mesh(
        new THREE.BoxGeometry((width - 2) / 2, height, 0.2),
        wallMaterial
    );
    frontWallLeft.position.set(-width / 4 - 0.5, height / 2, -depth / 2);
    frontWallLeft.castShadow = true;
    frontWallLeft.receiveShadow = true;
    roomGroup.add(frontWallLeft);

    const frontWallRight = new THREE.Mesh(
        new THREE.BoxGeometry((width - 2) / 2, height, 0.2),
        wallMaterial
    );
    frontWallRight.position.set(width / 4 + 0.5, height / 2, -depth / 2);
    frontWallRight.castShadow = true;
    frontWallRight.receiveShadow = true;
    roomGroup.add(frontWallRight);

    // Side walls
    const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, height, depth),
        wallMaterial
    );
    leftWall.position.set(-width / 2, height / 2, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    roomGroup.add(leftWall);

    const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, height, depth),
        wallMaterial
    );
    rightWall.position.set(width / 2, height / 2, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    roomGroup.add(rightWall);

    // Position and rotate the entire room group
    roomGroup.position.set(x, y, z);
    roomGroup.rotation.y = rotationY;

    scene.add(roomGroup);

    // Same collision logic
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);

    const wallPositions = [
        { localX: 0, localZ: depth / 2, width: width, depth: 0.2 }, // back wall
        { localX: -width / 4 - 1, localZ: -depth / 2, width: (width - 2) / 2, depth: 0.2 }, // front left
        { localX: width / 4 + 1, localZ: -depth / 2, width: (width - 2) / 2, depth: 0.2 }, // front right
        { localX: -width / 2, localZ: 0, width: 0.2, depth: depth }, // left wall
        { localX: width / 2, localZ: 0, width: 0.2, depth: depth } // right wall
    ];

    wallPositions.forEach(wall => {
        const rotatedX = wall.localX * cos - wall.localZ * sin;
        const rotatedZ = wall.localX * sin + wall.localZ * cos;

        walls.push({
            x: x + rotatedX,
            z: z + rotatedZ,
            width: wall.width,
            depth: wall.depth
        });
    });

    // Keep your label (but note: `name` is undefined in your original)
    const roomLabel = document.createElement('div');
    roomLabel.className = 'room-label';
    roomLabel.textContent = name;
    roomLabel.style.position = 'absolute';
    roomLabel.style.color = '#ffffff';
    roomLabel.style.padding = '5px';
    roomLabel.style.background = 'rgba(0,0,0,0.7)';
    roomLabel.style.borderRadius = '3px';
    document.body.appendChild(roomLabel);
}


function createBasicPlayerModel(isKiller) {
    const group = new THREE.Group();
    
    
    createBasicCharacterGeometry(group, isKiller);
    
    // Create simple flashlight object
    const flashlightGroup = new THREE.Group();
    flashlightGroup.position.set(0.4, 1.2, 0.1);
    flashlightGroup.rotation.x = Math.PI / 6; // Slight downward angle
    flashlightGroup.visible = false; // Initially hidden
    group.add(flashlightGroup);
    
    // Store reference to flashlight for easy access
    group.userData.flashlightObject = flashlightGroup;
    
    
    createBasicFlashlightGeometry(flashlightGroup);

    return group;
}

                
                // Apply subtle color tint for killers (optional)
                if (isKiller && child.material) {
                    // Create a subtle red tint for killers
                    if (child.material.color) {
                        child.material.color.multiplyScalar(1.1); // Slightly brighter
                        child.material.color.r = Math.min(1, child.material.color.r * 1.2); // Add red tint
                    }
                }
                

                createBasicCharacterGeometry(group, isKiller);

// Fallback function to create basic geometric character
function createBasicCharacterGeometry(characterGroup, isKiller) {
    // Body
    const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: isKiller ? 0xff0000 : 0x00ff00,
        transparent: true,
        opacity: 0.8
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.6;
    characterGroup.add(body);

    // Head
    const headGeometry = new THREE.SphereGeometry(0.25, 8, 8);
    const headMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffdbac,
        transparent: true,
        opacity: 0.8
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.4;
    characterGroup.add(head);

    // Left Arm
    const leftArmGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6);
    const leftArm = new THREE.Mesh(leftArmGeometry, bodyMaterial);
    leftArm.position.set(-0.4, 0.9, 0);
    leftArm.rotation.z = Math.PI / 8;
    characterGroup.add(leftArm);

    // Right Arm
    const rightArmGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6);
    const rightArm = new THREE.Mesh(rightArmGeometry, bodyMaterial);
    rightArm.position.set(0.4, 0.9, 0);
    rightArm.rotation.z = -Math.PI / 8;
    characterGroup.add(rightArm);

    // Left Leg
    const leftLegGeometry = new THREE.CylinderGeometry(0.15, 0.15, 1, 6);
    const leftLeg = new THREE.Mesh(leftLegGeometry, bodyMaterial);
    leftLeg.position.set(-0.15, -0.5, 0);
    characterGroup.add(leftLeg);

    // Right Leg
    const rightLegGeometry = new THREE.CylinderGeometry(0.15, 0.15, 1, 6);
    const rightLeg = new THREE.Mesh(rightLegGeometry, bodyMaterial);
    rightLeg.position.set(0.15, -0.5, 0);
    characterGroup.add(rightLeg);

    // Make all parts cast and receive shadows
    characterGroup.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });
}

// Function to load GLB flashlight model
function loadFlashlightModel(flashlightGroup) {
    const loader = new THREE.GLTFLoader();
    
    // Load the flashlight GLB model from the models directory
    loader.load('models/flashlight.glb', (gltf) => {
        const flashlightModel = gltf.scene;
        
        // Scale the model if needed
        flashlightModel.scale.set(0.1, 0.1, 0.1); // Adjust scale as needed
        
        // Position and rotate the model as needed
        flashlightModel.position.set(0, 0, 0);
        flashlightModel.rotation.set(0, 0, 0);
        
        // Enable shadows for the model
        flashlightModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        // Add the model to the flashlight group
        flashlightGroup.add(flashlightModel);
        
        console.log('Flashlight GLB model loaded successfully');
    }, (progress) => {
        console.log('Loading flashlight model:', (progress.loaded / progress.total * 100) + '% loaded');
    }, (error) => {
        console.error('Error loading flashlight GLB model:', error);
        console.log('Falling back to basic geometric flashlight');
        
        // Fallback to basic geometric flashlight if GLB fails to load
        createBasicFlashlightGeometry(flashlightGroup);
    });
}

// Fallback function to create basic geometric flashlight
function createBasicFlashlightGeometry(flashlightGroup) {
    // Flashlight body (cylinder)
    const flashlightBodyGeometry = new THREE.CylinderGeometry(0.03, 0.04, 0.3, 8);
    const flashlightBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const flashlightBody = new THREE.Mesh(flashlightBodyGeometry, flashlightBodyMaterial);
    flashlightGroup.add(flashlightBody);
    
    // Flashlight lens (front)
    const lensGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.02, 8);
    const lensMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffaa, 
        emissive: 0x222200,
        transparent: true,
        opacity: 0.8
    });
    const lens = new THREE.Mesh(lensGeometry, lensMaterial);
    lens.position.y = 0.16;
    flashlightGroup.add(lens);
    
    // Enable shadows
    flashlightBody.castShadow = true;
    flashlightBody.receiveShadow = true;
    lens.castShadow = true;
    lens.receiveShadow = true;
}

function eliminatePlayerInSight() {
    if (!isKiller) {
        showMessage('Only killers can eliminate players!');
        return;
    }

    if (!killerCanEliminate) {
        showMessage('Elimination not available! Wait for the cooldown to finish.');
        return;
    }
    
    // Use raycaster to find player in sight
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera); // Center of screen
    
    // Get all player meshes and their children (excluding self)
    const targetableMeshes = [];
    Object.values(players).forEach(playerObj => {
        if (playerObj !== player && playerObj.userData && playerObj.userData.id !== socket.id) {
            console.log('Adding player to targetable:', playerObj.userData);
            playerObj.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    // Ensure userData is properly set
                    child.userData = {
                        ...child.userData,
                        playerId: playerObj.userData.id,
                        playerName: playerObj.userData.name
                    };
                    targetableMeshes.push(child);
                }
            });
        }
    });
    
    console.log('Targetable meshes:', targetableMeshes.length);
    
    const intersects = raycaster.intersectObjects(targetableMeshes, true); // Include children
    
    console.log('Intersections found:', intersects.length);
    
    if (intersects.length > 0) {
        const target = intersects[0].object;
        const distance = intersects[0].distance;
        
        console.log('Target found:', target.userData, 'Distance:', distance);
        
        // Check if target is within elimination range
        if (distance <= 15) { // Increased range for easier targeting
            const targetPlayerId = target.userData.playerId || target.userData.id;
            if (targetPlayerId) {
                console.log('Eliminating player:', targetPlayerId);
                socket.emit('killerEliminate', targetPlayerId);
                showMessage(`Player ${target.userData.playerName || 'Unknown'} eliminated!`);
            } else {
                showMessage('Invalid target - no player ID found!');
            }
        } else {
            showMessage(`Target too far away! Distance: ${distance.toFixed(1)} (max: 15)`);
        }
    } else {
        showMessage('No player in sight! Look directly at a player and try again.');
    }
}

function showEliminationCountdown() {
    console.log('showEliminationCountdown called');
    console.log('Socket connected:', socket.connected);
    console.log('Socket id:', socket.id);
    // Request current timer status from server
    console.log('Emitting requestTimerStatus event');
    socket.emit('requestTimerStatus');
    console.log('requestTimerStatus event emitted');
}

// Handle timer status response
socket.on('timerStatus', (data) => {
    console.log('timerStatus received:', data);
    if (isKiller) {
        const timeString = `${data.minutes}:${data.seconds.toString().padStart(2, '0')}`;
        if (data.canEliminate) {
            showMessage('ELIMINATION READY! Press K to eliminate a player.');
        } else {
            showMessage(`${timeString} (${data.minutes} minutes ${data.seconds} seconds)`);
        }
    }
});

function showNotification(message, type = 'info') {
    const notificationsContainer = document.getElementById('notifications');
    if (!notificationsContainer) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notificationsContainer.appendChild(notification);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

function displayCipherKey() {
    cipherKeyDisplay.innerHTML = '';
    for (let letter in cipherKey) {
        const div = document.createElement('div');
        div.textContent = `${letter} → ${cipherKey[letter]}`;
        cipherKeyDisplay.appendChild(div);
    }
}

// Add error message handler for wrong solutions
socket.on('clueFailed', () => {
    console.log('Received clueFailed event from server');
    
    // Show error message in cipher tool
    const errorMessage = document.getElementById('errorMessage');
    console.log('Error message element found:', errorMessage);
    if (errorMessage) {
        console.log('Adding visible class to error message');
        errorMessage.classList.add('visible');
        errorMessage.style.color = '#ff4444';
        errorMessage.textContent = 'Wrong decryption! Try again.';
        console.log('Error message classes:', errorMessage.classList.toString());
        console.log('Error message display style:', window.getComputedStyle(errorMessage).display);
        
        // Hide error message after 3 seconds
        setTimeout(() => {
            console.log('Removing visible class from error message');
            errorMessage.classList.remove('visible');
        }, 3000);
    } else {
        console.error('Error message element not found!');
    }
    
    // Show notification for wrong answer
    console.log('Calling showNotification');
    showNotification('Wrong decryption! Check your cipher key and try again.', 'error');
    
    // Clear the input field so user can try again
    if (decryptionInput) {
        decryptionInput.value = '';
        decryptionInput.focus();
    }
});

// Event listeners for submit and close buttons are now handled in DOMContentLoaded above

// Add Enter key support for cipher input
decryptionInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        submitDecryption.click();
    }
});

// Create physical staircase that players can walk up
function createStaircase(x, y, z) {
    const stairMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const stepHeight = 0.2;
    const stepDepth = 0.8;
    const stepWidth = 4;
    const numSteps = 20;
    
    // Create staircase group
    const staircaseGroup = new THREE.Group();
    
    // Create individual steps
    for (let i = 0; i < numSteps; i++) {
        const stepGeometry = new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth);
        const step = new THREE.Mesh(stepGeometry, stairMaterial);
        
        step.position.set(0, (i + 1) * stepHeight, i * stepDepth - (numSteps * stepDepth) / 2);
        step.castShadow = true;
        step.receiveShadow = true;
        
        staircaseGroup.add(step);
    }
    
    // Create handrails that follow the stair slope
    const railMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const railHeight = 2;
    const railWidth = 0.15; // Made slightly thicker for better collision
    const totalStairLength = numSteps * stepDepth;
    const totalStairHeight = numSteps * stepHeight;
    
    // Calculate the angle of the stairs for proper handrail slope
    const stairAngle = Math.atan(totalStairHeight / totalStairLength);
    
    // Calculate handrail length along the slope
    const railLength = Math.sqrt(totalStairLength * totalStairLength + totalStairHeight * totalStairHeight);
    
    const leftRailGeometry = new THREE.BoxGeometry(railWidth, railHeight, railLength);
    const leftRail = new THREE.Mesh(leftRailGeometry, railMaterial);
    
    leftRail.position.set(-stepWidth/2 - 0, totalStairHeight / 2, 0);
    
    leftRail.rotation.x = -stairAngle; 
    leftRail.rotation.y = 0; 
    
    leftRail.castShadow = true;
    leftRail.receiveShadow = true;
    staircaseGroup.add(leftRail);
    
    const rightRailGeometry = new THREE.BoxGeometry(railWidth, railHeight, railLength);
    const rightRail = new THREE.Mesh(rightRailGeometry, railMaterial);
    
    rightRail.position.set(stepWidth/2 + 0, totalStairHeight / 2, 0);
    
    
    rightRail.rotation.x = -stairAngle;
    rightRail.rotation.y = 0; 
    
    rightRail.castShadow = true;
    rightRail.receiveShadow = true;
    staircaseGroup.add(rightRail);
    
    // Create platform at the top of the stairs for second floor
    const platformWidth = stepWidth + 6; // Slightly wider than stairs
    const platformDepth = 6; // Platform depth
    const platformHeight = 0.2; // Platform thickness
    const platformGeometry = new THREE.BoxGeometry(platformWidth, platformHeight, platformDepth);
    const platform = new THREE.Mesh(platformGeometry, stairMaterial);
    
    // Position platform at the top of the stairs
    platform.position.set(0, numSteps * stepHeight + platformHeight/2, (numSteps * stepDepth) / 2 + platformDepth/2);
    platform.castShadow = true;
    platform.receiveShadow = true;
    staircaseGroup.add(platform);
    
    // Rotate the entire staircase 180 degrees to face away from cafeteria
    staircaseGroup.rotation.y = Math.PI;
    
    // Position the entire staircase
    staircaseGroup.position.set(x, y, z);
    scene.add(staircaseGroup);
    
    // Add step surfaces to collision detection as walkable surfaces (with rotation applied)
    for (let i = 0; i < numSteps; i++) {
        // Apply rotation to step positions
        const localZ = i * stepDepth - (numSteps * stepDepth) / 2;
        const rotatedZ = -localZ; // 180 degree rotation flips Z
        
        walls.push({
            x: x,
            z: z + rotatedZ,
            width: stepWidth,
            depth: stepDepth,
            height: (i + 1) * stepHeight,
            isStair: true
        });
    }
    
    // Add platform collision detection (with rotation applied)
    const platformLocalZ = (numSteps * stepDepth) / 2 + platformDepth/2;
    const rotatedPlatformZ = -platformLocalZ; // Apply 180 degree rotation
    walls.push({
        x: x,
        z: z + rotatedPlatformZ,
        width: platformWidth,
        depth: platformDepth,
        height: numSteps * stepHeight + platformHeight,
        isStair: true // Treat platform as walkable like stairs
    });
    
    // Add handrail collision detection to prevent players from falling through
    // Left handrail collision (with staircase rotation applied)
    for (let i = 0; i < numSteps; i++) {
        const stepZ = i * stepDepth - (numSteps * stepDepth) / 2;
        const rotatedStepZ = -stepZ; // Apply 180 degree rotation
        const stepY = (i + 1) * stepHeight;
        
        walls.push({
            x: x + (-stepWidth/2 - 0.3) * Math.cos(Math.PI), // Apply staircase rotation
            z: z + rotatedStepZ,
            width: railWidth,
            depth: stepDepth,
            height: stepY + railHeight,
            isHandrail: true
        });
    }
    
    // Right handrail collision (with staircase rotation applied)
    for (let i = 0; i < numSteps; i++) {
        const stepZ = i * stepDepth - (numSteps * stepDepth) / 2;
        const rotatedStepZ = -stepZ; // Apply 180 degree rotation
        const stepY = (i + 1) * stepHeight;
        
        walls.push({
            x: x + (stepWidth/2 + 0.3) * Math.cos(Math.PI), // Apply staircase rotation
            z: z + rotatedStepZ,
            width: railWidth,
            depth: stepDepth,
            height: stepY + railHeight,
            isHandrail: true
        });
    }
}

// Create second floor with rooms
function createSecondFloor() {
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const stepHeight = 0.2;
    const numSteps = 20;
    const secondFloorHeight = numSteps * stepHeight;
    const floorThickness = 0.2;

    const secondFloorWidth = 55;
    const secondFloorDepth = 25;

    const secondFloorGeometry = new THREE.BoxGeometry(secondFloorWidth, floorThickness, secondFloorDepth);
    const secondFloor = new THREE.Mesh(secondFloorGeometry, floorMaterial);
    secondFloor.position.set(10, secondFloorHeight + floorThickness / 2, -16.5);
    secondFloor.castShadow = true;
    secondFloor.receiveShadow = true;
    scene.add(secondFloor);

    walls.push({
        x: 10,
        z: -16.5,
        width: secondFloorWidth,
        depth: secondFloorDepth,
        height: secondFloorHeight,
        isStair: true,
        isSecondFloor: true
    });

    const libraryPlatformWidth = 83;
    const libraryPlatformDepth = 30;

    const libraryPlatformGeometry = new THREE.BoxGeometry(libraryPlatformWidth, floorThickness, libraryPlatformDepth);
    const libraryPlatform = new THREE.Mesh(libraryPlatformGeometry, floorMaterial);
    libraryPlatform.position.set(-15, secondFloorHeight + floorThickness / 2, 10);
    libraryPlatform.castShadow = true;
    libraryPlatform.receiveShadow = true;
    scene.add(libraryPlatform);

    walls.push({
        x: -15,
        z: 10,
        width: libraryPlatformWidth,
        depth: libraryPlatformDepth,
        height: secondFloorHeight,
        isStair: true,
        isSecondFloor: true
    });

    // === Rooms ===
    createSecondFloorRoom(7.2, secondFloorHeight, -21.5, 12, 6, 8, "Second Floor Library", Math.PI);
    createSecondFloorRoom(19.2, secondFloorHeight, -21.5, 12, 6, 8, "Second Floor Computer Lab", Math.PI);
    createSecondFloorRoom(-4.2, secondFloorHeight, -21.5, 12, 6, 8, "Second Floor Study Hall", Math.PI);
    createSecondFloorRoom(17, secondFloorHeight, 15, 15, 6, 25, "Second Floor Conference Room");
    createSecondFloorRoom(2, secondFloorHeight, 15, 15, 6, 25, "Second Floor Teacher's Lounge");
    createSecondFloorRoom(-15, secondFloorHeight, 15, 19, 6, 25, "Second Floor Art Room");

    // === Doors ===
    createSecondFloorDoor(5, secondFloorHeight, -17.5, "Second Floor Library Door");
    createSecondFloorDoor(20, secondFloorHeight, -17.5, "Second Floor Computer Lab Door");
    createSecondFloorDoor(35, secondFloorHeight, -17.5, "Second Floor Study Hall Door");
    createSecondFloorDoor(17, secondFloorHeight, 2.5, "Second Floor Conference Room Door");
    createSecondFloorDoor(2, secondFloorHeight, 2.5, "Second Floor Teacher's Lounge Door");
    createSecondFloorDoor(-15, secondFloorHeight, 2.5, "Second Floor Art Room Door");

    const loader = new THREE.GLTFLoader();

   
for (let i = 0; i < 3; i++) {
  loader.load('models/bookshelf.glb', (gltf) => {
    const shelf = gltf.scene;
    shelf.scale.set(1, 1, 1);
    shelf.position.set(1 + i * 3, secondFloorHeight, -21);
    shelf.rotation.y = 0; 
    scene.add(shelf);
  });
}

for (let i = 0; i < 3; i++) {
  loader.load('models/computer_desk.glb', (gltf) => {
    const desk = gltf.scene;
    desk.scale.set(1, 1, 1);
    desk.position.set(20 + i * 3, secondFloorHeight, -24);
    desk.rotation.y = 0; 
    scene.add(desk);
  });
}


for (let i = 0; i < 2; i++) {
  loader.load('models/table.glb', (gltf) => {
    const table = gltf.scene;
    table.scale.set(0.7, 0.7, 0.7);
    table.position.set(35, secondFloorHeight, -25 + i * 3);
    scene.add(table);
  });

  loader.load('models/chair.glb', (gltf) => {
    const chair = gltf.scene;
    chair.scale.set(0.7, 0.7, 0.7);
    chair.position.set(35, secondFloorHeight, -25 + i * 3 - 1.5);
    chair.rotation.y = 0;
    scene.add(chair);
  });
}

// conference
loader.load('models/conference_table.glb', (gltf) => {
  const conferenceTable = gltf.scene;
  conferenceTable.scale.set(0.5, 0.5, 0.5);
  conferenceTable.position.set(22, secondFloorHeight, 15);
  conferenceTable.rotation.y = -Math.PI / 2; 
  scene.add(conferenceTable);
});

// Teacher's Lounge chairs 
for (let i = 0; i < 2; i++) {
  loader.load('models/lounge_chair.glb', (gltf) => {
    const lounge = gltf.scene;
    lounge.scale.set(2, 2, 2);
    lounge.position.set(2 + i * 2, secondFloorHeight, 16);
    lounge.rotation.y = Math.PI; // turn around to face door at front
    scene.add(lounge);
  });
}

// Art Room work tables 
for (let i = 0; i < 2; i++) {
  loader.load('models/art_table.glb', (gltf) => {
    const artTable = gltf.scene;
    artTable.scale.set(1.5, 1.5, 1.5);
    artTable.position.set(-18 + i * 6, secondFloorHeight, 16);
    artTable.rotation.y = Math.PI / 2; 
    scene.add(artTable);
  });
}
}



// Second floor rooms Function
function createSecondFloorRoom(x, y, z, width, height, depth, name, rotationY = 0) {
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x606060 });
    
    // Create a group to hold all room parts
    const roomGroup = new THREE.Group();
    
    // Back wall
    const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, 0.2),
        wallMaterial
    );
    backWall.position.set(0, height/2, depth/2);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    roomGroup.add(backWall);

    // Front wall with door opening
    const frontWallLeft = new THREE.Mesh(
        new THREE.BoxGeometry((width-2.5)/2, height, 0.2),
        wallMaterial
    );
    frontWallLeft.position.set(-width/4 - 0.625, height/2, -depth/2);
    frontWallLeft.castShadow = true;
    frontWallLeft.receiveShadow = true;
    roomGroup.add(frontWallLeft);

    const frontWallRight = new THREE.Mesh(
        new THREE.BoxGeometry((width-2.5)/2, height, 0.2),
        wallMaterial
    );
    frontWallRight.position.set(width/4 + 0.625, height/2, -depth/2);
    frontWallRight.castShadow = true;
    frontWallRight.receiveShadow = true;
    roomGroup.add(frontWallRight);

    // Side walls
    const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, height, depth),
        wallMaterial
    );
    leftWall.position.set(-width/2, height/2, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    roomGroup.add(leftWall);

    const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, height, depth),
        wallMaterial
    );
    rightWall.position.set(width/2, height/2, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    roomGroup.add(rightWall);

    // Position and rotate the entire room group
    roomGroup.position.set(x, y, z);
    roomGroup.rotation.y = rotationY;
    scene.add(roomGroup);

    // Add walls to collision detection for second floor rooms (need to calculate rotated positions)
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);
    
    const wallPositions = [
        { localX: 0, localZ: depth/2, width: width, depth: 0.2 }, // back wall
        { localX: -width/4 - 1.25, localZ: -depth/2, width: (width-2.5)/2, depth: 0.2 }, // front left
        { localX: width/4 + 1.25, localZ: -depth/2, width: (width-2.5)/2, depth: 0.2 }, // front right
        { localX: -width/2, localZ: 0, width: 0.2, depth: depth }, // left wall
        { localX: width/2, localZ: 0, width: 0.2, depth: depth } // right wall
    ];
    
    wallPositions.forEach(wall => {
        const rotatedX = wall.localX * cos - wall.localZ * sin;
        const rotatedZ = wall.localX * sin + wall.localZ * cos;
        
        walls.push({
            x: x + rotatedX,
            z: z + rotatedZ,
            width: wall.width,
            depth: wall.depth,
            height: y + height, // Include the floor height
            isSecondFloorRoom: true // Mark as second floor room wall
        });
    });
}

// Function to create second floor doors
function createSecondFloorDoor(x, y, z, name) {
    const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x654321 }); // Darker brown for second floor doors
    
    // Create door geometry
    const doorGeometry = new THREE.BoxGeometry(2.5, 4, 0.3);
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(x, y + 2, z);
    door.castShadow = true;
    door.receiveShadow = true;
    
    
    door.isOpen = false;
    door.originalPosition = { x: x, y: y + 2, z: z };
    door.openPosition = { x: x + 2.5, y: y + 2, z: z }; // Slide to the right when open
    door.name = name;
    door.isAnimating = false;
    door.isSecondFloorDoor = true; 
    
    scene.add(door);
    doors.push(door);
}

// Helper function to get stair height at player position
function getStairHeight(x, z) {
    let bestStairHeight = null;
    let closestDistance = Infinity;
    const currentPlayerHeight = player ? player.position.y : 1.0;
    
    for (const wall of walls) {
        if (wall.isStair) {
            const margin = 0.3; // Increased margin for better step detection
            const withinX = x >= (wall.x - wall.width/2 - margin) && x <= (wall.x + wall.width/2 + margin);
            const withinZ = z >= (wall.z - wall.depth/2 - margin) && z <= (wall.z + wall.depth/2 + margin);
            
            if (withinX && withinZ) {
                if (wall.isSecondFloor) {
                    // Only use second floor platforms if player is already high enough
                    if (currentPlayerHeight >= 3.5) {
                        return wall.height;
                    }
                    continue;
                }
                
                // Calculate the height where the player should be standing on this step
                const stepHeight = wall.height + 0.9; // Add player height offset
                const heightDifference = Math.abs(currentPlayerHeight - stepHeight);
                
                // More lenient threshold for step detection to prevent sudden jumps
                const maxStepDifference = 0.8; // Increased from 0.5 for smoother transitions
                
                // Prioritize steps that are closest to the player's current height
                if (heightDifference <= maxStepDifference) {
                    // Use distance-based selection for smoother transitions
                    if (heightDifference < closestDistance) {
                        closestDistance = heightDifference;
                        bestStairHeight = wall.height;
                    }
                }
                
                // Special handling for upward movement - allow stepping onto higher steps
                else if (stepHeight > currentPlayerHeight && stepHeight - currentPlayerHeight <= 0.4) {
                    const upwardDifference = stepHeight - currentPlayerHeight;
                    // Prefer closer steps for upward movement
                    if (upwardDifference < closestDistance) {
                        closestDistance = upwardDifference;
                        bestStairHeight = wall.height;
                    }
                }
                
                // Special handling for downward movement - allow stepping down to lower steps
                else if (stepHeight < currentPlayerHeight && currentPlayerHeight - stepHeight <= 0.6) {
                    const downwardDifference = currentPlayerHeight - stepHeight;
                    // Prefer closer steps for downward movement
                    if (downwardDifference < closestDistance) {
                        closestDistance = downwardDifference;
                        bestStairHeight = wall.height;
                    }
                }
            }
        }
    }
    
    return bestStairHeight;
}


// Helper function to check if player is on second floor
function isOnSecondFloor(x, z) {
    // Check if player is on the actual second floor platform
    for (const wall of walls) {
        if (wall.isStair && wall.isSecondFloor) {
            const withinX = x >= wall.x - wall.width/2 && x <= wall.x + wall.width/2;
            const withinZ = z >= wall.z - wall.depth/2 && z <= wall.z + wall.depth/2;
            
            if (withinX && withinZ) {
                return true;
            }
        }
    }
    
    return false;
}
