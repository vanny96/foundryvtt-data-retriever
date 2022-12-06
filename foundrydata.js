import {io} from "socket.io-client";
import http from "http";

function getSessionId() {
    return new Promise(resolve => {
        const url = "http://192.168.1.103:30000/join";
        const sessionCookieRegex = /session=([a-z0-9]+)/;

        http.get(url, res => {
            const cookie = res.headers["set-cookie"][0];
            const sessionId = cookie.match(sessionCookieRegex)[1];
            resolve(sessionId);
        })
    });
}

function login(sessionId, userId) {
    return new Promise((resolve) => {
        const login = http.request("http://192.168.1.103:30000/join", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Cookie": `session=${sessionId}`
            }
        }, (res) => {
            res.on("data", data => console.log("Login response: " + data.toString()));

            res.on("end", resolve);
        });
        login.write(JSON.stringify({"userid": userId, password: "", adminPassword: "", "action": "join"}));
        login.end();
    });
}

function getAvailableUsers(socket) {
    return new Promise(resolve => socket.emit("getJoinData", resolve))
        .then(data => data.users);
}

function getWorldData(sessionId) {
    return joinSocketHandling(sessionId)
        .then(() => gameSocketHandling(sessionId))
}

function joinSocketHandling(sessionId) {
    return new Promise(resolve => {
        const socket = io.connect("ws://192.168.1.103:30000/", {
            transports: ["websocket"],    // Require websocket transport instead of XHR polling
            upgrade: false,               // Prevent "upgrading" to websocket since it is enforced
            query: {session: sessionId}
        });

        // Handles matters after connection
        socket.on("session", async (msg) => {
            console.log(`Connected with session ${msg.sessionId}`);

            const availableUsers = await getAvailableUsers(socket);
            const bottinoUser = availableUsers.filter(user => user.name === "Bottino")[0];
            console.log(`Retrieved "Bottino" with id ${bottinoUser._id}`);

            await login(sessionId, bottinoUser._id);
            socket.disconnect();
            resolve();
        });

        socket.on("disconnect", () => console.log("Disconnected from joinSocket"));
    });
}

function gameSocketHandling(sessionId) {
    return new Promise(resolve => {
        const loggedSocket = io.connect("ws://192.168.1.103:30000/", {
            transports: ["websocket"],    // Require websocket transport instead of XHR polling
            upgrade: false,               // Prevent "upgrading" to websocket since it is enforced
            query: {session: sessionId}
        });

        loggedSocket.on("session", async (msg) => {
            console.log(`Logged in with ${msg.userId} using session ${msg.sessionId}`);
            const worldData = await new Promise(resolve => loggedSocket.emit("world", resolve));
            resolve(worldData);
        });
    });
}


// Main Execution
const sessionId = await getSessionId();
const worldData = await getWorldData(sessionId);
console.log(worldData);