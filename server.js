const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve static files from public directory
app.use(express.static('public'));

// Game state
let gameState = {
    groups: [],
    killer: null,
        clues: [
            { id: 1, location: "Cafeteria", message: "KILLER AVOIDS GROUPS", encrypted: "NLOOHU DYRLGV JURXSV" },
            { id: 2, location: "classroom", message: "KILLER WATCHES OTHERS", encrypted: "NLOOHU ZDWFKHV RWKHUV" },
            { id: 3, location: "office", message: "KILLER STAYS IN SHADOWS", encrypted: "NLOOHU VWDBV LQ VKDGRZV" },
            { id: 4, location: "second floor library", message: "KILLER HUNTS ALONE", encrypted: "NLOOHU KXQWV DORQH" },
            { id: 5, location: "conference room", message: "KILLER STRIKES QUIETLY", encrypted: "NLOOHU VWULNHV TXLHWOB" },
            { id: 6, location: "art room", message: "KILLER MOVES UNSEEN", encrypted: "NLOOHU PRYHV XQVHHQ" }
        ],
    eliminationTimer: 60000, // 1 minute (60 seconds)
    nextEliminationTime: null,
    eliminationInterval: null,
    gameStarted: false,
    killerCanEliminate: false,
    minPlayers: 3, // Minimum players to start the game
    countdownTime: 10,
    countdownInterval: null
};

// Cipher key (Caesar cipher with shift of 3)
const cipherKey = {
    'A': 'D', 'B': 'E', 'C': 'F', 'D': 'G', 'E': 'H', 'F': 'I', 'G': 'J', 'H': 'K', 'I': 'L', 'J': 'M',
    'K': 'N', 'L': 'O', 'M': 'P', 'N': 'Q', 'O': 'R', 'P': 'S', 'Q': 'T', 'R': 'U', 'S': 'V', 'T': 'W',
    'U': 'X', 'V': 'Y', 'W': 'Z', 'X': 'A', 'Y': 'B', 'Z': 'C'
};

// Countdown before starting the game
function startGameCountdown() {
    let timeLeft = gameState.countdownTime;
    io.emit('countdownStarted', timeLeft);

    gameState.countdownInterval = setInterval(() => {
        timeLeft--;
        io.emit('countdownUpdate', timeLeft);

        if (timeLeft <= 0) {
            clearInterval(gameState.countdownInterval);
            startGame();
        }
    }, 1000);
}

function startGame() {
    if (gameState.groups.length < gameState.minPlayers) {
        console.log('Not enough players to start game');
        gameState.gameStarted = false;
        return;
    }

    const randomIndex = Math.floor(Math.random() * gameState.groups.length);
    gameState.killer = gameState.groups[randomIndex].id;

    gameState.groups = gameState.groups.map(group => ({
        ...group,
        isKiller: group.id === gameState.killer,
        publicData: {
            id: group.id,
            name: group.name,
            eliminated: group.eliminated,
            position: group.position
        }
    }));

    gameState.gameStarted = true;
    // Initialize killer state but don't allow elimination until timer completes
    gameState.killerCanEliminate = false;
    gameState.nextEliminationTime = null;

    gameState.groups.forEach(group => {
        io.to(group.id).emit('gameJoined', {
            isKiller: group.id === gameState.killer,
            groupId: group.id,
            cipherKey: cipherKey
        });
    });

    io.emit('updatePlayers', gameState.groups.map(g => g.publicData));
    io.emit('gameStarting');
}

