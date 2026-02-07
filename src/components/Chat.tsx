'use client';

import { useState, useEffect, useRef } from 'react';
import { useRoom, ChatMessage } from '@/context/RoomContext';
import { useSocket } from '@/hooks/useSocket';
import { v4 as uuidv4 } from 'uuid';

interface ChatProps {
    roomId: string;
}

export default function Chat({ roomId }: ChatProps) {
    const { state } = useRoom();
    const { sendMessage } = useSocket(roomId);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollContainerRef.current) {
            const { scrollHeight, scrollTop, clientHeight } = scrollContainerRef.current;
            // Only auto-scroll if we are already near bottom or it's a new message from self
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

            if (isNearBottom) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [state.messages]);

    // Initial scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView();
    }, []);

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();

        if (!inputValue.trim()) return;

        const message: ChatMessage = {
            id: uuidv4(),
            senderId: state.localParticipant?.id || 'anon',
            senderName: state.localParticipant?.name || 'Guest',
            content: inputValue.trim(),
            timestamp: Date.now(),
        };

        sendMessage(message);
        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Format timestamp
    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex flex-col h-full bg-black/20 rounded-xl overflow-hidden glass-card border flex-1 border-white/10">
            <div className="p-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Chat
                </h3>
                <span className="text-xs text-gray-400">{state.participants.length} online</span>
            </div>

            <div
                className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar"
                ref={scrollContainerRef}
            >
                {state.messages.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-4 italic">
                        Nog geen berichten. Zeg hoi! 👋
                    </div>
                ) : (
                    state.messages.map((msg) => {
                        const isMe = msg.senderId === state.localParticipant?.id;

                        return (
                            <div
                                key={msg.id}
                                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                            >
                                <div className="flex items-baseline gap-2 mb-1">
                                    {!isMe && <span className="text-xs font-medium text-gray-300">{msg.senderName}</span>}
                                    <span className="text-[10px] text-gray-500">{formatTime(msg.timestamp)}</span>
                                </div>
                                <div
                                    className={`px-3 py-2 rounded-lg text-sm max-w-[85%] break-words ${isMe
                                            ? 'bg-indigo-600/80 text-white rounded-br-none'
                                            : 'bg-white/10 text-gray-200 rounded-bl-none'
                                        }`}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-3 border-t border-white/5 bg-white/5">
                <div className="relative">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Typ een bericht..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors pr-10"
                        maxLength={500}
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </form>
        </div>
    );
}
