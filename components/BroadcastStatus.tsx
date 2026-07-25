
import React, { useState, useEffect } from 'react';
import { useBroadcast } from '../context/BroadcastContext';
import { CheckCircle, X, Loader2, Mail, Smartphone, Clock, Calendar, Check } from './ui/Icons';

const BroadcastStatus: React.FC = () => {
    const { isSending, isComplete, queueLength, progress, secondsRemaining, estimatedCompletionTime, cancelBroadcast, dismissComplete } = useBroadcast();
    const [timeString, setTimeString] = useState('');

    // Update ETA timer
    useEffect(() => {
        if (estimatedCompletionTime && isSending) {
            const updateTime = () => {
                const now = new Date();
                const diff = Math.max(0, estimatedCompletionTime.getTime() - now.getTime());
                const mins = Math.ceil(diff / 60000);
                
                if (mins > 60) {
                    const hrs = Math.floor(mins / 60);
                    setTimeString(`${hrs}h ${mins % 60}m`);
                } else {
                    setTimeString(`${mins} min`);
                }
            };
            updateTime();
            const interval = setInterval(updateTime, 1000);
            return () => clearInterval(interval);
        }
    }, [estimatedCompletionTime, isSending]);

    if (!isSending && !isComplete) return null;

    const percentage = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
    const pendingJobs = Math.max(0, queueLength - 1); // Current job is running, so queue - 1 are waiting

    return (
        <div className="fixed bottom-4 right-4 z-[9999] w-full max-w-sm animate-slide-up print:hidden">
            <div className="bg-zinc-900 text-white rounded-2xl shadow-2xl overflow-hidden border border-zinc-700">
                
                {/* Header */}
                <div className="p-4 flex justify-between items-center bg-zinc-800 border-b border-zinc-700">
                    <div className="flex items-center gap-2">
                        {isComplete ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                        )}
                        <div className="flex flex-col">
                            <h3 className="font-bold text-sm">
                                {isComplete ? 'All Tasks Complete' : 'Sending...'}
                            </h3>
                            {pendingJobs > 0 && !isComplete && (
                                <span className="text-[10px] text-blue-300 font-bold">
                                    +{pendingJobs} more job{pendingJobs > 1 ? 's' : ''} in queue
                                </span>
                            )}
                        </div>
                    </div>
                    {isComplete ? (
                        <button onClick={dismissComplete} className="p-1 hover:bg-zinc-700 rounded-full">
                            <X className="w-4 h-4 text-gray-400" />
                        </button>
                    ) : (
                        <button onClick={cancelBroadcast} className="text-[10px] bg-red-900/50 hover:bg-red-900 text-red-200 px-2 py-1 rounded border border-red-800 transition-colors">
                            Stop All
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-4">
                    {isComplete ? (
                        <div className="text-center py-2">
                            <p className="text-sm text-gray-300 mb-1">Queue cleared successfully.</p>
                            <div className="flex justify-center items-center gap-2 text-xs text-zinc-500 mt-2">
                                <Check className="w-3 h-3" /> System Ready
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>Processing: <span className="text-white font-bold truncate max-w-[120px] inline-block align-bottom">{progress.currentClientName}</span></span>
                                <span>{progress.processed} / {progress.total}</span>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden">
                                <div 
                                    className="bg-blue-500 h-full transition-all duration-500 ease-out"
                                    style={{ width: `${percentage}%` }}
                                ></div>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-1">
                                <div className="flex gap-3">
                                    <span className="flex items-center gap-1 text-gray-400">
                                        <Smartphone className="w-3 h-3" /> {progress.successSMS}
                                    </span>
                                    <span className="flex items-center gap-1 text-gray-400">
                                        <Mail className="w-3 h-3" /> {progress.successEmail}
                                    </span>
                                </div>
                                <span className="text-blue-400 font-mono font-bold">{percentage}%</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 mt-3">
                                {/* Next Message Timer */}
                                {secondsRemaining > 0 ? (
                                    <div className="bg-zinc-800/50 rounded-lg p-2 flex flex-col items-center justify-center border border-zinc-700/50">
                                        <div className="flex items-center gap-1 text-[10px] text-zinc-400 uppercase font-bold">
                                            <Clock className="w-3 h-3 text-yellow-500" /> Next Msg
                                        </div>
                                        <span className="font-bold text-white font-mono text-sm">{secondsRemaining}s</span>
                                    </div>
                                ) : (
                                    <div className="bg-zinc-800/50 rounded-lg p-2 flex items-center justify-center border border-zinc-700/50">
                                        <span className="text-xs text-zinc-500 italic">Processing...</span>
                                    </div>
                                )}

                                {/* Batch Completion ETA */}
                                <div className="bg-zinc-800/50 rounded-lg p-2 flex flex-col items-center justify-center border border-zinc-700/50">
                                    <div className="flex items-center gap-1 text-[10px] text-zinc-400 uppercase font-bold">
                                        <Calendar className="w-3 h-3 text-blue-500" /> Free In
                                    </div>
                                    <span className="font-bold text-white font-mono text-sm">
                                        {timeString || '--'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BroadcastStatus;
