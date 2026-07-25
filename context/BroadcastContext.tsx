
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Client, StoreSettings } from '../types';
import { sendSMS, sendEmail } from '../services/notifications';
import { useStore } from './StoreContext';

export type BroadcastChannel = 'SMS' | 'EMAIL' | 'BOTH';

interface BroadcastJob {
    id: string;
    recipients: Client[];
    smsBody: string;
    emailSubject: string;
    emailBody: string;
    useSafeMode: boolean;
    channel: BroadcastChannel;
}

interface BroadcastProgress {
    processed: number;
    total: number;
    successSMS: number;
    successEmail: number;
    currentClientName: string;
}

interface BroadcastContextType {
    isSending: boolean;
    isComplete: boolean;
    queueLength: number; // Exposed to show pending jobs
    progress: BroadcastProgress;
    secondsRemaining: number; 
    estimatedCompletionTime: Date | null; 
    startBroadcast: (
        recipients: Client[], 
        smsBody: string, 
        emailSubject: string, 
        emailBody: string, 
        useSafeMode: boolean,
        channel: BroadcastChannel
    ) => void;
    cancelBroadcast: () => void;
    dismissComplete: () => void;
}

const BroadcastContext = createContext<BroadcastContextType | undefined>(undefined);

export const BroadcastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { storeSettings, checkAndIncrementSms } = useStore(); 
    
    const [isSending, setIsSending] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [secondsRemaining, setSecondsRemaining] = useState(0); 
    const [estimatedCompletionTime, setEstimatedCompletionTime] = useState<Date | null>(null);
    const [queueLength, setQueueLength] = useState(0);
    
    const [progress, setProgress] = useState<BroadcastProgress>({
        processed: 0, 
        total: 0, 
        successSMS: 0, 
        successEmail: 0,
        currentClientName: ''
    });

    // The Job Queue
    const jobQueueRef = useRef<BroadcastJob[]>([]);
    
    // Abort controller for the entire processing
    const abortControllerRef = useRef<boolean>(false);
    
    const settingsRef = useRef<StoreSettings>(storeSettings);
    const isProcessRunningRef = useRef<boolean>(false);

    useEffect(() => {
        settingsRef.current = storeSettings;
    }, [storeSettings]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isSending) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isSending]);

    // Public method to add jobs to queue
    const startBroadcast = (
        recipients: Client[], 
        smsBody: string, 
        emailSubject: string, 
        emailBody: string, 
        useSafeMode: boolean,
        channel: BroadcastChannel
    ) => {
        const newJob: BroadcastJob = {
            id: Date.now().toString() + Math.random(),
            recipients,
            smsBody,
            emailSubject,
            emailBody,
            useSafeMode,
            channel
        };

        jobQueueRef.current.push(newJob);
        setQueueLength(jobQueueRef.current.length);

        // If not currently running, kick off the processor
        if (!isProcessRunningRef.current) {
            abortControllerRef.current = false;
            processNextJob();
        }
    };

    // Main Queue Processor
    const processNextJob = async () => {
        if (jobQueueRef.current.length === 0) {
            isProcessRunningRef.current = false;
            setIsSending(false);
            // Only show "Complete" if we actually finished a job recently
            if (!abortControllerRef.current) {
                setIsComplete(true);
                setTimeout(() => setIsComplete(false), 5000); // Auto hide after 5s
            }
            return;
        }

        isProcessRunningRef.current = true;
        setIsComplete(false);
        setIsSending(true);

        const currentJob = jobQueueRef.current[0];
        
        // Calculate ETA for CURRENT job only (simplified for UI)
        const delayPerItem = currentJob.useSafeMode ? 125 : 5;
        const totalSeconds = Math.max(0, currentJob.recipients.length - 1) * delayPerItem;
        setEstimatedCompletionTime(new Date(Date.now() + totalSeconds * 1000));
        
        // Reset Progress for new job
        setProgress({
            processed: 0,
            total: currentJob.recipients.length,
            successSMS: 0,
            successEmail: 0,
            currentClientName: 'Preparing...'
        });

        // Execute the job
        await executeJob(currentJob);

        // Job Done (or Aborted)
        if (!abortControllerRef.current) {
            // Remove finished job from queue
            jobQueueRef.current.shift();
            setQueueLength(jobQueueRef.current.length);
            // Immediately process next
            processNextJob();
        } else {
            // If aborted, clear everything
            jobQueueRef.current = [];
            setQueueLength(0);
            isProcessRunningRef.current = false;
            setIsSending(false);
            setIsComplete(false);
        }
    };

    const smartDelay = async (ms: number) => {
        let remainingSeconds = Math.ceil(ms / 1000);
        setSecondsRemaining(remainingSeconds);

        while (remainingSeconds > 0) {
            if (abortControllerRef.current) return;
            await new Promise(r => setTimeout(r, 1000));
            remainingSeconds--;
            setSecondsRemaining(remainingSeconds);
        }
    };

    const executeJob = async (job: BroadcastJob) => {
        const recipients = job.recipients;
        const SAFE_SMS_DELAY = 125000; 
        const FAST_DELAY = 5000; 

        let smsCount = 0;
        let emailCount = 0;

        const shouldSendSMS = job.channel === 'SMS' || job.channel === 'BOTH';
        const shouldSendEmail = job.channel === 'EMAIL' || job.channel === 'BOTH';

        try {
            for (let i = 0; i < recipients.length; i++) {
                if (abortControllerRef.current) break;

                const client = recipients[i];
                let sentSMSThisTurn = false;

                setProgress(prev => ({ ...prev, currentClientName: client.name }));

                // 1. Send SMS (CHECK LIMIT FIRST)
                if (shouldSendSMS && settingsRef.current.smsEnabled && client.contactNumber) {
                    if (checkAndIncrementSms()) {
                        const res = await sendSMS(settingsRef.current, [client.contactNumber], job.smsBody);
                        if (res.success) {
                            smsCount++;
                            sentSMSThisTurn = true;
                        }
                    } else {
                        console.warn("SMS Limit Reached. Skipping SMS for " + client.name);
                    }
                }

                // 2. Send Email
                if (shouldSendEmail && settingsRef.current.emailEnabled && client.email) {
                    const res = await sendEmail(settingsRef.current, client.email, job.emailSubject, job.emailBody, "Notification");
                    if (res.success) emailCount++;
                }

                setProgress({
                    processed: i + 1,
                    total: recipients.length,
                    successSMS: smsCount,
                    successEmail: emailCount,
                    currentClientName: client.name
                });

                // Wait logic: only if there are more items in THIS job
                if (i < recipients.length - 1) {
                    const remainingItems = recipients.length - 1 - i;
                    
                    const isSmsSent = sentSMSThisTurn;
                    const delayToUse = (isSmsSent && job.useSafeMode) ? SAFE_SMS_DELAY : FAST_DELAY;
                    
                    const estimatedSecondsLeft = (remainingItems * delayToUse) / 1000;
                    setEstimatedCompletionTime(new Date(Date.now() + estimatedSecondsLeft * 1000));

                    await smartDelay(delayToUse);
                }
            }
        } catch (err) {
            console.error("Job interrupted", err);
        }
    };

    const cancelBroadcast = () => {
        abortControllerRef.current = true;
        setSecondsRemaining(0);
        setEstimatedCompletionTime(null);
        // The process loop detects abort and cleans up
    };

    const dismissComplete = () => {
        setIsComplete(false);
    };

    return (
        <BroadcastContext.Provider value={{ 
            isSending, 
            isComplete,
            queueLength, 
            progress, 
            secondsRemaining,
            estimatedCompletionTime,
            startBroadcast, 
            cancelBroadcast,
            dismissComplete
        }}>
            {children}
        </BroadcastContext.Provider>
    );
};

export const useBroadcast = () => {
    const context = useContext(BroadcastContext);
    if (!context) throw new Error('useBroadcast must be used within BroadcastProvider');
    return context;
};
