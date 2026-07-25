
import { StoreSettings, GroomingAppointment, Product } from "../types";

// Helper to replace placeholders
const replaceVariables = (template: string, data: Record<string, string | number>) => {
    let result = template;
    for (const key in data) {
        result = result.replace(new RegExp(`{${key}}`, 'g'), String(data[key]));
    }
    return result;
};

// Strict Contact Sanitizer for SMS Gateway
const sanitizeForSms = (num: string) => {
    // 1. Remove all non-numeric chars
    let cleaned = num.replace(/[^0-9]/g, '');

    // 2. Handle International format (639...) -> 09...
    if (cleaned.startsWith('639')) {
        cleaned = '0' + cleaned.substring(2);
    }
    
    // 3. Handle Missing Leading Zero (917...) -> 0917...
    if (cleaned.length === 10 && cleaned.startsWith('9')) {
        cleaned = '0' + cleaned;
    }

    return cleaned;
};

// Get status-specific content
export const getNotificationContent = (settings: StoreSettings, status: 'UPCOMING' | 'WAITING' | 'ONGOING' | 'COMPLETED', apt: GroomingAppointment, serviceName: string, price: number) => {
    const data = {
        ownerName: apt.ownerName,
        petName: apt.petName,
        serviceName: serviceName,
        time: apt.time, 
        date: apt.date,
        shopName: settings.name,
        price: price
    };

    let smsTemplate = "";
    let emailSubject = "";
    let emailBody = "";

    switch (status) {
        case 'UPCOMING':
            smsTemplate = settings.smsTemplateUpcoming || "Hi {ownerName}! Reminder: {petName} at {shopName} on {date} {time}.";
            emailSubject = settings.emailSubjectUpcoming || "Appointment Reminder";
            emailBody = settings.emailBodyUpcoming || "Reminder for {petName}'s appointment.";
            break;
        case 'WAITING':
            smsTemplate = settings.smsTemplateWaiting || "{petName} is checked in at {shopName}.";
            emailSubject = settings.emailSubjectWaiting || "Checked In";
            emailBody = settings.emailBodyWaiting || "{petName} is checked in and waiting.";
            break;
        case 'ONGOING':
            smsTemplate = settings.smsTemplateOngoing || "{petName} has started grooming at {shopName}.";
            emailSubject = settings.emailSubjectOngoing || "Grooming Started";
            emailBody = settings.emailBodyOngoing || "Grooming session started for {petName}.";
            break;
        case 'COMPLETED':
            smsTemplate = settings.smsTemplateCompleted || "{petName} is ready! Total: {price}.";
            emailSubject = settings.emailSubjectCompleted || "Ready for Pickup";
            emailBody = settings.emailBodyCompleted || "Good news! {petName} is ready to go home.";
            break;
    }

    return {
        sms: replaceVariables(smsTemplate, data),
        emailSubject: replaceVariables(emailSubject, data),
        emailBody: replaceVariables(emailBody, data)
    };
};

// --- HTML EMAIL TEMPLATE GENERATOR ---
export const generateGroomingEmailHtml = (settings: StoreSettings, messageContent: string, title: string = "Appointment Update") => {
    const primaryColor = "#000000"; 
    const footerText = settings.emailFooterText || "Thank you for trusting us with your furry friend!";
    
    const address = (settings.address && settings.address !== 'undefined') ? `<br>${settings.address}` : '';
    const contact = (settings.contactNumber && settings.contactNumber !== 'undefined') ? `<br>${settings.contactNumber}` : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background-color: ${primaryColor}; padding: 40px 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">${title}</h1>
                <p style="color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-top: 10px; font-weight: bold;">${settings.name}</p>
            </div>
            <div style="padding: 40px 30px;">
                <div style="font-size: 16px; color: #333333; line-height: 1.6;">
                    ${messageContent.replace(/\n/g, '<br>')}
                </div>
                <p style="font-size: 14px; color: #666; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                    ${footerText}
                </p>
            </div>
            <div style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eeeeee;">
                <p style="font-size: 12px; color: #999; margin: 0;">
                    <strong>${settings.name || 'GigglyPaws'}</strong>
                    ${address}
                    ${contact}
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
};

