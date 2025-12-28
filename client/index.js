import { lerpState } from "./utils.js";

const socket = io("ws://192.168.50.183:3000");

const DEBUG_NETEM = {
    enabled: false,
    delayMs: 300,
    jitterMs: 80,
    lossPct: 0.02,
};

const join = document.getElementById("joinBtn");
const loginContainer = document.querySelector(".login-container");
const gameContainer = document.querySelector(".game-container");
const clientList = document.querySelector(".connected-clients");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

var keyboardState = {};

let inputSeq = 0;
const pendingInputs = [];

let serverTimeOffsetMs = 0; // serverTime ≈ performance.now() + serverTimeOffsetMs
let offsetEma = null;

const SNAPSHOT_BUFFER_MS = 80;
const snapshots = []; // { t, state, players }

function emitLagged(event, payload) {
    if (!DEBUG_NETEM.enabled || event !== "playerMove") {
        socket.emit(event, payload);
        return;
    }
    if (Math.random() < DEBUG_NETEM.lossPct) return; // simulate loss
    const jitter = (Math.random() * 2 - 1) * DEBUG_NETEM.jitterMs;
    const delay = Math.max(0, DEBUG_NETEM.delayMs + jitter);
    setTimeout(() => socket.emit(event, payload), delay);
}

window.addEventListener("keydown", (event) => {
    const key = event.key;
    keyboardState[key] = true;
    if (key === "ArrowUp" || key === "ArrowDown") {
        event.preventDefault();
    }
});

window.addEventListener("keyup", (event) => {
    const key = event.key;
    keyboardState[key] = false;
});

document.fonts.load("50px 'Jersey 10'").then(() => {
    console.log("Font loaded");
    ctx.font = "50px 'Jersey 10'";
});

join.addEventListener("click", () => {
    const roomId = document.getElementById("room").value;
    const username = document.getElementById("username").value;
    if (!roomId) {
        alert("Please enter a room ID");
        return;
    }
    if (!username) {
        alert("Please enter a username");
        return;
    }
    socket.emit("joinRoom", { roomId, username }, (data) => {
        // Callback after attempting to join room
        if (data.status !== "ok") {
            alert("Failed to join room: " + data.errorMessage);
            return;
        }
        localStorage.setItem("id", data.id);
        loginContainer.style.display = "none";
        gameContainer.style.display = "flex";

        console.log(`Joined room: ${roomId} as ${username}`);
        updateClientList(data.users);
        render(data.gameState, data.users);
    });
});

socket.on("connect", () => {
    console.log("Connected to server");
});

socket.on("joined", (data) => {
    updateClientList(data.users);
});

socket.on("left", (data) => {
    console.log(`User ${data.username} left the room`);
    const items = clientList.getElementsByTagName("li");
    for (let i = 0; i < items.length; i++) {
        if (items[i].textContent.includes(data.username)) {
            clientList.removeChild(items[i]);
            break;
        }
    }
});

socket.on("gameStateUpdate", (data) => {
    // console.log("Received game state update:", data.gameState);
    const now = performance.now();
    const serverTimeMs = data.serverTimeMs ?? now + serverTimeOffsetMs;

    pushSnapshot(data.gameState, data.players, serverTimeMs);

    // Reconciliation if server acks inputs
    if (typeof data.lastProcessedInputSeq === "number") {
        while (
            pendingInputs.length &&
            pendingInputs[0].seq <= data.lastProcessedInputSeq
        ) {
            pendingInputs.shift();
        }
        if (pendingInputs.length) {
            const snap = snapshots[snapshots.length - 1];
            const id = localStorage.getItem("id");
            const isLeft = id == data.players?.[0]?.id;
            const side = isLeft ? "left" : "right";
            let y = data.gameState.paddles[side].y;
            for (const inp of pendingInputs) y += inp.amount;
            snap.state = {
                ...snap.state,
                paddles: {
                    ...snap.state.paddles,
                    [side]: { ...snap.state.paddles[side], y },
                },
            };
        }
    }
});

const pushSnapshot = (state, players, serverTimeMs) => {
    snapshots.push({ t: serverTimeMs, state, players });
    if (snapshots.length > 120) snapshots.shift();
};

const getInterpolatedSnapshot = () => {
    if (snapshots.length === 0) return null;
    const renderTime =
        performance.now() + serverTimeOffsetMs - SNAPSHOT_BUFFER_MS;
    let i = snapshots.length - 1;
    while (i > 0 && snapshots[i - 1].t > renderTime) i--;

    const a = snapshots[i - 1];
    const b = snapshots[i];

    if (!a || !b) return snapshots[snapshots.length - 1];

    const alpha = Math.min(1, Math.max(0, (renderTime - a.t) / (b.t - a.t)));
    return {
        t: renderTime,
        state: lerpState(a.state, b.state, alpha),
        players: b.players,
    };
};

