
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Product, User, Transaction, GroomingAppointment, Discount, Log, StoreSettings, Role, Device, Client, Pet, DiscountTrigger, SmsUsage, TemplateHistory, Message, HotelRoom, HotelBooking, HotelBookingStatus } from '../types';
import { 
  INITIAL_STORE_SETTINGS
} from '../constants';
import { supabase, subscribeToTable, fetchTable, upsertData, deleteData } from '../services/supabase';
import { hashPin, generateSalt } from '../services/crypto';
import { getDeviceId, getDeviceInfo, getNetworkInfo } from '../services/device';
import { load, save } from '../services/storage';
import { sendSMS, sendEmail, checkGmailInbox } from '../services/notifications';

// --- DATA MAPPERS (Database Schema <-> App Types) ---

// Client Table uses snake_case: contact_number
const mapClient = (c: any): Client => ({
    id: c.id,
    name: c.name,
    contactNumber: c.contact_number || '', // snake_case in DB
    email: c.email || '',
    address: c.address || '',
    notes: c.notes || '',
    firstSeen: c.first_seen || new Date().toISOString(),
    pets: c.pets || []
});

const mapClientPayload = (c: Client) => ({
    id: c.id,
    name: c.name,
    contact_number: c.contactNumber, // snake_case in DB
    email: c.email,
    address: c.address,
    notes: c.notes,
    first_seen: c.firstSeen,
    pets: c.pets
});

// Discount Mappers
const mapDiscount = (d: any): Discount => ({
    id: d.id,
    name: d.name,
    type: d.type,
    value: d.value,
    active: d.active,
    triggerType: d.trigger_type || 'MANUAL',
    triggerValue: d.trigger_value,
    startDate: d.start_date,
    endDate: d.end_date,
    isPermanent: d.is_permanent ?? true
});

const mapDiscountPayload = (d: Discount) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    value: d.value,
    active: d.active,
    trigger_type: d.triggerType,
    trigger_value: d.triggerValue,
    start_date: d.startDate,
    end_date: d.endDate,
    is_permanent: d.isPermanent
});

// Transaction Mappers (CamelCase Quoted in DB)
const mapTransaction = (t: any): Transaction => ({
    id: t.id || Date.now().toString(),
    items: t.items || [],
    subtotal: Number(t.subtotal || 0),
    vat: Number(t.vat || 0),
    total: Number(t.total || 0),
    discount: Number(t.discount || 0),
    paymentMethod: t.paymentMethod || 'CASH', // CamelCase in DB
    gcashRef: t.gcashRef || '',               // CamelCase in DB
    cashierId: t.cashierId || 'unknown',      // CamelCase in DB
    cashReceived: Number(t.cashReceived || 0),// CamelCase in DB
    date: t.date || new Date().toISOString()
});

const mapTransactionPayload = (t: Transaction) => ({
    id: t.id,
    items: t.items,
    subtotal: t.subtotal,
    vat: t.vat,
    total: t.total,
    discount: t.discount,
    "paymentMethod": t.paymentMethod, // Quoted CamelCase for DB
    "gcashRef": t.gcashRef,           
    "cashReceived": t.cashReceived,   
    date: t.date,
    "cashierId": t.cashierId          
});

// Products (CamelCase "isService")
const mapProduct = (p: any): Product => ({
    ...p,
    isService: p.isService ?? false, // CamelCase in DB
    petSpecies: p.pet_species || 'BOTH',
    weightSizeCategory: p.weight_size_category || 'ALL'
});

const mapProductPayload = (p: Product) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    cost: p.cost,
    stock: p.stock,
    category: p.category,
    "isService": p.isService, // Quoted CamelCase for DB
    pet_species: p.petSpecies || 'BOTH',
    weight_size_category: p.weightSizeCategory || 'ALL'
});

// Appointments (CamelCase Quoted Columns)
const mapAppointment = (a: any): GroomingAppointment => ({
    ...a,
    petName: a.petName,
    petBreed: a.petBreed,
    petColor: a.petColor,
    weightSize: a.weightSize,
    petSpecies: a.pet_species || undefined,
    detectedSizeCategory: a.detected_size_category || undefined,
    ownerName: a.ownerName,
    contactNumber: a.contactNumber, // CamelCase in Appointments table
    email: a.email,
    serviceId: a.serviceId,
    hairCut: a.hairCut,
    addonIds: a.addon_ids || [],
    groomerId: a.groomerId
});

const mapAppointmentPayload = (a: GroomingAppointment) => ({
    id: a.id,
    "petName": a.petName,
    "petBreed": a.petBreed,
    "petColor": a.petColor,
    "weightSize": a.weightSize,
    pet_species: a.petSpecies || null,
    detected_size_category: a.detectedSizeCategory || null,
    "ownerName": a.ownerName,
    "contactNumber": a.contactNumber, // Quoted CamelCase
    email: a.email,
    "serviceId": a.serviceId,
    "hairCut": a.hairCut,
    addon_ids: a.addonIds || [],
    date: a.date,
    time: a.time,
    status: a.status,
    "groomerId": a.groomerId
});

// Hotel Room Mappers (all snake_case in DB)
const mapHotelRoom = (r: any): HotelRoom => ({
    id: r.id,
    room_number: r.room_number || '',
    room_name: r.room_name || '',
    room_type: r.room_type || 'Standard',
    daily_rate: Number(r.daily_rate || 0),
    capacity: Number(r.capacity || 1),
    description: r.description || '',
    is_active: r.is_active ?? true,
});

const mapHotelBooking = (b: any): HotelBooking => ({
    id: b.id,
    room_id: b.room_id || '',
    client_id: b.client_id || '',
    pet_id: b.pet_id || '',
    pet_name: b.pet_name || '',
    owner_name: b.owner_name || '',
    contact_number: b.contact_number || '',
    email: b.email || '',
    check_in: b.check_in || '',
    check_out: b.check_out || '',
    actual_check_in: b.actual_check_in || '',
    actual_check_out: b.actual_check_out || '',
    status: b.status || 'RESERVED',
    daily_rate: Number(b.daily_rate || 0),
    total_nights: Number(b.total_nights || 0),
    total_amount: Number(b.total_amount || 0),
    addon_ids: b.addon_ids || [],
    notes: b.notes || '',
    staff_id: b.staff_id || '',
    transaction_id: b.transaction_id || '',
    booking_type: b.booking_type || '',
    pet_size: b.pet_size || '',
    hotel_extras: b.hotel_extras || [],
});


