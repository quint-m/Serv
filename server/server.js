import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { STATE_PLAYING, playerMove, onJoin, onLeave, update } from "./game.js";

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

app.get("/", (_, res) => {
    res.send("Server is running");
});

server.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
});

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("clock:ping", (data, callback) => {
        callback({ serverTime: Date.now() });
    });

    socket.on("joinRoom", (data, callback) => {
        const { roomId, username } = data;
        try {
            let room = onJoin(roomId, socket.id, username);
            socket.join(roomId);

            // Acknowledge the joining
            callback({
                status: "ok",
                roomId: roomId,
                users: room.players,
                gameState: room.gameState,
                id: socket.id,
            });

            // Notify users in the room about the new user
            socket.to(roomId).emit("joined", {
                username: username,
                roomId: roomId,
                users: room.players,
            });

            // Start the game if there are now 2 players
            if (room.players.length === 2) {
                console.log(`Room ${roomId} is full. Starting game.`);
                room.gameState.state = STATE_PLAYING;
                let id = setInterval(() => update(io, roomId), 1000 / 60);
                room.timerId = id;
            }
        } catch (err) {
            callback({ status: "error", errorMessage: err.message });
        }
    });

    socket.on("disconnect", () => {
        let { roomId, player } = onLeave(socket.id);
        if (!roomId || !player) return;
        socket.leave(roomId);
        io.to(roomId).emit("left", {
            username: player.username,
            roomId: roomId,
        });
    });

    socket.on("playerMove", (data) => {
        const { amount, seq, clientTimeMs } = data;
        playerMove(socket.id, seq, amount);
    });
});
