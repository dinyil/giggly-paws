
export enum Role {
  ADMIN = 'ADMIN',
  CASHIER = 'CASHIER',
  GROOMER = 'GROOMER',
}

export interface User {
  id: string;
  name: string;
  pin: string; // Stores "SALT:HASH" string
  salt?: string; // Optional: Transient property, not stored in DB
  role: Role | string;
}

export interface SmsUsage {
  count: number;
  lastSentHour: number; // 0-23
  lastSentDate: string; // YYYY-MM-DD
}

export interface Device {
  id: string; // UUID stored in LocalStorage
  name: string; // Combined friendly name (e.g. Windows - Chrome)
  custom_name?: string; // Admin assigned name (e.g. "Kitchen Display")
  os: string;
  browser: string;
  device_type?: string; // 'Mobile' | 'Tablet' | 'Desktop'
  status: 'PENDING' | 'APPROVED' | 'BLOCKED';
  lastActive: string;
  ip?: string;
  location?: string;
}

export type Category = string;

export interface Product {
  id: string;
  name: string;
  price: number; // Selling Price (SRP)
  cost: number;  // Original Cost (Puhunan) / RSP
  category: Category;
  stock: number;
  isService: boolean; // True for Grooming
}

export interface Discount {
  id: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  active: boolean;
  
  // Advanced Rules
  triggerType: DiscountTrigger;
  triggerValue?: string; 
  
  // Duration
  isPermanent: boolean;
  startDate?: string;
  endDate?: string;
}

export interface CartItem extends Product {
  quantity: number;
  appliedDiscounts: Discount[]; // Updated: Array to support stacking
}

export interface Transaction {
  id: string;
  items: CartItem[];
  subtotal: number;
  vat: number;
  total: number;
  discount: number;
  paymentMethod: 'CASH' | 'GCASH' | 'SPLIT';
  gcashRef?: string;
  cashReceived?: number; // Stores the Cash portion if SPLIT
  date: string;
  cashierId: string;
}

export interface GroomingAppointment {
  id: string;
  petName: string;
  petBreed?: string;
  petColor?: string;
  weightSize?: string;
  
  ownerName: string;
  contactNumber?: string;
  email?: string; // Added Email for Appointment
  
  serviceId: string;
  hairCut?: string; // Instructions
  addonIds?: string[]; // IDs of additional products/services added at booking
  
  date: string;
  time: string;
  status: 'SCHEDULED' | 'ONGOING' | 'COMPLETED';
  groomerId: string; // Stores the Groomer's Name for display
}

export interface Pet {
  id: string;
  name: string;
  species?: 'DOG' | 'CAT' | 'OTHER'; // Dog, Cat, or Other
  speciesLabel?: string;               // Custom label when species = 'OTHER' (e.g. "Rabbit", "Bird")
  breed?: string;
  color?: string;
  weightSize?: string;
  notes?: string;
}

export interface Client {
  id: string;
  name: string;
  contactNumber: string;
  email?: string; // Added Email
  address?: string;
  notes?: string;
  firstSeen?: string; // ISO Date
  
  pets: Pet[]; // Array of pets owned by this client
  
  // Legacy fields (optional, for backward compatibility during migration)
  petName?: string;
  petBreed?: string;
}

export type DiscountTrigger = 'MANUAL' | 'MIN_SPEND' | 'ITEM_COUNT' | 'SPECIFIC_PRODUCT';

export interface Log {
  id: string;
  action: string;
  details: string;
  timestamp: string;
  userId: string;
  referenceId?: string; // Links log to a specific entity ID (e.g. Product ID)
}

export interface TemplateHistory {
  id: string;
  category: 'GROOMING' | 'PROMO';
  channel: 'SMS' | 'EMAIL_SUBJECT' | 'EMAIL_BODY' | 'EMAIL_FOOTER';
  content: string;
  created_at: string;
}

export interface Message {
  id: string;
  client_id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  channel: 'SMS' | 'EMAIL';
  content: string;
  timestamp: string;
  status: 'SENT' | 'FAILED' | 'RECEIVED';
  read?: boolean; // Added read status
}

export interface StoreSettings {
  name: string;
  address: string;
  contactNumber: string;
  vatRate: number; // Percentage, e.g., 12
  hotelVatEnabled: boolean; // Whether to apply VAT to hotel stays
  gcashNumber: string;
  gcashQr?: string; // Base64 string for QR Code image
  receiptHeader: string;
  receiptFooter: string;
  logo: string; // Base64 string
  
  // Cloud Database Config
  supabaseUrl?: string;
  supabaseKey?: string;

  // Notifications
  smsEnabled: boolean;
  textBeeApiKey?: string;
  textBeeDeviceId?: string;
  
  emailEnabled: boolean;
  
  // Google Gmail Direct Configuration
  googleClientId?: string;
  googleClientSecret?: string;
  googleRefreshToken?: string;
  emailSenderName?: string;
  emailFooterText?: string; // New customizable footer

  // Templates
  // Upcoming / Scheduled
  smsTemplateUpcoming?: string;
  emailSubjectUpcoming?: string;
  emailBodyUpcoming?: string;

  // Waiting (Checked In)
  smsTemplateWaiting?: string;
  emailSubjectWaiting?: string;
  emailBodyWaiting?: string;

  // Ongoing (Started)
  smsTemplateOngoing?: string;
  emailSubjectOngoing?: string;
  emailBodyOngoing?: string;

  // Completed (Ready for Pickup)
  smsTemplateCompleted?: string;
  emailSubjectCompleted?: string;
  emailBodyCompleted?: string;

  // Promo / Discount Broadcasts
  smsTemplatePromo?: string;
  emailSubjectPromo?: string;
  emailBodyPromo?: string;

  // Hotel / Boarding Notifications
  smsTemplateHotelBooked?: string;
  emailSubjectHotelBooked?: string;
  emailBodyHotelBooked?: string;

  smsTemplateHotelCheckin?: string;
  emailSubjectHotelCheckin?: string;
  emailBodyHotelCheckin?: string;

  smsTemplateHotelReminder?: string;
  emailSubjectHotelReminder?: string;
  emailBodyHotelReminder?: string;

  smsTemplateHotelCheckout?: string;
  emailSubjectHotelCheckout?: string;
  emailBodyHotelCheckout?: string;
}

// --- HOTEL MODULE TYPES ---

export type HotelBookingStatus = 'RESERVED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';

export interface HotelRoom {
  id: string;
  room_number: string;    // e.g. "A1", "101"
  room_name: string;      // e.g. "Sunny Suite"
  room_type: string;      // Admin-defined e.g. "Standard", "Deluxe"
  daily_rate: number;
  capacity: number;       // Max pets
  description?: string;
  is_active: boolean;
}

export interface HotelBooking {
  id: string;
  room_id: string;
  client_id?: string;
  pet_id?: string;
  pet_name: string;
  owner_name: string;
  contact_number?: string;
  email?: string;
  check_in: string;           // YYYY-MM-DD
  check_out: string;          // YYYY-MM-DD
  actual_check_in?: string;   // ISO timestamp
  actual_check_out?: string;  // ISO timestamp
  status: HotelBookingStatus;
  daily_rate: number;
  total_nights: number;
  total_amount: number;
  addon_ids: string[];        // Product/Service IDs
  notes?: string;
  staff_id?: string;
  transaction_id?: string;    // Set after checkout receipt
}