io.on('connection', (socket) => {
    console.log('A user connected');

socket.on('joinGame', (groupName) => {
        if (gameState.gameStarted) {
            socket.emit('gameFull', 'Game already in progress. Please wait for the current game to finish.');
            return;
        }

        if (gameState.groups.length < 7) {
            gameState.groups.push({
                id: socket.id,
                name: groupName,
                isKiller: false,
                eliminated: false,
                position: { x: 0, y: 0, z: 0 },
                solvedClues: []
            });

            io.emit('waitingRoomUpdate', {
                players: gameState.groups.map(g => g.name),
                playersNeeded: Math.max(0, gameState.minPlayers - gameState.groups.length)
            });

            if (gameState.groups.length >= gameState.minPlayers) {
                startGameCountdown();
            }
        } else {
            socket.emit('gameFull', 'Game is full');
        }
    });

    socket.on('playerMove', (position) => {
        if (!gameState.gameStarted) return;

        const player = gameState.groups.find(g => g.id === socket.id);
        if (player) {
            player.position = position;
            io.emit('playerMoved', {
                id: socket.id,
                position: position
            });
        }
    });

    socket.on('interactClue', (clueId) => {
        if (!gameState.gameStarted) return;

        const clue = gameState.clues.find(c => c.id === clueId);
        const player = gameState.groups.find(g => g.id === socket.id);

        if (clue && player && !player.isKiller && !player.eliminated) {
            socket.emit('clueData', clue);
        }
    });

    socket.on('solveClue', (data) => {
        if (!gameState.gameStarted) return;

        const player = gameState.groups.find(g => g.id === socket.id);
        const clue = gameState.clues.find(c => c.id === data.clueId);

        console.log('Solve clue attempt:', {
            playerId: socket.id,
            playerName: player ? player.name : 'Unknown',
            clueId: data.clueId,
            submittedSolution: data.solution,
            expectedSolution: clue ? clue.message : 'No clue found',
            isMatch: clue && data.solution === clue.message
        });

        if (player && clue) {
            if (data.solution === clue.message) {
                if (!player.solvedClues.includes(data.clueId)) {
                    player.solvedClues.push(data.clueId);
                    socket.emit('clueCorrect', data.clueId);
                    console.log('Clue solved correctly!');

                    // Notify killer about clue progress
                    const totalSolvedClues = gameState.groups.reduce((total, group) => {
                        return total + (group.solvedClues ? group.solvedClues.length : 0);
                    }, 0);
                    
                    const playersWithClues = gameState.groups.filter(group => 
                        group.solvedClues && group.solvedClues.length > 0 && !group.isKiller
                    ).length;
                    
                    // Send detailed progress to killer
                    io.to(gameState.killer).emit('clueProgress', {
                        playerName: player.name,
                        clueId: data.clueId,
                        playerCluesCount: player.solvedClues.length,
                        totalSolvedClues: totalSolvedClues,
                        playersWithClues: playersWithClues,
                        totalPlayers: gameState.groups.filter(g => !g.isKiller && !g.eliminated).length
                    });

                    if (player.solvedClues.length === 3) {
                        io.emit('gameWon', { winner: player.name, type: 'spy' });
                    }
                }
            } else {
                console.log('Clue solution incorrect, sending clueFailed event');
                socket.emit('clueFailed');
            }
        } else {
            console.log('Player or clue not found:', { 
                playerFound: !!player, 
                clueFound: !!clue,
                playerId: socket.id,
                clueId: data.clueId 
            });
        }
    });

socket.on('killerEliminate', (targetId) => {
        console.log(`Elimination attempt by ${socket.id} on ${targetId}, killer: ${gameState.killer}, canEliminate: ${gameState.killerCanEliminate}`);
        if (!gameState.gameStarted) return;

        if (socket.id === gameState.killer && gameState.killerCanEliminate) {
            const target = gameState.groups.find(g => g.id === targetId);
            if (target && !target.isKiller && !target.eliminated) {
                target.eliminated = true;
                // Update public data
                target.publicData.eliminated = true;
                
                gameState.killerCanEliminate = false;
                
                console.log(`Player ${target.name} eliminated by killer`);
                
                // Send elimination message to the eliminated player
                io.to(targetId).emit('playerEliminatedMessage', 'You have been eliminated! Returning to lobby...');
                
                io.emit('playerEliminated', targetId);
                io.emit('updatePlayers', gameState.groups.map(g => g.publicData));
                io.to(gameState.killer).emit('eliminationUsed');

                // Reset elimination timer to 1 minute
                gameState.nextEliminationTime = Date.now() + gameState.eliminationTimer;

                // Return eliminated player to lobby after 3 seconds
                setTimeout(() => {
                    io.to(targetId).emit('returnToLobby');
                }, 3000);

                // Check if killer wins
                const alivePlayers = gameState.groups.filter(g => !g.isKiller && !g.eliminated);
                if (alivePlayers.length === 0) {
                    io.emit('gameWon', { winner: 'Killer', type: 'killer' });
                    resetGame();
                }
            }
        } else {
            console.log(`Elimination failed - isKiller: ${socket.id === gameState.killer}, canEliminate: ${gameState.killerCanEliminate}`);
        }
    });

    socket.on('requestTimerStatus', () => {
        console.log('Received requestTimerStatus. Game started:', gameState.gameStarted);
        
        if (!gameState.gameStarted) {
            console.log('Game not started, returning');
            return;
        }

        // Only allow killer to request timer status
        if (socket.id !== gameState.killer) {
            console.log('Non-killer requesting timer status, ignoring');
            return;
        }

        // If timer hasn't been started yet, start it now
        if (!gameState.nextEliminationTime) {
            console.log('Starting elimination timer for first time');
            gameState.nextEliminationTime = Date.now() + gameState.eliminationTimer;
            startEliminationTimer(); // Start the timer interval to check for completion
        }

        const now = Date.now();
        const timeLeft = gameState.nextEliminationTime ? Math.max(0, gameState.nextEliminationTime - now) : 0;
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);

        // Enable elimination when timer reaches zero
        if (timeLeft <= 0) {
            console.log('Timer reached zero, enabling elimination');
            gameState.killerCanEliminate = true;
            gameState.nextEliminationTime = null;
            io.to(gameState.killer).emit('eliminationReady');
        }

        const timerData = {
            minutes,
            seconds,
            canEliminate: gameState.killerCanEliminate
        };
        
        console.log('Timer status:', {
            timeLeft,
            minutes,
            seconds,
            canEliminate: gameState.killerCanEliminate,
            nextEliminationTime: gameState.nextEliminationTime
        });
        
        console.log('Sending timerStatus:', timerData);
        socket.emit('timerStatus', timerData);
    });

    // Handle door state changes and broadcast to all other players
    socket.on('doorStateChange', (data) => {
        if (!gameState.gameStarted) return;

        const player = gameState.groups.find(g => g.id === socket.id);
        if (player && !player.eliminated) {
            console.log(`Player ${player.name} changed door ${data.doorName} to ${data.isOpen ? 'open' : 'closed'}`);
            
            // Broadcast door state change to all other players
            socket.broadcast.emit('doorStateChange', {
                doorName: data.doorName,
                isOpen: data.isOpen,
                position: data.position,
                playerName: player.name
            });
        }
    });

    // Handle flashlight toggle and broadcast to all other players
    socket.on('flashlightToggle', (data) => {
        if (!gameState.gameStarted) return;

        const player = gameState.groups.find(g => g.id === socket.id);
        if (player && !player.eliminated) {
            // Broadcast flashlight toggle to all other players
            socket.broadcast.emit('flashlightToggle', {
                playerId: socket.id,
                isOn: data.isOn,
                position: data.position,
                direction: data.direction,
                playerName: player.name
            });
        }
    });

    // Handle flashlight updates and broadcast to all other players
    socket.on('flashlightUpdate', (data) => {
        if (!gameState.gameStarted) return;

        const player = gameState.groups.find(g => g.id === socket.id);
        if (player && !player.eliminated) {
            // Broadcast flashlight update to all other players
            socket.broadcast.emit('flashlightUpdate', {
                playerId: socket.id,
                position: data.position,
                direction: data.direction,
                isOn: data.isOn
            });
        }
    });

socket.on('disconnect', () => {
    const disconnectedPlayer = gameState.groups.find(g => g.id === socket.id);
    
    // Only notify about disconnection if player was in a game or lobby
    if (disconnectedPlayer) {
        // Only notify if game was started or in waiting room
        if (gameState.gameStarted || gameState.groups.length > 1) {
            io.emit('playerDisconnected', {
                id: socket.id,
                name: disconnectedPlayer.name,
                wasKiller: disconnectedPlayer.isKiller
            });
        }
            
            // Remove player from game
            gameState.groups = gameState.groups.filter(g => g.id !== socket.id);
            console.log(`Player disconnected. Remaining players: ${gameState.groups.length}`);

            // Check if game should be terminated
            if (gameState.groups.length === 0) {
                console.log('All players left - resetting game');
                resetGame();
                if (gameState.gameStarted) {
                    io.emit('gameTerminated', { reason: 'All players left the game' });
                }
                return;
            }

            if (gameState.gameStarted) {
                // First check if killer left - this should take precedence
                if (disconnectedPlayer && disconnectedPlayer.isKiller) {
                    console.log('Killer left the game - Spies win!');
                    io.emit('gameWon', { 
                        winner: 'Spies', 
                        type: 'spy',
                        reason: 'Killer left the game'
                    });
                    resetGame();
                    return;
                }

                // Then check remaining players
                if (gameState.groups.length < 3) {
                    console.log('Not enough players remaining - terminating game');
                    io.emit('gameTerminated', { reason: 'Not enough players to continue (minimum 3 required)' });
                    resetGame();
                    return;
                }

                // Update remaining players
                io.emit('updatePlayers', gameState.groups.map(g => ({
                    ...g.publicData,
                    isKiller: false // Never reveal killer status
                })));
            } else {
                // Game not started yet
                if (gameState.countdownInterval) {
                    clearInterval(gameState.countdownInterval);
                    io.emit('countdownCancelled');
                }
                
                io.emit('waitingRoomUpdate', {
                    players: gameState.groups.map(g => g.name),
                    playersNeeded: Math.max(0, gameState.minPlayers - gameState.groups.length)
                });
            }
        }
        
        console.log('User disconnected');
    });
});