// Map Settings (Mixed Case in DB)
const mapSettingsPayload = (s: StoreSettings) => ({
    id: 'global_settings',
    name: s.name,
    address: s.address,
    "contactNumber": s.contactNumber, // Quoted CamelCase
    "vatRate": s.vatRate,             // Quoted CamelCase
    hotel_vat_enabled: s.hotelVatEnabled ?? false,
    auto_approve_users: s.autoApproveUsers ?? true,
    hotel_rates: s.hotelRates ? JSON.stringify(s.hotelRates) : null,
    hotel_booking_type_labels: s.hotelBookingTypeLabels ? JSON.stringify(s.hotelBookingTypeLabels) : null,
    hotel_extras: s.hotelExtras ? JSON.stringify(s.hotelExtras) : null,
    "gcashNumber": s.gcashNumber,     // Quoted CamelCase
    "gcashQr": s.gcashQr,             // Quoted CamelCase
    "receiptHeader": s.receiptHeader, // Quoted CamelCase
    "receiptFooter": s.receiptFooter, // Quoted CamelCase
    receipt_paper_size: s.receiptPaperSize || '80mm',
    
    logo: s.logo,
    sms_enabled: s.smsEnabled,
    text_bee_api_key: s.textBeeApiKey,
    text_bee_device_id: s.textBeeDeviceId,
    email_enabled: s.emailEnabled,
    email_sender_name: s.emailSenderName,
    email_footer_text: s.emailFooterText,
    
    google_client_id: s.googleClientId,
    google_client_secret: s.googleClientSecret,
    google_refresh_token: s.googleRefreshToken,

    // Templates
    sms_template_upcoming: s.smsTemplateUpcoming,
    email_subject_upcoming: s.emailSubjectUpcoming,
    email_body_upcoming: s.emailBodyUpcoming,
    sms_template_waiting: s.smsTemplateWaiting,
    email_subject_waiting: s.emailSubjectWaiting,
    email_body_waiting: s.emailBodyWaiting,
    sms_template_ongoing: s.smsTemplateOngoing,
    email_subject_ongoing: s.emailSubjectOngoing,
    email_body_ongoing: s.emailBodyOngoing,
    sms_template_completed: s.smsTemplateCompleted,
    email_subject_completed: s.emailSubjectCompleted,
    email_body_completed: s.emailBodyCompleted,
    sms_template_promo: s.smsTemplatePromo,
    email_subject_promo: s.emailSubjectPromo,
    email_body_promo: s.emailBodyPromo,
    // Hotel Templates
    sms_template_hotel_booked: s.smsTemplateHotelBooked,
    email_subject_hotel_booked: s.emailSubjectHotelBooked,
    email_body_hotel_booked: s.emailBodyHotelBooked,
    sms_template_hotel_checkin: s.smsTemplateHotelCheckin,
    email_subject_hotel_checkin: s.emailSubjectHotelCheckin,
    email_body_hotel_checkin: s.emailBodyHotelCheckin,
    sms_template_hotel_reminder: s.smsTemplateHotelReminder,
    email_subject_hotel_reminder: s.emailSubjectHotelReminder,
    email_body_hotel_reminder: s.emailBodyHotelReminder,
    sms_template_hotel_checkout: s.smsTemplateHotelCheckout,
    email_subject_hotel_checkout: s.emailSubjectHotelCheckout,
    email_body_hotel_checkout: s.emailBodyHotelCheckout,
});

const mapSettingsFromDb = (s: any): Partial<StoreSettings> => ({
    name: s.name,
    address: s.address,
    contactNumber: s.contactNumber, // CamelCase from DB
    vatRate: s.vatRate,             // CamelCase from DB
    hotelVatEnabled: s.hotel_vat_enabled ?? false,
    autoApproveUsers: s.auto_approve_users ?? true,
    hotelRates: s.hotel_rates ? (typeof s.hotel_rates === 'string' ? JSON.parse(s.hotel_rates) : s.hotel_rates) : undefined,
    hotelBookingTypeLabels: s.hotel_booking_type_labels ? (typeof s.hotel_booking_type_labels === 'string' ? JSON.parse(s.hotel_booking_type_labels) : s.hotel_booking_type_labels) : undefined,
    hotelExtras: s.hotel_extras ? (typeof s.hotel_extras === 'string' ? JSON.parse(s.hotel_extras) : s.hotel_extras) : undefined,
    gcashNumber: s.gcashNumber,     // CamelCase from DB
    gcashQr: s.gcashQr,             // CamelCase from DB
    receiptHeader: s.receiptHeader, // CamelCase from DB
    receiptFooter: s.receiptFooter, // CamelCase from DB
    receiptPaperSize: (s.receipt_paper_size as '48mm' | '58mm' | '80mm') || '80mm',
    
    logo: s.logo,
    smsEnabled: s.sms_enabled ?? false,
    textBeeApiKey: s.text_bee_api_key,
    textBeeDeviceId: s.text_bee_device_id,
    emailEnabled: s.email_enabled ?? false,
    
    googleClientId: s.google_client_id,
    googleClientSecret: s.google_client_secret,
    googleRefreshToken: s.google_refresh_token,
    
    emailSenderName: s.email_sender_name,
    emailFooterText: s.email_footer_text || INITIAL_STORE_SETTINGS.emailFooterText,
    smsTemplateUpcoming: s.sms_template_upcoming || INITIAL_STORE_SETTINGS.smsTemplateUpcoming,
    emailSubjectUpcoming: s.email_subject_upcoming || INITIAL_STORE_SETTINGS.emailSubjectUpcoming,
    emailBodyUpcoming: s.email_body_upcoming || INITIAL_STORE_SETTINGS.emailBodyUpcoming,
    smsTemplateWaiting: s.sms_template_waiting || INITIAL_STORE_SETTINGS.smsTemplateWaiting,
    emailSubjectWaiting: s.email_subject_waiting || INITIAL_STORE_SETTINGS.emailSubjectWaiting,
    emailBodyWaiting: s.email_body_waiting || INITIAL_STORE_SETTINGS.emailBodyWaiting,
    smsTemplateOngoing: s.sms_template_ongoing || INITIAL_STORE_SETTINGS.smsTemplateOngoing,
    emailSubjectOngoing: s.email_subject_ongoing || INITIAL_STORE_SETTINGS.emailSubjectOngoing,
    emailBodyOngoing: s.email_body_ongoing || INITIAL_STORE_SETTINGS.emailBodyOngoing,
    smsTemplateCompleted: s.sms_template_completed || INITIAL_STORE_SETTINGS.smsTemplateCompleted,
    emailSubjectCompleted: s.email_subject_completed || INITIAL_STORE_SETTINGS.emailSubjectCompleted,
    emailBodyCompleted: s.email_body_completed || INITIAL_STORE_SETTINGS.emailBodyCompleted,
    smsTemplatePromo: s.sms_template_promo || INITIAL_STORE_SETTINGS.smsTemplatePromo,
    emailSubjectPromo: s.email_subject_promo || INITIAL_STORE_SETTINGS.emailSubjectPromo,
    emailBodyPromo: s.email_body_promo || INITIAL_STORE_SETTINGS.emailBodyPromo,
    // Hotel Templates
    smsTemplateHotelBooked: s.sms_template_hotel_booked || INITIAL_STORE_SETTINGS.smsTemplateHotelBooked,
    emailSubjectHotelBooked: s.email_subject_hotel_booked || INITIAL_STORE_SETTINGS.emailSubjectHotelBooked,
    emailBodyHotelBooked: s.email_body_hotel_booked || INITIAL_STORE_SETTINGS.emailBodyHotelBooked,
    smsTemplateHotelCheckin: s.sms_template_hotel_checkin || INITIAL_STORE_SETTINGS.smsTemplateHotelCheckin,
    emailSubjectHotelCheckin: s.email_subject_hotel_checkin || INITIAL_STORE_SETTINGS.emailSubjectHotelCheckin,
    emailBodyHotelCheckin: s.email_body_hotel_checkin || INITIAL_STORE_SETTINGS.emailBodyHotelCheckin,
    smsTemplateHotelReminder: s.sms_template_hotel_reminder || INITIAL_STORE_SETTINGS.smsTemplateHotelReminder,
    emailSubjectHotelReminder: s.email_subject_hotel_reminder || INITIAL_STORE_SETTINGS.emailSubjectHotelReminder,
    emailBodyHotelReminder: s.email_body_hotel_reminder || INITIAL_STORE_SETTINGS.emailBodyHotelReminder,
    smsTemplateHotelCheckout: s.sms_template_hotel_checkout || INITIAL_STORE_SETTINGS.smsTemplateHotelCheckout,
    emailSubjectHotelCheckout: s.email_subject_hotel_checkout || INITIAL_STORE_SETTINGS.emailSubjectHotelCheckout,
    emailBodyHotelCheckout: s.email_body_hotel_checkout || INITIAL_STORE_SETTINGS.emailBodyHotelCheckout,
});

