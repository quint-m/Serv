# WebSocket Pong

A real-time multiplayer Pong game built with Node.js, Express, Socket.IO, and HTML5 Canvas. This project demonstrates advanced networking techniques for responsive multiplayer gaming, including client-side prediction, lag compensation, and state interpolation.

## Features

- **Real-time multiplayer gameplay** for 2 players
- **Advanced networking optimizations**:
  - Client-side prediction for responsive controls
  - Server reconciliation for consistency
  - State interpolation for smooth rendering
  - Clock synchronization between client and server
  - Lag simulation for testing network conditions
- **Room-based matchmaking** system
- **Responsive web interface** with modern styling (TailwindCSS + DaisyUI)

## Architecture & Techniques

This project implements several advanced networking techniques commonly used in real-time multiplayer games:

### 1. Client-Side Prediction

The client immediately applies player input locally without waiting for server confirmation, providing instant feedback and responsive controls.

### 2. Server Reconciliation

When the server sends authoritative game state updates, the client:

- Compares the server state with its predicted state
- Corrects any discrepancies
- Re-applies any unacknowledged inputs to maintain consistency

### 3. State Interpolation

To ensure smooth rendering despite network jitter:

- The client maintains a buffer of game state snapshots
- Renders frames by interpolating between buffered states
- Uses the `lerpState` function for smooth ball and paddle movement

### 4. Clock Synchronization

- Regular ping-pong exchanges between client and server
- Estimates network latency and time offset
- Uses exponential moving average (EMA) for stable time synchronization

### 5. Input Sequencing

- Each client input is tagged with a sequence number
- Server acknowledges processed inputs by sequence number
- Enables reliable input delivery and reconciliation

### 6. Network Simulation

Built-in network emulation for testing:

- Configurable packet delay and jitter
- Packet loss simulation
- Helps validate networking code under adverse conditions

## Technical Stack

**Backend:**

- Node.js with ES modules
- Express.js for HTTP server
- Socket.IO for real-time WebSocket communication
- Authoritative server with 60Hz game loop

**Frontend:**

- Vanilla JavaScript with ES6 modules
- HTML5 Canvas for game rendering
- Socket.IO client for real-time communication
- TailwindCSS + DaisyUI for modern UI styling
- Google Fonts (Jersey 10) for retro gaming aesthetic

## Setup and Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager

### Server Setup

1. Navigate to the server directory:

   ```bash
   cd server
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```
   The server will run on `http://localhost:3000`

### Client Setup

1. Navigate to the client directory:

   ```bash
   cd client
   ```

2. Serve the client files using a local web server. You can use any of these methods:

   **Using Python (Python 3):**

   ```bash
   python -m http.server 8000
   ```

   **Using Node.js http-server (install globally first):**

   ```bash
   npm install -g http-server
   http-server -p 8000
   ```

   **Using VS Code Live Server extension:**

   - Install the "Live Server" extension
   - Right-click on `index.html` and select "Open with Live Server"

3. **Update the server URL** in [client/index.js](client/index.js#L3):
   ```javascript
   const socket = io("ws://localhost:3000"); // Change to your server's IP/port
   ```

### Playing the Game

1. Open your browser and navigate to the client URL (e.g., `http://localhost:8000`)
2. Enter a username and room name
3. Share the room name with another player
4. Once both players join, the game starts automatically
5. Use **Arrow Up** and **Arrow Down** keys to control your paddle
6. First player joins as the left paddle, second player as the right paddle

## Project Structure

```
├── server/
│   ├── server.js          # Express server & Socket.IO setup
│   ├── game.js           # Game logic & state management
│   └── package.json      # Server dependencies
└── client/
    ├── index.html        # Main HTML page
    ├── index.js         # Client-side game logic
    ├── utils.js         # Interpolation utilities
    ├── app.css          # Custom styles
    └── architecture.mmd  # Network architecture diagram
```

## Game Configuration

### Network Simulation

To test under simulated network conditions, modify the `DEBUG_NETEM` object in [client/index.js](client/index.js#L5-L10):

```javascript
const DEBUG_NETEM = {
  enabled: true, // Enable network simulation
  delayMs: 300, // Base delay in milliseconds
  jitterMs: 80, // Random jitter variation
  lossPct: 0.02, // Packet loss percentage (0.02 = 2%)
};
```

### Game Parameters

Game settings can be adjusted in [server/game.js](server/game.js):

- Canvas size: 800x600 pixels
- Paddle size: 10x100 pixels
- Ball speed: randomized on reset
- Update frequency: 60 FPS

## Development Notes

- The server maintains authoritative game state and runs the physics simulation
- Client prediction is essential for responsive controls in real-time games
- State interpolation smooths out network jitter for better visual experience
- Clock synchronization ensures consistent timing across clients
- The game uses a simple collision detection system suitable for Pong mechanics

## License

This project is licensed under the ISC License.
