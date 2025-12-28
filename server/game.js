import { randomInt } from "crypto";

export const STATE_PLAYING = "playing";
export const STATE_WAITING = "waiting";
export const STATE_FINISHED = "finished";

const gameRooms = {};

/**
 * Handles a user joining a game room.
 *
 * If the room does not exist, it creates a new room with the specified ID,
 * initializes the game state, and adds it to the `gameRooms` collection.
 * If the room exists but is full (2 players), it throws an error.
 *
 * @param {string} roomId - The unique identifier for the game room.
 * @param {string} socketId - The unique socket ID of the connecting user.
 * @param {string} username - The display name of the connecting user.
 * @returns {Object} The room object containing the room ID, player list, game state, and timer ID.
 * @throws {Error} Throws an error if the room already has 2 or more players.
 */
const onJoin = (roomId, socketId, username) => {
    let room = gameRooms[roomId];
    if (room === undefined) {
        room = {
            id: roomId,
            players: [],
            gameState: game(),
            timerId: null,
            tickCount: 0,
        };

        gameRooms[roomId] = room;
    }
    if (room.players.length >= 2) {
        throw new Error("Room is full");
    }
    room.players.push({
        id: socketId,
        username: username,
    });
    console.log(`User ${username} (${socketId}) joined room: ${roomId}`);

    return room;
};

/**
 * Handles the logic when a user disconnects or leaves the game.
 *
 * This function identifies the room and player associated with the given socket ID.
 * It removes the player from the room, logs the event, and manages the room's state.
 * If the room becomes empty, it is deleted from the `gameRooms` object.
 * If the room has fewer than 2 players remaining, the game state is reset to waiting.
 *
 * @param {string} socketId - The unique identifier of the socket that disconnected.
 * @returns {{roomId: string, player: object}|{}} An object containing the `roomId` and `player` data if found, otherwise an empty object.
 */
const onLeave = (socketId) => {
    console.log("A user disconnected:", socketId);
    let { room, player } = findPlayerRoom(socketId, gameRooms) || {};
    if (!room || !player) return {};

    let roomId = room.id;
    room.players = room.players.filter((p) => p.id !== socketId);
    console.log(`User ${player.username} (${socketId}) left room: ${room.id}`);

    // If the room is empty, delete it
    if (room.players.length <= 0) {
        delete gameRooms[room.id];
        console.log(`Room ${room.id} deleted as it is empty.`);
    } else if (room.players.length < 2) {
        console.log(`Room ${room.id} has less than 2 players. Stopping game.`);
        room.gameState.state = STATE_WAITING;
    }
    return { roomId, player };
};

const playerMove = (socketId, seqNr, amount) => {
    const { room, player } = findPlayerRoom(socketId, gameRooms);
    if (!room || !player) return;
    if (room.players[0].id === socketId) {
        // Left paddle
        room.gameState.paddles.left.y += amount;
    } else {
        // Right paddle
        room.gameState.paddles.right.y += amount;
    }
    room.lastProcessedInputSeq = seqNr;
};

const update = (io, roomId) => {
    const room = gameRooms[roomId];
    if (!room) return;

    // Update ball position
    // console.log(`Updating game state for room ${roomId}, ball position: (${room.gameState.ball.x}, ${room.gameState.ball.y})`);
    room.gameState.ball.x += room.gameState.ball.vx;
    room.gameState.ball.y += room.gameState.ball.vy;

    let speedMultiplier = Math.random() * 0.1 + 1.0;
    // Simple collision with top and bottom walls
    if (room.gameState.ball.y <= 1 || room.gameState.ball.y + 20 >= 600) {
        room.gameState.ball.vy *= -1 * speedMultiplier;
    }

    // Simple paddle collision
    // Left paddle
    if (
        room.gameState.ball.x <= 40 &&
        room.gameState.ball.y + 20 >= room.gameState.paddles.left.y &&
        room.gameState.ball.y <= room.gameState.paddles.left.y + 100
    ) {
        room.gameState.ball.vx = -1 * room.gameState.ball.vx;
    }
    // Right paddle
    if (
        room.gameState.ball.x + 20 >= 800 - 20 &&
        room.gameState.ball.y + 20 >= room.gameState.paddles.right.y &&
        room.gameState.ball.y <= room.gameState.paddles.right.y + 100
    ) {
        room.gameState.ball.vx = -1 * room.gameState.ball.vx;
    }

    // Score update
    if (room.gameState.ball.x < 0) {
        room.gameState.score.right += 1;
        // Reset ball
        room.gameState.ball.x = 800 / 2 - 10;
        room.gameState.ball.y = 600 / 2 - 10;
        room.gameState.ball.vx = randomInt(-5, 6) || 3;
        room.gameState.ball.vy = randomInt(-5, 6) || 3;
    } else if (room.gameState.ball.x > 800) {
        room.gameState.score.left += 1;
        // Reset ball
        room.gameState.ball.x = 800 / 2 - 10;
        room.gameState.ball.y = 600 / 2 - 10;
        room.gameState.ball.vx = randomInt(-5, 6) || -3;
        room.gameState.ball.vy = randomInt(-5, 6) || -3;
    }

    // Send updated game state to all players in the room
    io.to(roomId).emit("gameStateUpdate", {
        gameState: room.gameState,
        players: room.players,
        serverTimeMs: Date.now(),
        lastProcessedInputSeq: room.lastProcessedInputSeq,
    });

    // Stop the game loop if we now have less than 2 players
    // do this here to allow for last game state update to be sent
    if (room.players.length < 2) {
        clearInterval(room.timerId);
        room.timerId = null;
    }
};

const game = () => {
    // TODO: adjust based on actual game size
    return {
        state: STATE_WAITING, // waiting, playing, finished
        score: { left: 0, right: 0 },
        ball: {
            x: 800 / 2 - 10,
            y: 600 / 2 - 10,
            vx: randomInt(-5, 6) || 3,
            vy: randomInt(-5, 6) || 3,
        },
        paddles: {
            left: { y: 600 / 2 - 50, width: 10, height: 100 },
            right: { y: 600 / 2 - 50, width: 10, height: 100 },
        },
    };
};

const findPlayerRoom = (socketId, rooms) => {
    for (const roomId in rooms) {
        const room = rooms[roomId];
        const player = room.players.find((player) => player.id === socketId);
        if (player) {
            return { room, player };
        }
    }
    return null;
};

export { game, findPlayerRoom, onJoin, onLeave, playerMove, update };
