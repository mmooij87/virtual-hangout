'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoom } from '@/context/RoomContext';
import { useSocket } from '@/hooks/useSocket';

interface VideoChatProps {
    roomId: string;
}

interface LocalStream {
    video: MediaStream | null;
    audio: MediaStream | null;
}

export default function VideoChat({ roomId }: VideoChatProps) {
    const { state } = useRoom();
    const { updateParticipant } = useSocket(roomId);
    const [localStream, setLocalStream] = useState<LocalStream>({ video: null, audio: null });
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [permissionError, setPermissionError] = useState<string | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);

    // Initialize local video/audio
    useEffect(() => {
        const initMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 360 },
                        facingMode: 'user',
                    },
                    audio: true,
                });

                setLocalStream({ video: stream, audio: stream });

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
            } catch (error) {
                console.error('Failed to get media devices:', error);
                if (error instanceof Error) {
                    if (error.name === 'NotAllowedError') {
                        setPermissionError('Camera/microphone access denied. Please allow access in your browser settings.');
                    } else if (error.name === 'NotFoundError') {
                        setPermissionError('No camera or microphone found.');
                    } else {
                        setPermissionError('Failed to access camera/microphone.');
                    }
                }
            }
        };

        initMedia();

        return () => {
            // Cleanup streams
            localStream.video?.getTracks().forEach(track => track.stop());
            localStream.audio?.getTracks().forEach(track => track.stop());
        };
    }, []);

    // Toggle mute
    const toggleMute = useCallback(() => {
        if (localStream.audio) {
            const audioTracks = localStream.audio.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
            updateParticipant({ isMuted: !isMuted });
        }
    }, [localStream.audio, isMuted, updateParticipant]);

    // Toggle camera
    const toggleCamera = useCallback(() => {
        if (localStream.video) {
            const videoTracks = localStream.video.getVideoTracks();
            videoTracks.forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsCameraOff(!isCameraOff);
            updateParticipant({ isCameraOff: !isCameraOff });
        }
    }, [localStream.video, isCameraOff, updateParticipant]);

    // Filter remote participants
    const remoteParticipants = state.participants.filter(
        p => p.id !== state.localParticipant?.id
    );

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Video Chat
                    <span className="text-sm font-normal text-gray-400">
                        ({state.participants.length})
                    </span>
                </h2>
            </div>

            {/* Permission Error */}
            {permissionError && (
                <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-red-400 text-sm">{permissionError}</p>
                </div>
            )}

            {/* Video Grid */}
            <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
                {/* Local Video */}
                <div className="participant-video glass-subtle">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className={isCameraOff ? 'opacity-0' : ''}
                    />

                    {/* Camera Off Placeholder */}
                    {isCameraOff && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-900/50 to-purple-900/50">
                            <div className="w-16 h-16 rounded-full bg-indigo-500/30 flex items-center justify-center text-2xl font-bold">
                                {state.localParticipant?.name?.[0]?.toUpperCase() || 'Y'}
                            </div>
                        </div>
                    )}

                    {/* Name Tag */}
                    <div className="participant-name">
                        {state.localParticipant?.name || 'You'} (You)
                        {isMuted && (
                            <svg className="w-3 h-3 ml-1 inline text-red-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 4L9.91 6.09 12 8.18V4zm-2 8c0 .66.16 1.28.45 1.82l1.37-1.37C11.61 12.31 11.5 12.16 11.5 12V8.5l-1.5 1.5v2zm9.32 7.82L18.5 21 17.09 19.59 3.41 5.91 4.82 4.5l2.67 2.67L12 11.68l2.59 2.59 1.37 1.37.86.86zM19 12c0-3.87-3.13-7-7-7-1.03 0-2.02.22-2.91.62l1.46 1.46c.45-.05.93-.08 1.45-.08 2.76 0 5 2.24 5 5 0 .52-.03 1-.08 1.45l1.46 1.46c.4-.89.62-1.88.62-2.91zM4.27 3L3 4.27l2.33 2.33C4.5 7.83 4 9.35 4 11v1h2v-1c0-1.14.36-2.19.97-3.06L19.73 21 21 19.73l-8.73-8.73-8-8z" />
                            </svg>
                        )}
                    </div>
                </div>

                {/* Remote Participants */}
                {remoteParticipants.map((participant) => (
                    <div key={participant.id} className="participant-video glass-subtle">
                        {/* For now, show avatar placeholder since we don't have full WebRTC */}
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-pink-900/50">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl font-bold shadow-lg">
                                {participant.name[0]?.toUpperCase() || '?'}
                            </div>
                        </div>

                        {/* Name Tag */}
                        <div className="participant-name">
                            {participant.name}
                            {participant.isMuted && (
                                <svg className="w-3 h-3 ml-1 inline text-red-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 4L9.91 6.09 12 8.18V4zm-2 8c0 .66.16 1.28.45 1.82l1.37-1.37C11.61 12.31 11.5 12.16 11.5 12V8.5l-1.5 1.5v2zm9.32 7.82L18.5 21 17.09 19.59 3.41 5.91 4.82 4.5l2.67 2.67L12 11.68l2.59 2.59 1.37 1.37.86.86zM19 12c0-3.87-3.13-7-7-7-1.03 0-2.02.22-2.91.62l1.46 1.46c.45-.05.93-.08 1.45-.08 2.76 0 5 2.24 5 5 0 .52-.03 1-.08 1.45l1.46 1.46c.4-.89.62-1.88.62-2.91zM4.27 3L3 4.27l2.33 2.33C4.5 7.83 4 9.35 4 11v1h2v-1c0-1.14.36-2.19.97-3.06L19.73 21 21 19.73l-8.73-8.73-8-8z" />
                                </svg>
                            )}
                        </div>
                    </div>
                ))}

                {/* Empty State */}
                {remoteParticipants.length === 0 && (
                    <div className="text-center py-6 text-gray-500">
                        <p className="text-sm">Waiting for friends to join...</p>
                        <p className="text-xs mt-1">Share the room link to invite them</p>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="flex justify-center gap-3 mt-4 pt-4 border-t border-white/10">
                <button
                    onClick={toggleMute}
                    className={`btn btn-icon ${isMuted ? 'btn-danger' : 'btn-secondary'}`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 4L9.91 6.09 12 8.18V4zm-2 8c0 .66.16 1.28.45 1.82l1.37-1.37C11.61 12.31 11.5 12.16 11.5 12V8.5l-1.5 1.5v2zm9.32 7.82L18.5 21 17.09 19.59 3.41 5.91 4.82 4.5l2.67 2.67L12 11.68l2.59 2.59 1.37 1.37.86.86zM19 12c0-3.87-3.13-7-7-7-1.03 0-2.02.22-2.91.62l1.46 1.46c.45-.05.93-.08 1.45-.08 2.76 0 5 2.24 5 5 0 .52-.03 1-.08 1.45l1.46 1.46c.4-.89.62-1.88.62-2.91zM4.27 3L3 4.27l2.33 2.33C4.5 7.83 4 9.35 4 11v1h2v-1c0-1.14.36-2.19.97-3.06L19.73 21 21 19.73l-8.73-8.73-8-8z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z" />
                        </svg>
                    )}
                </button>

                <button
                    onClick={toggleCamera}
                    className={`btn btn-icon ${isCameraOff ? 'btn-danger' : 'btn-secondary'}`}
                    title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
                >
                    {isCameraOff ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Note about WebRTC */}
            <p className="text-xs text-gray-500 text-center mt-3">
                Full video chat requires Daily.co API key
            </p>
        </div>
    );
}
