'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRoom, Participant, QueueItem } from '@/context/RoomContext';

// Server events that clients receive
interface ServerToClientEvents {
    'room:joined': (data: { participants: Participant[]; queue: QueueItem[]; currentVideoIndex: number; playerState: string; currentTime: number }) => void;
    'room:participant-joined': (participant: Participant) => void;
    'room:participant-left': (participantId: string) => void;
    'room:participant-updated': (data: { id: string; updates: Partial<Participant> }) => void;
    'player:sync': (data: { action: 'play' | 'pause' | 'seek'; videoTime: number; serverTime: number; initiator: string }) => void;
    'queue:updated': (queue: QueueItem[]) => void;
    'queue:video-changed': (index: number) => void;
    'error': (message: string) => void;
}

// Client events that server receives
interface ClientToServerEvents {
    'room:join': (data: { roomId: string; participant: Participant }) => void;
    'room:leave': (roomId: string) => void;
    'participant:update': (data: { roomId: string; updates: Partial<Participant> }) => void;
    'player:action': (data: { roomId: string; action: 'play' | 'pause' | 'seek'; videoTime: number }) => void;
    'queue:add': (data: { roomId: string; item: QueueItem }) => void;
    'queue:remove': (data: { roomId: string; itemId: string }) => void;
    'queue:change-video': (data: { roomId: string; index: number }) => void;
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function useSocket(roomId: string | null) {
    const { state, dispatch } = useRoom();
    const socketRef = useRef<TypedSocket | null>(null);
    const isInitializedRef = useRef(false);

    // Initialize socket connection
    useEffect(() => {
        if (!roomId || isInitializedRef.current) return;

        const initSocket = async () => {
            // Connect to socket server
            const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || '';
            socket = io(socketUrl, {
                path: '/api/socket',
                transports: ['websocket', 'polling'],
            });
            socketRef.current = socket;

            socket.on('connect', () => {
                console.log('Socket connected:', socket?.id);
                dispatch({ type: 'SET_CONNECTED', payload: true });
            });

            socket.on('disconnect', () => {
                console.log('Socket disconnected');
                dispatch({ type: 'SET_CONNECTED', payload: false });
            });

            // Room events
            socket.on('room:joined', (data) => {
                dispatch({ type: 'SET_PARTICIPANTS', payload: data.participants });
                dispatch({ type: 'SET_QUEUE', payload: data.queue });
                dispatch({ type: 'SET_CURRENT_VIDEO_INDEX', payload: data.currentVideoIndex });
                dispatch({ type: 'SET_CURRENT_TIME', payload: data.currentTime });
            });

            socket.on('room:participant-joined', (participant) => {
                dispatch({ type: 'ADD_PARTICIPANT', payload: participant });
            });

            socket.on('room:participant-left', (participantId) => {
                dispatch({ type: 'REMOVE_PARTICIPANT', payload: participantId });
            });

            socket.on('room:participant-updated', (data) => {
                dispatch({ type: 'UPDATE_PARTICIPANT', payload: data });
            });

            // Queue events
            socket.on('queue:updated', (queue) => {
                dispatch({ type: 'SET_QUEUE', payload: queue });
            });

            socket.on('queue:video-changed', (index) => {
                dispatch({ type: 'SET_CURRENT_VIDEO_INDEX', payload: index });
            });

            socket.on('error', (message) => {
                console.error('Socket error:', message);
            });

            isInitializedRef.current = true;
        };

        initSocket();

        return () => {
            if (socket) {
                socket.disconnect();
                socket = null;
                socketRef.current = null;
                isInitializedRef.current = false;
            }
        };
    }, [roomId, dispatch]);

    // Join room
    const joinRoom = useCallback((participant: Participant) => {
        if (socketRef.current && roomId) {
            socketRef.current.emit('room:join', { roomId, participant });
            dispatch({ type: 'SET_LOCAL_PARTICIPANT', payload: participant });
        }
    }, [roomId, dispatch]);

    // Leave room
    const leaveRoom = useCallback(() => {
        if (socketRef.current && roomId) {
            socketRef.current.emit('room:leave', roomId);
        }
    }, [roomId]);

    // Update participant (mute, camera, etc.)
    const updateParticipant = useCallback((updates: Partial<Participant>) => {
        if (socketRef.current && roomId) {
            socketRef.current.emit('participant:update', { roomId, updates });
        }
    }, [roomId]);

    // Player actions
    const sendPlayerAction = useCallback((action: 'play' | 'pause' | 'seek', videoTime: number) => {
        if (socketRef.current && roomId) {
            socketRef.current.emit('player:action', { roomId, action, videoTime });
        }
    }, [roomId]);

    // Queue actions
    const addToQueue = useCallback((item: QueueItem) => {
        if (socketRef.current && roomId) {
            socketRef.current.emit('queue:add', { roomId, item });
        }
    }, [roomId]);

    const removeFromQueue = useCallback((itemId: string) => {
        if (socketRef.current && roomId) {
            socketRef.current.emit('queue:remove', { roomId, itemId });
        }
    }, [roomId]);

    const changeVideo = useCallback((index: number) => {
        if (socketRef.current && roomId) {
            socketRef.current.emit('queue:change-video', { roomId, index });
        }
    }, [roomId]);

    // Subscribe to player sync events (for YouTube player component)
    const onPlayerSync = useCallback((callback: (data: { action: 'play' | 'pause' | 'seek'; videoTime: number; serverTime: number; initiator: string }) => void) => {
        if (socketRef.current) {
            socketRef.current.on('player:sync', callback);
            return () => {
                socketRef.current?.off('player:sync', callback);
            };
        }
        return () => { };
    }, []);

    return {
        socket: socketRef.current,
        isConnected: state.isConnected,
        joinRoom,
        leaveRoom,
        updateParticipant,
        sendPlayerAction,
        addToQueue,
        removeFromQueue,
        changeVideo,
        onPlayerSync,
    };
}