// Map Device Payload ("lastActive" CamelCase)
const mapDevicePayload = (d: Device) => ({
    id: d.id,
    name: d.name,
    custom_name: d.custom_name,
    os: d.os,
    browser: d.browser,
    device_type: d.device_type,
    status: d.status,
    "lastActive": d.lastActive, // Quoted CamelCase for DB
    ip: d.ip,
    location: d.location
});

const mapDeviceFromDb = (d: any): Device => ({
    id: d.id,
    name: d.name,
    custom_name: d.custom_name,
    os: d.os,
    browser: d.browser,
    device_type: d.device_type,
    status: d.status,
    lastActive: d.lastActive, // CamelCase from DB
    ip: d.ip,
    location: d.location
});

// Map Log Payload ("userId", "referenceId" CamelCase)
const mapLogPayload = (l: Log) => ({
    id: l.id,
    action: l.action,
    details: l.details,
    timestamp: l.timestamp,
    "userId": l.userId,       // Quoted CamelCase for DB
    "referenceId": l.referenceId // Quoted CamelCase for DB
});

const mapLogFromDb = (l: any): Log => ({
    id: l.id,
    action: l.action,
    details: l.details,
    timestamp: l.timestamp,
    userId: l.userId,         // CamelCase from DB
    referenceId: l.referenceId // CamelCase from DB
});

interface StoreContextType {
  isLoading: boolean;
  isSystemSetup: boolean; // False if no users exist
  currentUser: User | null;
  users: User[];
  products: Product[];
  transactions: Transaction[];
  appointments: GroomingAppointment[];
  clients: Client[];
  discounts: Discount[];
  logs: Log[];
  devices: Device[];
  templateHistory: TemplateHistory[];
  messages: Message[];
  currentDeviceId: string;
  currentDeviceStatus: 'PENDING' | 'APPROVED' | 'BLOCKED';
  
  // Settings
  storeSettings: StoreSettings;
  updateStoreSettings: (settings: StoreSettings) => void;

  // SMS Usage Tracking
  smsUsage: SmsUsage;
  checkAndIncrementSms: () => boolean; // Returns true if allowed, false if blocked
  
  // Split Categories
  productCategories: string[];
  serviceCategories: string[];
  
  // Actions
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  // User Management
  addUser: (user: User) => void;
  editUser: (user: User) => void;
  deleteUser: (id: string) => void;
  approveUser: (id: string) => void;
  rejectUser: (id: string) => void;
  
  // Device Management
  registerDevice: () => Promise<void>;
  updateDeviceStatus: (deviceId: string, status: 'APPROVED' | 'BLOCKED', customName?: string) => void;
  deleteDevice: (deviceId: string) => void;
  
  // Other Actions
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (id: string, amount: number) => void;
  
  addTransaction: (transaction: Transaction) => void;
  deleteTransaction: (id: string) => void;
  updateTransaction: (oldTx: Transaction, newTx: Transaction) => void;

  addAppointment: (apt: GroomingAppointment) => void;
  updateAppointment: (apt: GroomingAppointment) => void;
  deleteAppointment: (id: string) => void;
  updateAppointmentStatus: (id: string, status: any) => void;
  addLog: (action: string, details: string, referenceId?: string) => void;
  
  // Client Actions
  addClient: (client: Client) => void;
  updateClient: (client: Client) => void;
  deleteClient: (id: string) => void;

  // Discount Actions
  addDiscount: (discount: Discount) => void;
  toggleDiscount: (id: string) => void;
  deleteDiscount: (id: string) => void;

  // Category Actions
  addProductCategory: (category: string) => void;
  editProductCategory: (oldName: string, newName: string) => void;
  deleteProductCategory: (category: string) => void;
  addServiceCategory: (category: string) => void;
  editServiceCategory: (oldName: string, newName: string) => void;
  deleteServiceCategory: (category: string) => void;

  // Template History Actions
  saveTemplateHistory: (category: 'GROOMING' | 'PROMO', channel: 'SMS' | 'EMAIL_SUBJECT' | 'EMAIL_BODY' | 'EMAIL_FOOTER', content: string) => void;
  deleteTemplateHistory: (id: string) => void;

  // Chat Actions
  sendChatMessage: (clientId: string, content: string, channel: 'SMS' | 'EMAIL', direction?: 'INBOUND' | 'OUTBOUND') => Promise<boolean>;
  markMessagesAsRead: (clientId: string, channel: 'SMS' | 'EMAIL') => Promise<void>;