// --- TEXTBEE.DEV SMS ---
export const sendSMS = async (settings: StoreSettings, recipients: string[], message: string) => {
    if (!settings.smsEnabled || !settings.textBeeApiKey || !settings.textBeeDeviceId) {
        console.warn("SMS Sending Disabled or Missing Config");
        return { success: false, error: 'Configuration Missing' };
    }

    const cleanRecipients = recipients.map(sanitizeForSms).filter(num => num.length >= 10);

    if (cleanRecipients.length === 0) {
        console.warn("No valid recipients after sanitization.");
        return { success: false, error: 'Invalid Numbers' };
    }

    const payload = { recipients: cleanRecipients, message: message };

    try {
        const response = await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${settings.textBeeDeviceId}/sendSMS`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': settings.textBeeApiKey },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`TextBee API Error: ${err}`);
        }
        const data = await response.json();
        return { success: true, data };
    } catch (error: any) {
        console.error("SMS Send Failed:", error);
        return { success: false, error: error.message };
    }
};

// --- GMAIL API DIRECT ---

// EXPORTED for Context
export const refreshAccessToken = async (settings: StoreSettings) => {
    const clientId = settings.googleClientId?.trim();
    const clientSecret = settings.googleClientSecret?.trim();
    const refreshToken = settings.googleRefreshToken?.trim();

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("Missing Google credentials.");
    }

    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');

    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const rawText = await response.text();
        let data: any;
        try { data = JSON.parse(rawText); } catch (e) { throw new Error("Invalid response from Google"); }

        if (!response.ok) {
            if (data.error === 'invalid_grant') throw new Error("Refresh Token Expired.");
            if (data.error === 'invalid_client') throw new Error("Invalid Client ID/Secret.");
            throw new Error(`Token Refresh Failed: ${data.error_description || data.error}`);
        }
        return data.access_token;
    } catch (error: any) {
        console.error("Token Refresh Exception:", error);
        throw error;
    }
};

const stripHtml = (html: string) => {
   return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/p>/gi, '\n\n')
              .replace(/<[^>]+>/g, '')
              .replace(/&nbsp;/g, ' ')
              .trim();
};

// --- GMAIL INBOX FETCHING ---

const extractEmailAddress = (fromHeader: string): string => {
    // Matches "Name <email@domain.com>" or just "email@domain.com"
    const match = fromHeader.match(/<([^>]+)>/);
    return match ? match[1] : fromHeader;
};

// Recursively find text body in Gmail Payload parts
const findBody = (payload: any): string => {
    // 1. If strict body data exists (simple emails)
    if (payload.body && payload.body.data) {
        return payload.body.data;
    }

    // 2. If it has parts (multipart/alternative or mixed)
    if (payload.parts) {
        // Preference: text/plain first to avoid parsing HTML if possible for cleaner chat
        let textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
        
        // If not found, look for text/html
        if (!textPart) {
            textPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
        }

        // If still not found, RECURSE into sub-parts (some emails are nested deep)
        if (!textPart) {
            for (const part of payload.parts) {
                const found = findBody(part);
                if (found) return found;
            }
        }

        if (textPart && textPart.body && textPart.body.data) {
            return textPart.body.data;
        }
    }
    return "";
};

export const checkGmailInbox = async (settings: StoreSettings) => {
    if (!settings.googleRefreshToken || !settings.googleClientId) return [];

    try {
        const token = await refreshAccessToken(settings);
        
        // Query INBOX for UNREAD messages
        const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=label:INBOX is:unread&maxResults=10', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!listRes.ok) return []; 
        const listData = await listRes.json();
        
        if (!listData.messages || listData.messages.length === 0) return [];

        const emails = [];

        for (const msg of listData.messages) {
            const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (detailRes.ok) {
                const detailData = await detailRes.json();
                const headers = detailData.payload.headers;
                const fromHeader = headers.find((h: any) => h.name === 'From')?.value || '';
                const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(No Subject)';
                const dateHeader = headers.find((h: any) => h.name === 'Date')?.value;
                
                // ROBUST EXTRACTION
                const senderEmail = extractEmailAddress(fromHeader);
                let bodyEncoded = findBody(detailData.payload);
                let body = "(No content)";

                if (bodyEncoded) {
                    try {
                        const decoded = atob(bodyEncoded.replace(/-/g, '+').replace(/_/g, '/'));
                        body = stripHtml(decoded);
                    } catch (e) {
                        body = "(Content decoding failed)";
                    }
                }

                emails.push({
                    id: msg.id,
                    sender: senderEmail.trim(), // Trim whitespace
                    subject,
                    body,
                    timestamp: dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString()
                });

                // Mark as READ to prevent re-fetching
                await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/modify`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
                });
            }
        }
        return emails;

    } catch (e) {
        console.error("Inbox Check Failed:", e);
        return [];
    }
};

