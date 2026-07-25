
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { MessageSquare, Mail, Send, ChevronDown, User, Smartphone, Search, Loader2, ArrowRight, CheckCircle } from './ui/Icons';

type Tab = 'SMS' | 'EMAIL';
type View = 'LIST' | 'CHAT';

const ChatWidget: React.FC = () => {
    const { clients, messages, sendChatMessage, markMessagesAsRead } = useStore();
    
    // UI State
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<View>('LIST');
    const [activeTab, setActiveTab] = useState<Tab>('SMS');
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const selectedClient = useMemo(() => 
        clients.find(c => c.id === selectedClientId), 
    [clients, selectedClientId]);

    // Format Relative Time (Facebook Style)
    const formatTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // seconds

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) {
            const hrs = Math.floor(diff / 3600);
            return hrs === 1 ? '1h ago' : `${hrs}h ago`;
        }
        if (diff < 604800) { // < 7 days
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        }
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const formatMessageTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        
        // Time string e.g. "10:30 AM"
        const time = date.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'});
        
        if (isToday) return time;
        
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return `Yesterday at ${time}`;
        }
        
        return `${date.toLocaleDateString(undefined, {weekday: 'short'})} at ${time}`;
    };

    // Filter & Sort Clients Logic
    const sortedClients = useMemo(() => {
        return clients
            .filter(c => {
                const hasContact = activeTab === 'SMS' ? !!c.contactNumber : !!c.email;
                if (!hasContact) return false;

                const searchLower = searchTerm.toLowerCase();
                if (!searchLower) return true;
                return (
                    c.name.toLowerCase().includes(searchLower) || 
                    (c.contactNumber && c.contactNumber.includes(searchLower)) || 
                    (c.email && c.email.toLowerCase().includes(searchLower))
                );
            })
            .map(client => {
                const clientMessages = messages.filter(m => m.client_id === client.id && m.channel === activeTab);
                const lastMsg = clientMessages.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                const unreadCount = clientMessages.filter(m => m.direction === 'INBOUND' && !m.read).length;
                
                return {
                    ...client,
                    lastMsg,
                    lastMsgTime: lastMsg ? new Date(lastMsg.timestamp).getTime() : 0,
                    unreadCount
                };
            })
            .sort((a, b) => {
                if (a.lastMsgTime !== b.lastMsgTime) return b.lastMsgTime - a.lastMsgTime;
                return a.name.localeCompare(b.name);
            });
    }, [clients, messages, searchTerm, activeTab]);

    const activeConversation = useMemo(() => {
        if (!selectedClientId) return [];
        return messages
            .filter(m => m.client_id === selectedClientId && m.channel === activeTab)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [messages, selectedClientId, activeTab]);

    useEffect(() => {
        if (view === 'CHAT' && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [activeConversation, view]);

    useEffect(() => {
        if (view === 'CHAT' && selectedClientId) {
            markMessagesAsRead(selectedClientId, activeTab);
        }
    }, [view, selectedClientId, activeTab, markMessagesAsRead, messages]);

    const handleClientSelect = (clientId: string) => {
        setSelectedClientId(clientId);
        setView('CHAT');
        markMessagesAsRead(clientId, activeTab);
    };

    const handleBackToList = () => {
        setView('LIST');
        setSelectedClientId(null);
    };

    const handleSend = async () => {
        if (!inputValue.trim() || !selectedClientId) return;
        
        setIsSending(true);
        const success = await sendChatMessage(selectedClientId, inputValue, activeTab, 'OUTBOUND');
        setIsSending(false);
        
        if (success) {
            setInputValue('');
        } else {
            alert(`Failed to send message. Check settings.`);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-2xl z-[500] transition-all hover:scale-110 flex items-center justify-center animate-bounce-in"
                title="Open Messages"
            >
                <div className="relative">
                    <MessageSquare className="w-7 h-7" />
                    {sortedClients.reduce((acc, c) => acc + c.unreadCount, 0) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-blue-600">
                            {sortedClients.reduce((acc, c) => acc + c.unreadCount, 0)}
                        </span>
                    )}
                </div>
            </button>
        );
    }

    return (
        <div className={`fixed bottom-4 right-4 bg-white rounded-2xl shadow-2xl z-[500] flex flex-col border border-zinc-200 overflow-hidden font-sans transition-all duration-300 w-[380px] h-[600px]`}>
            
            {/* Header */}
            <div className="p-3 text-white shrink-0 shadow-sm flex justify-between items-center bg-blue-600">
                <div className="flex items-center gap-2">
                    {view === 'CHAT' && (
                        <button onClick={handleBackToList} className="p-1 hover:bg-white/10 rounded-full mr-1">
                            <ArrowRight className="w-5 h-5 rotate-180" />
                        </button>
                    )}
                    <h3 className="font-bold text-sm flex items-center gap-2">
                        {view === 'CHAT' && selectedClient ? selectedClient.name : 'GigglyPaws Messenger'}
                    </h3>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded">
                    <ChevronDown className="w-5 h-5" />
                </button>
            </div>

            {/* LIST VIEW */}
            {view === 'LIST' && (
                <div className="flex flex-col flex-1 overflow-hidden bg-zinc-50">
                    {/* Tabs */}
                    <div className="flex p-2 gap-2 bg-white border-b border-zinc-200">
                        <button 
                            onClick={() => setActiveTab('SMS')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors ${activeTab === 'SMS' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'text-zinc-500 hover:bg-zinc-50'}`}
                        >
                            <Smartphone className="w-3 h-3" /> SMS
                        </button>
                        <button 
                            onClick={() => setActiveTab('EMAIL')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors ${activeTab === 'EMAIL' ? 'bg-orange-50 text-orange-700 border border-orange-100' : 'text-zinc-500 hover:bg-zinc-50'}`}
                        >
                            <Mail className="w-3 h-3" /> Email
                        </button>
                    </div>

                    {/* Search */}
                    <div className="px-3 py-2 bg-white border-b border-zinc-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                            <input 
                                type="text" 
                                placeholder="Search clients..."
                                className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-100 rounded-full border-none focus:ring-1 focus:ring-blue-500 text-zinc-900 placeholder-zinc-400"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Client List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {sortedClients.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-zinc-400">
                                <User className="w-8 h-8 opacity-20 mb-2" />
                                <p className="text-xs">No clients found.</p>
                            </div>
                        ) : (
                            sortedClients.map(client => (
                                <div 
                                    key={client.id}
                                    onClick={() => handleClientSelect(client.id)}
                                    className="px-4 py-3 bg-white border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer flex gap-3 transition-colors relative"
                                >
                                    {/* Avatar */}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 relative ${activeTab === 'SMS' ? 'bg-blue-500' : 'bg-orange-500'}`}>
                                        {client.name.charAt(0).toUpperCase()}
                                        {/* Status Dot */}
                                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-0.5">
                                            <h4 className={`text-sm truncate pr-2 ${client.unreadCount > 0 ? 'font-bold text-black' : 'font-semibold text-zinc-800'}`}>
                                                {client.name}
                                            </h4>
                                            {client.lastMsgTime > 0 && (
                                                <span className={`text-[10px] shrink-0 ${client.unreadCount > 0 ? 'text-blue-600 font-bold' : 'text-zinc-400'}`}>
                                                    {formatTimeAgo(client.lastMsg!.timestamp)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className={`text-xs truncate max-w-[180px] ${client.unreadCount > 0 ? 'font-bold text-zinc-900' : 'text-zinc-500'}`}>
                                                {client.lastMsg ? (
                                                    client.lastMsg.direction === 'OUTBOUND' 
                                                    ? `You: ${client.lastMsg.content}` 
                                                    : client.lastMsg.content
                                                ) : <span className="italic text-zinc-300">No messages yet</span>}
                                            </p>
                                            
                                            {client.unreadCount > 0 && (
                                                <div className="bg-red-500 text-white text-[10px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center ml-2">
                                                    {client.unreadCount}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* CHAT VIEW */}
            {view === 'CHAT' && selectedClient && (
                <div className="flex flex-col flex-1 overflow-hidden bg-white">
                    {/* Sub-Header info */}
                    <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between text-xs text-zinc-500 shadow-sm z-10">
                        <div className="flex items-center gap-2">
                            {activeTab === 'SMS' ? <Smartphone className="w-3 h-3"/> : <Mail className="w-3 h-3"/>}
                            <span>{activeTab === 'SMS' ? selectedClient.contactNumber : selectedClient.email}</span>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 bg-white custom-scrollbar flex flex-col gap-3">
                        {activeConversation.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-300 gap-2 mt-10">
                                <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center">
                                    <MessageSquare className="w-8 h-8 opacity-20" />
                                </div>
                                <p className="text-xs">Start a conversation with {selectedClient.name}</p>
                                <p className="text-[10px] text-zinc-400 text-center max-w-[200px]">
                                    {activeTab === 'SMS' 
                                        ? 'Sent via SMS Gateway. Replies do not appear here.' 
                                        : 'Sent via Gmail API. Incoming emails sync automatically.'}
                                </p>
                            </div>
                        ) : (
                            activeConversation.map((msg, idx) => {
                                const isOutbound = msg.direction === 'OUTBOUND';
                                const prevMsg = idx > 0 ? activeConversation[idx-1] : null;
                                const isSameSender = prevMsg && prevMsg.direction === msg.direction;
                                const showGroupTimestamp = !prevMsg || (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() > 600000); 

                                return (
                                    <React.Fragment key={msg.id}>
                                        {showGroupTimestamp && (
                                            <div className="flex justify-center my-2">
                                                <span className="text-[10px] text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded-full border border-zinc-100 font-medium">
                                                    {formatMessageTime(msg.timestamp)}
                                                </span>
                                            </div>
                                        )}

                                        <div className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'} ${isSameSender ? 'mt-0.5' : 'mt-2'}`}>
                                            <div 
                                                className={`max-w-[85%] px-3 py-2 text-sm shadow-sm border relative group ${
                                                    isOutbound 
                                                    ? 'bg-blue-600 text-white border-blue-600 rounded-2xl rounded-tr-sm' 
                                                    : 'bg-zinc-100 text-zinc-800 border-zinc-200 rounded-2xl rounded-tl-sm'
                                                }`}
                                            >
                                                <p className="whitespace-pre-wrap leading-relaxed break-words">{msg.content}</p>
                                                
                                                {/* Hover Timestamp */}
                                                <span className={`absolute bottom-0 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap px-1 py-0.5 bg-black/70 text-white rounded pointer-events-none z-10 ${isOutbound ? '-left-14' : '-right-14'}`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                            
                                            {isOutbound && idx === activeConversation.length - 1 && (
                                                <div className="text-[9px] text-zinc-400 mt-1 mr-1 flex items-center gap-1">
                                                    {msg.status === 'FAILED' ? <span className="text-red-500 font-bold">Failed</span> : 'Sent'}
                                                    {msg.status !== 'FAILED' && <CheckCircle className="w-3 h-3 text-blue-500" />}
                                                </div>
                                            )}
                                        </div>
                                    </React.Fragment>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 border-t border-zinc-100 bg-white">
                        <div className="flex gap-2 items-end bg-zinc-100 p-2 rounded-3xl border border-zinc-200 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all">
                            <textarea 
                                rows={1}
                                className="flex-1 bg-transparent border-none focus:ring-0 resize-none text-sm text-zinc-900 placeholder-zinc-400 max-h-24 py-2 px-2"
                                placeholder={`Type ${activeTab === 'SMS' ? 'SMS' : 'email'} to send...`}
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                style={{ minHeight: '36px' }}
                            />
                            <button 
                                onClick={handleSend}
                                disabled={!inputValue.trim() || isSending}
                                className={`p-2 rounded-full transition-all flex-shrink-0 ${
                                    inputValue.trim() && !isSending
                                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md transform active:scale-95'
                                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                                }`}
                            >
                                {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatWidget;