// Store elimination timer reference
let eliminationTimerInterval;

function startEliminationTimer() {
    if (eliminationTimerInterval) {
        clearInterval(eliminationTimerInterval);
    }

    if (!gameState.gameStarted || !gameState.killer) {
        return;
    }

    eliminationTimerInterval = setInterval(() => {
        if (!gameState.gameStarted || !gameState.killer) {
            clearInterval(eliminationTimerInterval);
            return;
        }

        if (gameState.nextEliminationTime) {
            const now = Date.now();
            const timeLeft = gameState.nextEliminationTime - now;

            if (timeLeft <= 0) {
                // Cooldown is over
                gameState.killerCanEliminate = true;
                gameState.nextEliminationTime = null;

                console.log('Elimination ready for killer');
                io.to(gameState.killer).emit('eliminationReady');
                clearInterval(eliminationTimerInterval);
            }
        }
    }, 1000);
}

function resetGame() {
    // Clear all timers
    if (gameState.countdownInterval) {
        clearInterval(gameState.countdownInterval);
    }
    if (eliminationTimerInterval) {
        clearInterval(eliminationTimerInterval);
    }

    // Reset game state
    gameState = {
        groups: [],
        killer: null,
        clues: [
            { id: 1, location: "Cafeteria", message: "KILLER AVOIDS GROUPS", encrypted: "NLOOHU DYRLGV JURXSV" },
            { id: 2, location: "classroom", message: "KILLER WATCHES OTHERS", encrypted: "NLOOHU ZDWFKHV RWKHUV" },
            { id: 3, location: "office", message: "KILLER STAYS IN SHADOWS", encrypted: "NLOOHU VWDBV LQ VKDGRZV" },
            { id: 4, location: "second floor library", message: "KILLER HUNTS ALONE", encrypted: "NLOOHU KXQWV DORQH" },
            { id: 5, location: "conference room", message: "KILLER STRIKES QUIETLY", encrypted: "NLOOHU VWULNHV TXLHWOB" },
            { id: 6, location: "art room", message: "KILLER MOVES UNSEEN", encrypted: "NLOOHU PRYHV XQVHHQ" }
        ],
        eliminationTimer: 60000, // 1 minute
        nextEliminationTime: null,
        eliminationInterval: null,
        gameStarted: false,
        killerCanEliminate: false,
        minPlayers: 3, // Restored to 3 players minimum
        countdownTime: 10,
        countdownInterval: null
    };
    
    console.log('Game state reset');
}

// Start server
const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to play the game`);
});