const applyLocalPrediction = (latestSnap, amount) => {
    if (!latestSnap) return;
    const id = localStorage.getItem("id");
    const isLeft = id == latestSnap.players?.[0]?.id;
    const side = isLeft ? "left" : "right";
    latestSnap.state = {
        ...latestSnap.state,
        paddles: {
            ...latestSnap.state.paddles,
            [side]: {
                ...latestSnap.state.paddles[side],
                y: latestSnap.state.paddles[side].y + amount,
            },
        },
    };
};

const syncClock = () => {
    const t0 = performance.now();
    socket.emit("clock:ping", null, (data) => {
        const t1 = performance.now();
        const rtt = t1 - t0;
        const estimate = data.serverTime - (t0 + rtt / 2);
        offsetEma =
            offsetEma == null ? estimate : offsetEma * 0.9 + estimate * 0.1;
        serverTimeOffsetMs = offsetEma;
        console.log(
            `Clock sync: RTT=${rtt.toFixed(
                2
            )}ms, offset=${serverTimeOffsetMs.toFixed(2)}ms`
        );
    });
};

const updateClientList = (users) => {
    console.log("Updating client list:", users);
    clientList.innerHTML = "";
    // const selfId = localStorage.getItem("id");
    users.forEach((user, idx) => {
        const listItem = document.createElement("li");
        listItem.classList.add("mb-2", "text-lg", "font-semibold", "list-row");
        listItem.textContent = `Player ${idx + 1}: ${user.username}`;
        clientList.appendChild(listItem);
    });
};

const render = (gameState, players) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";

    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    if (gameState.state == "waiting") {
        ctx.fillText(
            `Waiting for players...`,
            canvas.width / 2 - 150,
            canvas.height / 2
        );
        return;
    }

    // Draw score
    // TODO: Center text please
    let scorePrefix = gameState.score.right < 10 ? "0" : "";
    ctx.fillText(
        `${scorePrefix}${gameState.score.right}`,
        canvas.width / 2 + 25,
        40
    );
    scorePrefix = gameState.score.left < 10 ? "0" : "";
    ctx.fillText(
        `${scorePrefix}${gameState.score.left}`,
        canvas.width / 2 - 60,
        40
    );

    // Draw dotted center line
    for (let y = 0; y < canvas.height; y += 30) {
        ctx.fillRect(canvas.width / 2 - 5, y, 10, 20);
    }

    // Determine which paddle is "mine" and which is "opponent"
    const id = localStorage.getItem("id");
    const isLeftPaddle = id == players[0].id;

    if (isLeftPaddle) {
        ctx.fillText(`True Left`, 20, canvas.height - 20);
    }

    const myPaddle = isLeftPaddle
        ? gameState.paddles.left
        : gameState.paddles.right;
    const opponentPaddle = isLeftPaddle
        ? gameState.paddles.right
        : gameState.paddles.left;

    // Draw my paddle on the left
    ctx.fillRect(20, myPaddle.y, myPaddle.width, myPaddle.height);

    // Draw opponent paddle on the right
    ctx.fillRect(
        canvas.width - 20 - opponentPaddle.width,
        opponentPaddle.y,
        opponentPaddle.width,
        opponentPaddle.height
    );

    // For ball position
    const ballX = isLeftPaddle
        ? gameState.ball.x
        : canvas.width - gameState.ball.x;

    ctx.beginPath();
    ctx.arc(ballX, gameState.ball.y, 10, 0, Math.PI * 2);
    ctx.fill();
};

// Continuous render at display refresh using interpolated snapshot
const renderLoop = () => {
    const snap = getInterpolatedSnapshot();
    if (snap) render(snap.state, snap.players);
    requestAnimationFrame(renderLoop);
};

setInterval(() => {
    let amount = 0;
    if (keyboardState["ArrowUp"]) amount -= 5;
    if (keyboardState["ArrowDown"]) amount += 5;

    if (amount === 0) return;
    const msg = {
        seq: ++inputSeq,
        amount,
        clientTimeMs: performance.now(),
    };
    pendingInputs.push(msg);
    // socket.emit("playerMove", msg);
    emitLagged("playerMove", msg);
    applyLocalPrediction(snapshots[snapshots.length - 1], amount);
}, 1000 / 60);

requestAnimationFrame(renderLoop);
setInterval(syncClock, 2000);