export const sendGmailDirect = async (settings: StoreSettings, to: string, subject: string, messageContent: string, title: string) => {
    try {
        const accessToken = await refreshAccessToken(settings);
        const boundaryAlt = "pawfriends_alt_" + Date.now();
        const finalHtml = generateGroomingEmailHtml(settings, messageContent, title);
        const plainText = stripHtml(finalHtml);
        const messageParts: string[] = [];
        const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@pawfriends.app>`;
        
        messageParts.push(`MIME-Version: 1.0`);
        messageParts.push(`To: ${to}`);
        messageParts.push(`From: "${settings.emailSenderName || settings.name}" <notifications@pawfriends.app>`);
        messageParts.push(`Subject: ${subject}`);
        messageParts.push(`Date: ${new Date().toUTCString()}`);
        messageParts.push(`Message-ID: ${messageId}`);
        messageParts.push(`Content-Type: multipart/alternative; boundary="${boundaryAlt}"`);
        messageParts.push(``); 
        messageParts.push(`--${boundaryAlt}`);
        messageParts.push(`Content-Type: text/plain; charset="UTF-8"`);
        messageParts.push(``);
        messageParts.push(plainText);
        messageParts.push(``);
        messageParts.push(`--${boundaryAlt}`);
        messageParts.push(`Content-Type: text/html; charset="UTF-8"`);
        messageParts.push(``);
        messageParts.push(finalHtml);
        messageParts.push(``);
        messageParts.push(`--${boundaryAlt}--`);

        const rawMessage = messageParts.join("\r\n");
        const encodedEmail = btoa(unescape(encodeURIComponent(rawMessage))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw: encodedEmail })
        });

        if (!response.ok) {
            let err;
            try { err = await response.json(); } catch { err = { message: response.statusText }; }
            if (response.status === 401 || response.status === 403) throw new Error("Unauthorized. Check scopes.");
            throw new Error(`Gmail API Error: ${err.error?.message || JSON.stringify(err)}`);
        }
        return { success: true };
    } catch (error: any) {
        console.error("Gmail Direct Send Failed:", error);
        return { success: false, error: error.message || String(error) };
    }
};

export const sendEmail = async (settings: StoreSettings, to: string, subject: string, messageContent: string, title: string = "Notification") => {
    if (!settings.emailEnabled) return { success: false, error: 'Email Disabled' };
    if (settings.googleRefreshToken && settings.googleClientId) {
        return sendGmailDirect(settings, to, subject, messageContent, title);
    }
    return { success: false, error: 'No Email Service Configured' };
};

export const sendCompletionNotifications = async (settings: StoreSettings, apt: GroomingAppointment, service: Product | undefined) => {
    const results = { sms: false, email: false };
    const serviceName = service ? service.name : "Grooming Service";
    const price = service ? service.price : 0;
    const content = getNotificationContent(settings, 'COMPLETED', apt, serviceName, price);

    if (settings.smsEnabled && apt.contactNumber) {
        const smsRes = await sendSMS(settings, [apt.contactNumber], content.sms);
        results.sms = smsRes.success;
    }
    if (settings.emailEnabled && apt.email) {
        const emailRes = await sendEmail(settings, apt.email, content.emailSubject, content.emailBody, "Ready for Pickup!");
        results.email = emailRes.success;
    }
    return results;
};
