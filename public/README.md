# CTF Cryptography Based Spy School

A 3D multiplayer CTF (Capture The Flag) game where players take on the roles of spies and killers in a dark school environment. Spies must solve encrypted Caesar cipher clues while avoiding elimination by the killer.

## System Requirements

- **Node.js** (version 14.0 or higher)
- **npm** (comes with Node.js)
- Modern web browser must use
- Internet connection for multiplayer functionality

## Installation & Setup

### 1. Install Node.js
Download and install Node.js from [https://nodejs.org/](https://nodejs.org/)
- Choose the LTS (Long Term Support) version
- This will also install npm automatically

### 2. Download the Game
Clone or download this repository to your local machine.

### 3. Install Dependencies
Open terminal/command prompt in the game folder and run:
```bash
npm install
```

### 4. Start the Game Server
Run one of these commands in the terminal:

**For production:**
```bash
npm start
node server.js
```

**For development (auto-restart on changes):**
```bash
npm run dev
```

### 5. Access the Game
Open your web browser and go to:
- **Local play:** `http://localhost:3000`
- **Network play:** `http://YOUR_IP_ADDRESS:3000`

## How to Play

## Game Roles
- **Spies:** Find and decrypt 3 clues to win
- **Killer:** Eliminate all spies before they solve the mystery

### Controls
- **WASD:** Move around
- **Mouse:** Look around
- **Space:** Jump
- **F:** Toggle flashlight
- **E:** Interact with clues/doors
- **K:** Eliminate (Killer only, available every 1 minute)

### Game Rules
- Minimum 3 players required to start
- One player is randomly assigned as the Killer
- Spies must solve encrypted clues using the Caesar cipher
- Killer can eliminate players every 60 seconds
- Game ends when spies solve 3 clues OR killer eliminates all spies

## Troubleshooting

### Reset Game Server (when code is updated)
If you need to restart the server after making changes:

**Windows:**
```bash
taskkill /f /im node.exe
```

Then restart with `npm start` or `npm run dev`

### Common Issues
- **Port already in use:** Change the port in server.js or kill existing Node processes
- **Can't connect:** Check firewall settings and ensure port 3000 is open
- **Game won't start:** Ensure all dependencies are installed with `npm install`

## Network Play Setup

To play with friends over the network:
1. Find your computer's IP address
2. Share `http://YOUR_IP_ADDRESS:3000` with other players
3. Ensure port 3000 is open in your firewall
4. All players must be on the same network or use port forwarding

## Development

The game uses:
- **Express.js** for the web server
- **Socket.io** for real-time multiplayer communication
- **Three.js** for 3D graphics and game engine

File structure:
- `server.js` - Main server and game logic
- `public/client.js` - Client-side game code
- `public/index.html` - Game interface
- `public/style.css` - Game styling
- `public/ui.js` - UI management

Enjoy
