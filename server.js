const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname: 'localhost', port });
const handle = app.getRequestHandler();

// Room state storage (in-memory for development)
const rooms = new Map();

function getRoom(roomId) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            participants: [],
            queue: [],
            currentVideoIndex: 0,
            playerState: 'paused',
            currentTime: 0,
        });
    }
    return rooms.get(roomId);
}

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    });

    const io = new Server(httpServer, {
        path: '/api/socket',
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);
        let currentRoomId = null;

        // Join room
        socket.on('room:join', ({ roomId, participant }) => {
            currentRoomId = roomId;
            socket.join(roomId);

            const room = getRoom(roomId);

            // Add participant
            const existingIndex = room.participants.findIndex(p => p.id === participant.id);
            if (existingIndex >= 0) {
                room.participants[existingIndex] = participant;
            } else {
                room.participants.push(participant);
            }

            // Send current room state to new participant
            socket.emit('room:joined', {
                participants: room.participants,
                queue: room.queue,
                currentVideoIndex: room.currentVideoIndex,
                playerState: room.playerState,
                currentTime: room.currentTime,
            });

            // Notify others
            socket.to(roomId).emit('room:participant-joined', participant);

            console.log(`Participant ${participant.name} joined room ${roomId}`);
        });

        // Leave room
        socket.on('room:leave', (roomId) => {
            if (currentRoomId) {
                const room = getRoom(currentRoomId);
                room.participants = room.participants.filter(p => p.id !== socket.id);
                socket.to(currentRoomId).emit('room:participant-left', socket.id);
                socket.leave(currentRoomId);
                currentRoomId = null;
            }
        });

        // Update participant
        socket.on('participant:update', ({ roomId, updates }) => {
            const room = getRoom(roomId);
            const participant = room.participants.find(p => p.id === socket.id);
            if (participant) {
                Object.assign(participant, updates);
                io.to(roomId).emit('room:participant-updated', {
                    id: socket.id,
                    updates,
                });
            }
        });

        // Player actions (play, pause, seek)
        socket.on('player:action', ({ roomId, action, videoTime }) => {
            const room = getRoom(roomId);

            // Update room state
            if (action === 'play') {
                room.playerState = 'playing';
            } else if (action === 'pause') {
                room.playerState = 'paused';
            }
            room.currentTime = videoTime;

            // Broadcast to all participants (including sender for confirmation)
            io.to(roomId).emit('player:sync', {
                action,
                videoTime,
                serverTime: Date.now(),
                initiator: socket.id,
            });

            console.log(`Player ${action} at ${videoTime}s in room ${roomId}`);
        });

        // Add to queue
        socket.on('queue:add', ({ roomId, item }) => {
            const room = getRoom(roomId);
            room.queue.push(item);
            io.to(roomId).emit('queue:updated', room.queue);
            console.log(`Added to queue in room ${roomId}:`, item.title);
        });

        // Remove from queue
        socket.on('queue:remove', ({ roomId, itemId }) => {
            const room = getRoom(roomId);
            room.queue = room.queue.filter(item => item.id !== itemId);
            io.to(roomId).emit('queue:updated', room.queue);
        });

        // Change current video
        socket.on('queue:change-video', ({ roomId, index }) => {
            const room = getRoom(roomId);
            room.currentVideoIndex = index;
            room.currentTime = 0;
            io.to(roomId).emit('queue:video-changed', index);
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            if (currentRoomId) {
                const room = getRoom(currentRoomId);
                room.participants = room.participants.filter(p => p.id !== socket.id);
                socket.to(currentRoomId).emit('room:participant-left', socket.id);
            }
            console.log('Client disconnected:', socket.id);
        });
    });

    httpServer
        .once('error', (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on port ${port}`);
        });
});