  // Hotel Actions
  hotelRooms: HotelRoom[];
  hotelBookings: HotelBooking[];
  addHotelRoom: (room: HotelRoom) => Promise<void>;
  updateHotelRoom: (room: HotelRoom) => Promise<void>;
  deleteHotelRoom: (id: string) => Promise<void>;
  addHotelBooking: (booking: HotelBooking) => Promise<void>;
  updateHotelBooking: (booking: HotelBooking) => Promise<void>;
  deleteHotelBooking: (id: string) => Promise<void>;
  checkInGuest: (bookingId: string) => Promise<void>;
  checkOutGuest: (bookingId: string, paymentMethod: 'CASH' | 'GCASH' | 'SPLIT', cashReceived?: number, gcashRef?: string, recalcTotal?: number) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSystemSetup, setIsSystemSetup] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentDeviceId] = useState(getDeviceId());
  
  // Data States
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(INITIAL_STORE_SETTINGS);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [appointments, setAppointments] = useState<GroomingAppointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [templateHistory, setTemplateHistory] = useState<TemplateHistory[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hotelRooms, setHotelRooms] = useState<HotelRoom[]>([]);
  const [hotelBookings, setHotelBookings] = useState<HotelBooking[]>([]);
  
  // Initialize with Empty Arrays (Connect strictly to DB)
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);

  // SMS Tracking State (Synced with DB)
  const [smsUsage, setSmsUsage] = useState<SmsUsage>({ 
      count: 0, 
      lastSentHour: new Date().getHours(), 
      lastSentDate: new Date().toISOString().split('T')[0] 
  });

  // Derived Device Status
  const currentDevice = devices.find(d => d.id === currentDeviceId);
  const currentDeviceStatus = currentDevice ? currentDevice.status : 'PENDING';

  // Refs for background polling
  const settingsRef = useRef(storeSettings);
  const clientsRef = useRef(clients);
  const messagesRef = useRef(messages);

  useEffect(() => {
      settingsRef.current = storeSettings;
      clientsRef.current = clients;
      messagesRef.current = messages;
  }, [storeSettings, clients, messages]);

  // --- BACKGROUND EMAIL POLLER ---
  useEffect(() => {
      const pollInbox = async () => {
          if (!settingsRef.current.emailEnabled || !settingsRef.current.googleRefreshToken) return;
          
          const newEmails = await checkGmailInbox(settingsRef.current);
          if (newEmails.length === 0) return;

          const newMessagesToSave: Message[] = [];

          newEmails.forEach(email => {
              const client = clientsRef.current.find(c => 
                  c.email && c.email.trim().toLowerCase() === email.sender.trim().toLowerCase()
              );

              if (client) {
                  const isDuplicate = messagesRef.current.some(m => 
                      m.client_id === client.id && 
                      m.direction === 'INBOUND' &&
                      m.content === `${email.subject !== '(No Subject)' ? `[Subject: ${email.subject}]\n` : ''}${email.body}`
                  );

                  if (!isDuplicate) {
                      newMessagesToSave.push({
                          id: crypto.randomUUID(),
                          client_id: client.id,
                          direction: 'INBOUND',
                          channel: 'EMAIL',
                          content: `${email.subject !== '(No Subject)' ? `[Subject: ${email.subject}]\n` : ''}${email.body}`,
                          timestamp: email.timestamp,
                          status: 'RECEIVED',
                          read: false
                      });
                  }
              }
          });

          if (newMessagesToSave.length > 0) {
              setMessages(prev => [...prev, ...newMessagesToSave]);
              newMessagesToSave.forEach(m => upsertData('messages', m));
          }
      };

      const interval = setInterval(pollInbox, 60000);
      if (currentUser) pollInbox();

      return () => clearInterval(interval);
  }, [currentUser]);

  // 1. Fetch Initial Data
  useEffect(() => {
    const initData = async () => {
        setIsLoading(true);
        try {
            const [
                fetchedSettings, 
                fetchedUsers, 
                fetchedProducts, 
                fetchedTrx, 
                fetchedApts, 
                fetchedClients, 
                fetchedDiscounts, 
                fetchedLogs,
                fetchedProdCats,
                fetchedServCats,
                fetchedDevices,
                fetchedHistory,
                fetchedMessages,
                fetchedHotelRooms,
                fetchedHotelBookings
            ] = await Promise.all([
                fetchTable('store_settings'),
                fetchTable('users'),
                fetchTable('products'),
                fetchTable('transactions'),
                fetchTable('appointments'),
                fetchTable('clients'),
                fetchTable('discounts'),
                fetchTable('logs'),
                fetchTable('product_categories'),
                fetchTable('service_categories'),
                fetchTable('devices'),
                fetchTable('template_history'),
                fetchTable('messages'),
                fetchTable('hotel_rooms'),
                fetchTable('hotel_bookings')
            ]);

            // SMS Usage Sync
            const now = new Date();
            const hourKey = `${now.toISOString().split('T')[0]}-${now.getHours()}`;
            const { data: smsData } = await supabase.from('sms_tracker').select('*').eq('hour_key', hourKey).single();
            if (smsData) {
                setSmsUsage({
                    count: smsData.count,
                    lastSentHour: now.getHours(),
                    lastSentDate: now.toISOString().split('T')[0] 
                });
            }

            if (fetchedSettings && fetchedSettings.length > 0) {
                const cloudSettings = fetchedSettings.find((s: any) => s.id === 'global_settings') || fetchedSettings[0];
                const mappedCloudSettings = mapSettingsFromDb(cloudSettings);
                setStoreSettings({ ...INITIAL_STORE_SETTINGS, ...mappedCloudSettings });
            } else {
                const payload = mapSettingsPayload(INITIAL_STORE_SETTINGS);
                await upsertData('store_settings', payload);
            }
            
            if (fetchedUsers && fetchedUsers.length > 0) {
               setUsers(fetchedUsers);
               setIsSystemSetup(true);
               const persistedUserId = localStorage.getItem('pawfriends_active_user');
               if (persistedUserId) {
                   const foundUser = fetchedUsers.find((u: any) => u.id === persistedUserId);
                   if (foundUser) setCurrentUser(foundUser);
               }
            } else {
               setUsers([]);
               setIsSystemSetup(false);
            }

            if (fetchedProducts) setProducts(fetchedProducts.map(mapProduct));
            if (fetchedTrx) setTransactions(fetchedTrx.map(mapTransaction));
            if (fetchedApts) setAppointments(fetchedApts.map(mapAppointment));
            if (fetchedClients) setClients(fetchedClients.map(mapClient));
            if (fetchedDiscounts) setDiscounts(fetchedDiscounts.map(mapDiscount));
            if (fetchedLogs) setLogs(fetchedLogs.map(mapLogFromDb));
            if (fetchedDevices) setDevices(fetchedDevices.map(mapDeviceFromDb));
            if (fetchedHistory) setTemplateHistory(fetchedHistory);
            if (fetchedMessages) setMessages(fetchedMessages);
            if (fetchedHotelRooms) setHotelRooms(fetchedHotelRooms.map(mapHotelRoom));
            if (fetchedHotelBookings) setHotelBookings(fetchedHotelBookings.map(mapHotelBooking));
            
            // Categories
            let finalProdCats = fetchedProdCats ? fetchedProdCats.map((c: any) => c.name) : [];
            let finalServCats = fetchedServCats ? fetchedServCats.map((c: any) => c.name) : [];
            setProductCategories(finalProdCats);
            setServiceCategories(finalServCats);

        } catch (error) {
            console.error("Critical Error fetching initial data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    initData();
  }, [currentDeviceId]);

  // 2. Setup Realtime Listeners
  useEffect(() => {
    const handleUpdate = (
        payload: any, 
        setter: React.Dispatch<React.SetStateAction<any[]>>, 
        idField = 'id', 
        mapper?: (item: any) => any
    ) => {
        const { eventType, new: rawNewRecord, old: oldRecord } = payload;
        
        const newRecord = (eventType === 'INSERT' || eventType === 'UPDATE') && mapper 
            ? mapper(rawNewRecord) 
            : rawNewRecord;

        setter(prev => {
            if (eventType === 'INSERT') {
                const exists = prev.find(item => item[idField] === newRecord[idField]);
                if (exists) return prev.map(item => item[idField] === newRecord[idField] ? newRecord : item);
                return [newRecord, ...prev];
            }
            if (eventType === 'UPDATE') {
                 return prev.map(item => item[idField] === newRecord[idField] ? newRecord : item);
            }
            if (eventType === 'DELETE') {
                const deleteId = oldRecord?.[idField] || oldRecord?.id;
                if (!deleteId) return prev;
                return prev.filter(item => item[idField] !== deleteId);
            }
            return prev;
        });
    };

    const subs = [
        subscribeToTable('users', (p) => handleUpdate(p, setUsers)),
        subscribeToTable('products', (p) => handleUpdate(p, setProducts, 'id', mapProduct)), 
        subscribeToTable('transactions', (p) => handleUpdate(p, setTransactions, 'id', mapTransaction)),
        subscribeToTable('appointments', (p) => handleUpdate(p, setAppointments, 'id', mapAppointment)),
        subscribeToTable('clients', (p) => handleUpdate(p, setClients, 'id', mapClient)),
        subscribeToTable('discounts', (p) => handleUpdate(p, setDiscounts, 'id', mapDiscount)),
        subscribeToTable('logs', (p) => handleUpdate(p, setLogs, 'id', mapLogFromDb)),
        subscribeToTable('devices', (p) => handleUpdate(p, setDevices, 'id', mapDeviceFromDb)),
        subscribeToTable('template_history', (p) => handleUpdate(p, setTemplateHistory)),
        subscribeToTable('messages', (p) => handleUpdate(p, setMessages)),
        subscribeToTable('hotel_rooms', (p) => handleUpdate(p, setHotelRooms, 'id', mapHotelRoom)),
        subscribeToTable('hotel_bookings', (p) => handleUpdate(p, setHotelBookings, 'id', mapHotelBooking)),
        
        subscribeToTable('store_settings', (payload) => {
             if (payload.new) {
                 const mapped = mapSettingsFromDb(payload.new);
                 setStoreSettings(prev => ({ ...prev, ...mapped }));
             }
        }),

        subscribeToTable('sms_tracker', (payload) => {
            const now = new Date();
            const hourKey = `${now.toISOString().split('T')[0]}-${now.getHours()}`;
            if (payload.new && payload.new.hour_key === hourKey) {
                setSmsUsage({
                    count: payload.new.count,
                    lastSentHour: now.getHours(),
                    lastSentDate: now.toISOString().split('T')[0]
                });
            }
        }),

        subscribeToTable('product_categories', () => {
            fetchTable('product_categories').then(data => {
                if(data) setProductCategories(data.map((c: any) => c.name));
            });
        }),
        subscribeToTable('service_categories', () => {
            fetchTable('service_categories').then(data => {
                if(data) setServiceCategories(data.map((c: any) => c.name));
            });
        })
    ];

    return () => {
        subs.forEach(sub => supabase.removeChannel(sub));
    };
  }, []);

  // --- ACTIONS WITH MAPPED PAYLOADS ---

  const checkAndIncrementSms = (): boolean => {
      const MAX_PER_HOUR = 30;
      const now = new Date();
      const currentHour = now.getHours();
      const currentDate = now.toISOString().split('T')[0];
      const hourKey = `${currentDate}-${currentHour}`;

      let newCount = smsUsage.count;
      if (smsUsage.lastSentHour !== currentHour || smsUsage.lastSentDate !== currentDate) {
          newCount = 0;
      }

      if (newCount >= MAX_PER_HOUR) return false;

      newCount++;
      setSmsUsage({ count: newCount, lastSentHour: currentHour, lastSentDate: currentDate });

      const updateDb = async () => {
          const { data } = await supabase.from('sms_tracker').select('count').eq('hour_key', hourKey).single();
          let dbCount = data ? data.count : 0;
          dbCount++;
          await supabase.from('sms_tracker').upsert({ hour_key: hourKey, count: dbCount, updated_at: new Date().toISOString() });
      };
      updateDb();
      return true;
  };

  const addLog = (action: string, details: string, referenceId?: string) => {
    const newLog: Log = {
      id: Date.now().toString() + Math.random().toString().slice(2, 5),
      action,
      details,
      timestamp: new Date().toISOString(),
      userId: currentUser?.id || 'system',
      referenceId
    };
    setLogs(prev => [newLog, ...prev]);
    upsertData('logs', mapLogPayload(newLog));
  };

  const registerDevice = useCallback(async () => {
     const networkInfo = await getNetworkInfo();
     const deviceInfo = getDeviceInfo();
     // Auto-approve device if setting is enabled (or not explicitly disabled)
     const defaultStatus = storeSettings.autoApproveUsers !== false ? 'APPROVED' : 'PENDING';

     setDevices(prev => {
         const existing = prev.find(d => d.id === currentDeviceId);
         const device: Device = {
             id: currentDeviceId,
             name: deviceInfo.name,
             custom_name: existing ? existing.custom_name : undefined,
             os: deviceInfo.os,
             browser: deviceInfo.browser,
             device_type: deviceInfo.device_type,
             ip: networkInfo.ip,
             location: networkInfo.location,
             status: existing ? existing.status : defaultStatus,
             lastActive: new Date().toISOString()
         };
         upsertData('devices', mapDevicePayload(device));
         
         if (existing) return prev.map(d => d.id === currentDeviceId ? device : d);
         return [...prev, device];
     });
  }, [currentDeviceId, storeSettings.autoApproveUsers]);

  const updateDeviceStatus = async (deviceId: string, status: 'APPROVED' | 'BLOCKED', customName?: string) => {
      const dev = devices.find(d => d.id === deviceId);
      if (dev) {
          const updated = { ...dev, status, custom_name: customName || dev.custom_name };
          setDevices(prev => prev.map(d => d.id === deviceId ? updated : d));
          upsertData('devices', mapDevicePayload(updated));
          const details = customName ? `${status} device: ${dev.name} as "${customName}"` : `${status} device: ${dev.name}`;
          addLog('SETTINGS', details);
      }
  };

  const deleteDevice = async (deviceId: string) => {
      const prev = [...devices];
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      const { error } = await deleteData('devices', deviceId);
      if (error) setDevices(prev);
      else addLog('SETTINGS', `Deleted device: ${deviceId}`);
  };

  const updateStoreSettings = async (settings: StoreSettings) => {
    const payload = mapSettingsPayload(settings);
    setStoreSettings(prev => ({ ...prev, ...settings }));
    
    let { error } = await upsertData('store_settings', payload);
    
    if (!error) addLog('SETTINGS', 'Updated store settings');
    else alert(`Failed to save settings: ${error.message}`);
  };

  const login = async (inputPin: string): Promise<boolean> => {
    if (!inputPin) return false;
    for (const user of users) {
        let storedPin = user.pin;
        let storedSalt = '';
        let isLegacy = false;

        if (storedPin.includes(':')) {
            [storedSalt, storedPin] = storedPin.split(':');
        } else if (user.salt) {
             storedSalt = user.salt; 
        } else {
             isLegacy = true;
        }

        let isValid = false;
        if (!isLegacy && storedSalt) {
             const attemptHash = await hashPin(inputPin, storedSalt);
             isValid = attemptHash === storedPin;
        } else {
             isValid = storedPin === inputPin;
        }

        if (isValid) {
            // Only block if auto-approve is explicitly disabled AND user is flagged as not approved
            // ADMIN role and super-admin are NEVER blocked
            const autoApproveOff = storeSettings.autoApproveUsers === false;
            if (autoApproveOff && user.is_approved === false && user.role !== Role.ADMIN && user.id !== 'super-admin') {
                return 'PENDING' as any; // Signal pending approval to Login page
            }
            // Upgrade Legacy PINs
            if (isLegacy) {
                const newSalt = generateSalt();
                const newHash = await hashPin(inputPin, newSalt);
                const securePinString = `${newSalt}:${newHash}`;
                const secureUser = { ...user, pin: securePinString };
                delete secureUser.salt;
                setUsers(prev => prev.map(u => u.id === user.id ? secureUser : u));
                await upsertData('users', secureUser);
                setCurrentUser(secureUser);
                localStorage.setItem('pawfriends_active_user', secureUser.id);
            } else {
                setCurrentUser(user);
                localStorage.setItem('pawfriends_active_user', user.id);
            }

            if (currentDevice) {
                const networkInfo = await getNetworkInfo();
                const updatedDevice = { 
                    ...currentDevice, 
                    lastActive: new Date().toISOString(),
                    ip: networkInfo.ip,
                    location: networkInfo.location
                };
                upsertData('devices', mapDevicePayload(updatedDevice));
            }
            return true;
        }
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('pawfriends_active_user');
    setCurrentUser(null);
  };

  const addUser = (user: User) => {
    const isAutoApprove = storeSettings.autoApproveUsers !== false; // default true
    const dbUser = { ...user, is_approved: isAutoApprove ? true : false };
    delete dbUser.salt;
    setUsers(prev => [...prev, dbUser]);
    upsertData('users', dbUser);
    addLog('USER_MGMT', `Created new user: ${user.name} (${isAutoApprove ? 'auto-approved' : 'pending approval'})`);
  };

  const editUser = (updatedUser: User) => {
    const dbUser = { ...updatedUser };
    delete dbUser.salt;
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? dbUser : u));
    upsertData('users', dbUser);
    addLog('USER_MGMT', `Updated user: ${updatedUser.name}`);
  };

  const approveUser = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_approved: true } : u));
    upsertData('users', { id, is_approved: true });
    const user = users.find(u => u.id === id);
    if (user) addLog('USER_MGMT', `Approved user access: ${user.name}`);
  };

  const rejectUser = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_approved: false } : u));
    upsertData('users', { id, is_approved: false });
    const user = users.find(u => u.id === id);
    if (user) addLog('USER_MGMT', `Rejected user access: ${user.name}`);
  };

  const deleteUser = async (id: string) => {
    const prev = [...users];
    const user = users.find(u => u.id === id);
    setUsers(current => current.filter(u => u.id !== id));
    const { error } = await deleteData('users', id);
    if (error) setUsers(prev);
    else if (user) addLog('USER_MGMT', `Deleted user: ${user.name}`);
  };


  const addProduct = (product: Product) => {
    setProducts(prev => [product, ...prev]);
    upsertData('products', mapProductPayload(product));
    addLog('INVENTORY', `Added product: ${product.name}`, product.id);
  };

  const updateProduct = (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    upsertData('products', mapProductPayload(updatedProduct));
  };

  const deleteProduct = async (id: string) => {
    const prev = [...products];
    const item = products.find(p => p.id === id);
    setProducts(current => current.filter(p => p.id !== id));
    const { error } = await deleteData('products', id);
    if (error) setProducts(prev);
    else if (item) addLog('INVENTORY', `Deleted product: ${item.name}`, id);
  };

  const adjustStock = (id: string, amount: number) => {
    const product = products.find(p => p.id === id);
    if (product) {
        const updatedProduct = { ...product, stock: product.stock + amount };
        setProducts(prev => prev.map(p => p.id === id ? updatedProduct : p));
        upsertData('products', mapProductPayload(updatedProduct));
    }
  };

  const addTransaction = (transaction: Transaction) => {
    setTransactions(prev => [transaction, ...prev]);
    upsertData('transactions', mapTransactionPayload(transaction));
    
    transaction.items.forEach(item => {
      if (!item.isService) {
        const product = products.find(p => p.id === item.id);
        if (product) {
            const updatedProduct = { ...product, stock: product.stock - item.quantity };
            setProducts(prev => prev.map(p => p.id === item.id ? updatedProduct : p));
            upsertData('products', mapProductPayload(updatedProduct));
        }
      }
    });
    addLog('POS', `Transaction ${transaction.id.slice(-6)} completed. Total: ${transaction.total}`);
  };

  const deleteTransaction = async (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    for (const item of tx.items) {
      if (!item.isService) {
        const product = products.find(p => p.id === item.id);
        if (product) {
           const updated = { ...product, stock: product.stock + item.quantity };
           upsertData('products', mapProductPayload(updated)); 
           setProducts(prev => prev.map(p => p.id === product.id ? updated : p));
        }
      }
    }

    const { error } = await deleteData('transactions', id);
    if (!error) {
        setTransactions(prev => prev.filter(t => t.id !== id));
        addLog('POS', `Deleted Transaction #${id.slice(-4)}`);
    }
  };

  const updateTransaction = async (oldTx: Transaction, newTx: Transaction) => {
      const adjustments = new Map<string, number>();
      oldTx.items.forEach(item => {
          if (!item.isService) {
              const current = adjustments.get(item.id) || 0;
              adjustments.set(item.id, current + item.quantity);
          }
      });
      newTx.items.forEach(item => {
          if (!item.isService) {
              const current = adjustments.get(item.id) || 0;
              adjustments.set(item.id, current - item.quantity);
          }
      });

      for (const [pid, delta] of adjustments.entries()) {
          if (delta !== 0) {
              const product = products.find(p => p.id === pid);
              if (product) {
                  const updated = { ...product, stock: product.stock + delta };
                  upsertData('products', mapProductPayload(updated));
                  setProducts(prev => prev.map(p => p.id === pid ? updated : p));
              }
          }
      }

      const { error } = await upsertData('transactions', mapTransactionPayload(newTx));
      if (!error) {
          setTransactions(prev => prev.map(t => t.id === newTx.id ? newTx : t));
          addLog('POS', `Updated Transaction #${newTx.id.slice(-4)}`);
      }
  };

  const addClient = (client: Client) => {
    setClients(prev => [client, ...prev]);
    upsertData('clients', mapClientPayload(client));
    addLog('CLIENTS', `Added new client: ${client.name}`);
  };

  const updateClient = (client: Client) => {
    setClients(prev => prev.map(c => c.id === client.id ? client : c));
    upsertData('clients', mapClientPayload(client));
  };

  const deleteClient = async (id: string) => {
    const prev = [...clients];
    const client = clients.find(c => c.id === id);
    setClients(current => current.filter(c => c.id !== id));
    const { error } = await deleteData('clients', id);
    if (error) setClients(prev);
    else if (client) addLog('CLIENTS', `Deleted client: ${client.name}`);
  };

  const addAppointment = (apt: GroomingAppointment) => {
    setAppointments(prev => [apt, ...prev]);
    upsertData('appointments', mapAppointmentPayload(apt));
    addLog('GROOMING', `Booked appointment for ${apt.petName}`);

    const existingClient = clients.find(c => c.name.toLowerCase() === apt.ownerName.toLowerCase());
    const petDetails: Pet = {
        id: Date.now().toString(),
        name: apt.petName,
        breed: apt.petBreed,
        color: apt.petColor,
        weightSize: apt.weightSize
    };

    if (!existingClient) {
        const newClient: Client = {
            id: Date.now().toString(),
            name: apt.ownerName,
            contactNumber: apt.contactNumber || '',
            email: apt.email || '',
            address: '',
            notes: `Auto-created from Grooming.`,
            firstSeen: new Date().toISOString(),
            pets: [petDetails]
        };
        addClient(newClient);
    } else {
        const currentPets = existingClient.pets || [];
        const existingPetIndex = currentPets.findIndex(p => p.name.toLowerCase() === apt.petName.toLowerCase());
        let updatedPets = [...currentPets];
        if (existingPetIndex >= 0) {
            updatedPets[existingPetIndex] = {
                ...updatedPets[existingPetIndex],
                breed: apt.petBreed || updatedPets[existingPetIndex].breed,
                color: apt.petColor || updatedPets[existingPetIndex].color,
                weightSize: apt.weightSize || updatedPets[existingPetIndex].weightSize
            };
        } else {
            updatedPets.push(petDetails);
        }
        const updatedClient = { ...existingClient, pets: updatedPets };
        updateClient(updatedClient);
    }
  };

  const updateAppointment = (apt: GroomingAppointment) => {
    setAppointments(prev => prev.map(a => a.id === apt.id ? apt : a));
    upsertData('appointments', mapAppointmentPayload(apt));
    addLog('GROOMING', `Updated appointment details for ${apt.petName}`);
  };

  const deleteAppointment = async (id: string) => {
    const prev = [...appointments];
    const apt = appointments.find(a => a.id === id);
    setAppointments(current => current.filter(a => a.id !== id));
    const { error } = await deleteData('appointments', id);
    if (error) setAppointments(prev);
    else if (apt) addLog('GROOMING', `Cancelled appointment for ${apt.petName}`);
  };

  const updateAppointmentStatus = (id: string, status: any) => {
    const apt = appointments.find(a => a.id === id);
    if (apt) {
        const updatedApt = { ...apt, status };
        setAppointments(prev => prev.map(a => a.id === id ? updatedApt : a));
        upsertData('appointments', mapAppointmentPayload(updatedApt));
        addLog('GROOMING', `Updated appointment status to ${status}`);
    }
  };

  const addDiscount = (discount: Discount) => {
    setDiscounts(prev => [...prev, discount]);
    upsertData('discounts', mapDiscountPayload(discount));
    addLog('PROMO', `Added discount: ${discount.name}`);
  };

  const toggleDiscount = (id: string) => {
    const discount = discounts.find(d => d.id === id);
    if (discount) {
        const updated = { ...discount, active: !discount.active };
        setDiscounts(prev => prev.map(d => d.id === id ? updated : d));
        upsertData('discounts', mapDiscountPayload(updated));
    }
  };

  const deleteDiscount = async (id: string) => {
    const prev = [...discounts];
    setDiscounts(current => current.filter(d => d.id !== id));
    const { error } = await deleteData('discounts', id);
    if (error) setDiscounts(prev);
    else addLog('PROMO', `Deleted discount: ${id}`);
  };

  const addProductCategory = (category: string) => {
    if (!productCategories.includes(category)) {
      setProductCategories(prev => [...prev, category]);
      upsertData('product_categories', { name: category });
      addLog('SETTINGS', `Added product category: ${category}`);
    }
  };

  const editProductCategory = (oldName: string, newName: string) => {
     setProductCategories(prev => prev.map(c => c === oldName ? newName : c));
     supabase.from('product_categories').update({ name: newName }).eq('name', oldName).then(({ error }) => {
         if (!error) {
             const productsToUpdate = products.filter(p => p.category === oldName);
             productsToUpdate.forEach(p => upsertData('products', mapProductPayload({ ...p, category: newName })));
         }
     });
     addLog('SETTINGS', `Renamed product category ${oldName} to ${newName}`);
  };

  const deleteProductCategory = async (category: string) => {
     const prev = [...productCategories];
     setProductCategories(current => current.filter(c => c !== category));
     const { error } = await supabase.from('product_categories').delete().eq('name', category);
     if (error) setProductCategories(prev);
     else addLog('SETTINGS', `Deleted product category: ${category}`);
  };

  const addServiceCategory = (category: string) => {
    if (!serviceCategories.includes(category)) {
      setServiceCategories(prev => [...prev, category]);
      upsertData('service_categories', { name: category });
      addLog('SETTINGS', `Added service category: ${category}`);
    }
  };

  const editServiceCategory = (oldName: string, newName: string) => {
     setServiceCategories(prev => prev.map(c => c === oldName ? newName : c));
     supabase.from('service_categories').update({ name: newName }).eq('name', oldName).then(({ error }) => {
         if (!error) {
             const productsToUpdate = products.filter(p => p.category === oldName);
             productsToUpdate.forEach(p => upsertData('products', mapProductPayload({ ...p, category: newName })));
         }
     });
     addLog('SETTINGS', `Renamed service category ${oldName} to ${newName}`);
  };

  const deleteServiceCategory = async (category: string) => {
    const prev = [...serviceCategories];
    setServiceCategories(current => current.filter(c => c !== category));
    const { error } = await supabase.from('service_categories').delete().eq('name', category);
    if (error) setServiceCategories(prev);
    else addLog('SETTINGS', `Deleted service category: ${category}`);
  };

  const saveTemplateHistory = (
      category: 'GROOMING' | 'PROMO', 
      channel: 'SMS' | 'EMAIL_SUBJECT' | 'EMAIL_BODY' | 'EMAIL_FOOTER', 
      content: string
  ) => {
      if (!content.trim()) return;
      const existing = templateHistory
          .filter(h => h.category === category && h.channel === channel)
          .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      
      if (existing && existing.content === content) return;

      const newHistory: TemplateHistory = {
          id: crypto.randomUUID(),
          category,
          channel,
          content,
          created_at: new Date().toISOString()
      };
      setTemplateHistory(prev => [newHistory, ...prev]);
      upsertData('template_history', newHistory);
  };

  const deleteTemplateHistory = async (id: string) => {
      setTemplateHistory(prev => prev.filter(h => h.id !== id));
      await deleteData('template_history', id);
  };

  const sendChatMessage = async (clientId: string, content: string, channel: 'SMS' | 'EMAIL', direction: 'INBOUND' | 'OUTBOUND' = 'OUTBOUND'): Promise<boolean> => {
      const client = clients.find(c => c.id === clientId);
      if (!client) return false;

      let success = false;
      if (direction === 'OUTBOUND') {
          if (channel === 'SMS' && client.contactNumber) {
              if (checkAndIncrementSms()) {
                  const res = await sendSMS(storeSettings, [client.contactNumber], content);
                  success = res.success;
              }
          } else if (channel === 'EMAIL' && client.email) {
              const res = await sendEmail(storeSettings, client.email, "Message from GigglyPaws", content, "Message");
              success = res.success;
          }
      } else {
          success = true;
      }

      if (success) {
          const newMessage: Message = {
              id: crypto.randomUUID(),
              client_id: clientId,
              direction: direction,
              channel: channel,
              content: content,
              timestamp: new Date().toISOString(),
              status: direction === 'OUTBOUND' ? 'SENT' : 'RECEIVED',
              read: direction === 'OUTBOUND' ? true : false
          };
          setMessages(prev => [...prev, newMessage]);
          upsertData('messages', newMessage);
      }
      return success;
  };

  const markMessagesAsRead = async (clientId: string, channel: 'SMS' | 'EMAIL') => {
      setMessages(prev => prev.map(m => 
          (m.client_id === clientId && m.channel === channel && m.direction === 'INBOUND' && !m.read)
          ? { ...m, read: true }
          : m
      ));
      await supabase.from('messages')
          .update({ read: true })
          .eq('client_id', clientId)
          .eq('channel', channel)
          .eq('direction', 'INBOUND')
          .eq('read', false);
  };

  // --- HOTEL CRUD ---

  const addHotelRoom = async (room: HotelRoom) => {
    setHotelRooms(prev => [room, ...prev]);
    await upsertData('hotel_rooms', room);
    addLog('HOTEL_ROOM_ADDED', `Room "${room.room_name}" (${room.room_number}) added.`, room.id);
  };

  const updateHotelRoom = async (room: HotelRoom) => {
    setHotelRooms(prev => prev.map(r => r.id === room.id ? room : r));
    await upsertData('hotel_rooms', room);
    addLog('HOTEL_ROOM_UPDATED', `Room "${room.room_name}" (${room.room_number}) updated.`, room.id);
  };

  const deleteHotelRoom = async (id: string) => {
    const room = hotelRooms.find(r => r.id === id);
    setHotelRooms(prev => prev.filter(r => r.id !== id));
    await deleteData('hotel_rooms', id);
    addLog('HOTEL_ROOM_DELETED', `Room "${room?.room_name || id}" deleted.`, id);
  };

  const addHotelBooking = async (booking: HotelBooking) => {
    setHotelBookings(prev => [booking, ...prev]);
    await upsertData('hotel_bookings', booking);
    addLog('HOTEL_BOOKED', `${booking.pet_name} booked Room ${booking.room_id} (${booking.check_in} – ${booking.check_out}).`, booking.id);
    // Send booking confirmation notification
    if (booking.contact_number || booking.email) {
      const room = hotelRooms.find(r => r.id === booking.room_id);
      const vars = { petName: booking.pet_name, ownerName: booking.owner_name, shopName: storeSettings.name, roomNumber: room?.room_number || booking.room_id, checkIn: booking.check_in, checkOut: booking.check_out, totalAmount: booking.total_amount.toString() };
      const replace = (t: string = '') => Object.entries(vars).reduce((s, [k, v]) => s.replace(new RegExp(`{${k}}`, 'g'), v), t);
      if (storeSettings.smsEnabled && booking.contact_number) { checkAndIncrementSms() && sendSMS(storeSettings, [booking.contact_number], replace(storeSettings.smsTemplateHotelBooked)); }
      if (storeSettings.emailEnabled && booking.email) { sendEmail(storeSettings, booking.email, replace(storeSettings.emailSubjectHotelBooked), replace(storeSettings.emailBodyHotelBooked), 'Booking Confirmed'); }
    }
  };

  const updateHotelBooking = async (booking: HotelBooking) => {
    setHotelBookings(prev => prev.map(b => b.id === booking.id ? booking : b));
    await upsertData('hotel_bookings', booking);
  };

  const deleteHotelBooking = async (id: string) => {
    const booking = hotelBookings.find(b => b.id === id);
    setHotelBookings(prev => prev.filter(b => b.id !== id));
    await deleteData('hotel_bookings', id);
    addLog('HOTEL_BOOKING_DELETED', `Booking for ${booking?.pet_name || id} deleted.`, id);
  };

  const checkInGuest = async (bookingId: string) => {
    const booking = hotelBookings.find(b => b.id === bookingId);
    if (!booking) return;
    const updated = { ...booking, status: 'CHECKED_IN' as HotelBookingStatus, actual_check_in: new Date().toISOString() };
    setHotelBookings(prev => prev.map(b => b.id === bookingId ? updated : b));
    await upsertData('hotel_bookings', updated);
    addLog('HOTEL_CHECKIN', `${booking.pet_name} checked in to Room ${booking.room_id}.`, bookingId);
    // Send check-in notification
    const room = hotelRooms.find(r => r.id === booking.room_id);
    const vars = { petName: booking.pet_name, ownerName: booking.owner_name, shopName: storeSettings.name, roomNumber: room?.room_number || booking.room_id, checkIn: booking.check_in, checkOut: booking.check_out, totalAmount: booking.total_amount.toString() };
    const replace = (t: string = '') => Object.entries(vars).reduce((s, [k, v]) => s.replace(new RegExp(`{${k}}`, 'g'), v), t);
    if (storeSettings.smsEnabled && booking.contact_number) { checkAndIncrementSms() && sendSMS(storeSettings, [booking.contact_number], replace(storeSettings.smsTemplateHotelCheckin)); }
    if (storeSettings.emailEnabled && booking.email) { sendEmail(storeSettings, booking.email, replace(storeSettings.emailSubjectHotelCheckin), replace(storeSettings.emailBodyHotelCheckin), 'Checked In'); }
  };

  const checkOutGuest = async (bookingId: string, paymentMethod: 'CASH' | 'GCASH' | 'SPLIT', cashReceived?: number, gcashRef?: string, recalcTotal?: number) => {
    const booking = hotelBookings.find(b => b.id === bookingId);
    if (!booking) return;
    // Build addon items for receipt
    const addonProducts = (booking.addon_ids || []).map(addonId => products.find(p => p.id === addonId)).filter(Boolean) as any[];
    const room = hotelRooms.find(r => r.id === booking.room_id);
    // Create a Transaction (receipt)
    const txId = 'HTL-' + Date.now().toString();
    // FIX: Use recalcTotal from checkout modal (daily_rate × nights) if provided
    // Fall back to recalculating here if called without UI (e.g. programmatically)
    const stayAmount = recalcTotal !== undefined
      ? recalcTotal - addonProducts.reduce((s, p: any) => s + p.price, 0)
      : (booking.daily_rate * booking.total_nights);
    const nightlyItem = { id: 'hotel-stay-' + bookingId, name: `Hotel Stay – ${room?.room_name || 'Room'} (${booking.total_nights} night${booking.total_nights !== 1 ? 's' : ''} × ₱${booking.daily_rate.toLocaleString()})`, price: stayAmount, cost: 0, stock: 1, category: 'HOTEL', isService: true, quantity: 1, appliedDiscounts: [] };
    const addonItems = addonProducts.map((p: any) => ({ ...p, quantity: 1, appliedDiscounts: [] }));
    const allItems = [nightlyItem, ...addonItems];
    const subtotal = allItems.reduce((s, i) => s + i.price * i.quantity, 0);
    // VAT is only applied to hotel stays if explicitly enabled in Settings > Hotel VAT
    const vatRate = storeSettings.hotelVatEnabled ? (storeSettings.vatRate || 0) : 0;
    const vat = parseFloat((subtotal * vatRate / 100).toFixed(2));
    const total = parseFloat((subtotal + vat).toFixed(2));
    const tx: Transaction = { id: txId, items: allItems, subtotal, vat, total, discount: 0, paymentMethod, gcashRef: gcashRef || '', cashReceived: cashReceived || total, date: new Date().toISOString(), cashierId: currentUser?.id || 'system' };
    setTransactions(prev => [tx, ...prev]);
    await upsertData('transactions', mapTransactionPayload(tx));
    // Update booking
    const updated = { ...booking, status: 'CHECKED_OUT' as HotelBookingStatus, actual_check_out: new Date().toISOString(), transaction_id: txId };
    setHotelBookings(prev => prev.map(b => b.id === bookingId ? updated : b));
    await upsertData('hotel_bookings', updated);
    addLog('HOTEL_CHECKOUT', `${booking.pet_name} checked out from Room ${booking.room_id}. Total: ₱${total}.`, bookingId);
    // Send checkout notification
    const vars = { petName: booking.pet_name, ownerName: booking.owner_name, shopName: storeSettings.name, roomNumber: room?.room_number || booking.room_id, checkIn: booking.check_in, checkOut: booking.check_out, totalAmount: total.toString() };
    const replace = (t: string = '') => Object.entries(vars).reduce((s, [k, v]) => s.replace(new RegExp(`{${k}}`, 'g'), v), t);
    if (storeSettings.smsEnabled && booking.contact_number) { checkAndIncrementSms() && sendSMS(storeSettings, [booking.contact_number], replace(storeSettings.smsTemplateHotelCheckout)); }
    if (storeSettings.emailEnabled && booking.email) { sendEmail(storeSettings, booking.email, replace(storeSettings.emailSubjectHotelCheckout), replace(storeSettings.emailBodyHotelCheckout), 'Checked Out'); }
  };

  return (
    <StoreContext.Provider value={{
      isLoading, isSystemSetup,
      currentUser, users, products, transactions, appointments, clients, discounts, logs, 
      devices, currentDeviceId, currentDeviceStatus,
      storeSettings, updateStoreSettings,
      productCategories, serviceCategories,
      smsUsage, checkAndIncrementSms,
      login, logout, addUser, editUser, deleteUser, approveUser, rejectUser,
      registerDevice, updateDeviceStatus, deleteDevice,
      addProduct, updateProduct, deleteProduct,
      adjustStock, 
      addTransaction, deleteTransaction, updateTransaction,
      addAppointment, updateAppointment, deleteAppointment, updateAppointmentStatus, 
      addLog, addClient, updateClient, deleteClient,
      addDiscount, toggleDiscount, deleteDiscount,
      addProductCategory, editProductCategory, deleteProductCategory, 
      addServiceCategory, editServiceCategory, deleteServiceCategory,
      templateHistory, saveTemplateHistory, deleteTemplateHistory,
      messages, sendChatMessage, markMessagesAsRead,
      hotelRooms, hotelBookings,
      addHotelRoom, updateHotelRoom, deleteHotelRoom,
      addHotelBooking, updateHotelBooking, deleteHotelBooking,
      checkInGuest, checkOutGuest
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
};
