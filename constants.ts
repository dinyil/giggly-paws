
import { Product, User, Role, Discount, StoreSettings, Transaction, GroomingAppointment, Log, CartItem } from './types';

// Initial Users (Fallback if DB is empty)
// Admin PIN '1234' is now HASHED securely.
// Format: "SALT:HASH"
// Salt: 'admin-salt-2024'
// Hash: SHA256('1234' + 'admin-salt-2024')
export const INITIAL_USERS: User[] = [
  {
    id: 'super-admin',
    name: 'Admin',
    // Combined format: salt:hash
    pin: 'admin-salt-2024:904e57929497534475459371060932c0202979774620572da93630f9a239b03c',
    role: Role.ADMIN
  },
];

// Default Categories - SPLIT
export const INITIAL_PRODUCT_CATEGORIES: string[] = ['FOOD', 'TOYS', 'ACCESSORIES', 'CARE'];
export const INITIAL_SERVICE_CATEGORIES: string[] = ['GROOMING', 'SPA', 'CONSULTATION'];

// Defined Credentials
export const SUPABASE_URL = 'https://gsrnetpmsnvxykrleicr.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Iw_O7mQxUvWEI-fgSqR4ZA_PeNnDwQK';

export const INITIAL_STORE_SETTINGS: StoreSettings = {
  name: 'GigglyPaws Pet Shop',
  address: '123 Dogwood Lane, Manila',
  contactNumber: '0917-000-0000',
  vatRate: 12,
  hotelVatEnabled: false,
  autoApproveUsers: true,
  gcashNumber: '0917-123-4567',
  gcashQr: '',
  receiptHeader: 'Thank you for choosing GigglyPaws!',
  receiptFooter: 'No return, no exchange after 7 days.',
  logo: '',
  receiptPaperSize: '80mm',
  supabaseUrl: SUPABASE_URL,
  supabaseKey: SUPABASE_KEY,

  smsEnabled: false,

  emailEnabled: false,
  googleClientId: '',
  googleClientSecret: '',
  googleRefreshToken: '',
  emailSenderName: 'GigglyPaws',
  emailFooterText: 'Thank you for trusting us with your furry friend!',

  // Default Templates
  smsTemplateUpcoming: "Hi {ownerName}! This is a reminder for {petName}'s appointment at {shopName} on {date} at {time}. See you!",
  emailSubjectUpcoming: "Upcoming Appointment Reminder - {shopName}",
  emailBodyUpcoming: "We are excited to see {petName} soon! This is a reminder for your appointment on <b>{date}</b> at <b>{time}</b>.",

  smsTemplateWaiting: "Hi {ownerName}, {petName} is now checked in and waiting for their turn. We'll start shortly!",
  emailSubjectWaiting: "{petName} is checked in!",
  emailBodyWaiting: "{petName} has been successfully checked in. We will take great care of them!",

  smsTemplateOngoing: "Update: {petName}'s grooming session has started! We're making them look fabulous.",
  emailSubjectOngoing: "Grooming Started for {petName}",
  emailBodyOngoing: "Our groomers have started working their magic on {petName}. We will notify you once they are ready for pickup.",

  smsTemplateCompleted: "Good news {ownerName}! {petName} is ready for pickup! Total due: ₱{price}. See you soon!",
  emailSubjectCompleted: "{petName} is Ready for Pickup!",
  emailBodyCompleted: "Good news! <b>{petName}</b> is looking fresh, clean, and amazing. They are ready to be picked up at your convenience.",

  // Promo Templates
  smsTemplatePromo: "{shopName} PROMO: {promoName}! Get {discountValue}. {rules} Valid until {endDate}. Visit us at {shopName}!",
  emailSubjectPromo: "Special Promo: {promoName} 🎉",
  emailBodyPromo: "Hello Fur Parent!\n\nWe have a special treat for you: {promoName}\n\nGet {discountValue}\n{rules}\n\nValid until: {endDate}\n\nVisit us at {shopName}, {address}",

  // Hotel / Boarding Templates
  smsTemplateHotelBooked: "Hi {ownerName}! {petName}'s stay at {shopName} is confirmed. Room: {roomNumber} | Check-in: {checkIn} | Check-out: {checkOut}. See you!",
  emailSubjectHotelBooked: "Booking Confirmed – {petName}'s Stay at {shopName}",
  emailBodyHotelBooked: "Hi {ownerName}!<br><br>We're excited to welcome <b>{petName}</b>!<br><br><b>Room:</b> {roomNumber}<br><b>Check-in:</b> {checkIn}<br><b>Check-out:</b> {checkOut}<br><b>Total:</b> ₱{totalAmount}<br><br>See you soon!",

  smsTemplateHotelCheckin: "Hi {ownerName}! {petName} is now checked in at {shopName}, Room {roomNumber}. We'll take great care of them! 🐾",
  emailSubjectHotelCheckin: "{petName} Has Checked In!",
  emailBodyHotelCheckin: "Great news, {ownerName}!<br><br><b>{petName}</b> has been successfully checked into Room {roomNumber} at {shopName}. We will take great care of them until {checkOut}.",

  smsTemplateHotelReminder: "Hi {ownerName}! Reminder: {petName}'s check-out at {shopName} is tomorrow, {checkOut}. See you then!",
  emailSubjectHotelReminder: "Check-Out Reminder for {petName} Tomorrow",
  emailBodyHotelReminder: "Hi {ownerName}!<br><br>Just a friendly reminder that <b>{petName}</b> is scheduled to check out from {shopName} tomorrow, <b>{checkOut}</b>. We look forward to seeing you!",

  smsTemplateHotelCheckout: "Hi {ownerName}! {petName} is ready for pick-up at {shopName}. Total: ₱{totalAmount}. Thank you for choosing us! 🐾",
  emailSubjectHotelCheckout: "{petName} is Ready for Pick-Up!",
  emailBodyHotelCheckout: "Hi {ownerName}!<br><br><b>{petName}</b> had a wonderful stay and is now ready to go home! 🐾<br><br><b>Room:</b> {roomNumber}<br><b>Stay:</b> {checkIn} – {checkOut}<br><b>Total Amount:</b> ₱{totalAmount}<br><br>Thank you for trusting us with your fur baby!",
};

// --- EMPTY INITIAL STATES (Data now comes from Cloud) ---
export const INITIAL_PRODUCTS: Product[] = [];
export const INITIAL_DISCOUNTS: Discount[] = [];
export const INITIAL_TRANSACTIONS: Transaction[] = [];
export const INITIAL_APPOINTMENTS: GroomingAppointment[] = [];
export const INITIAL_LOGS: Log[] = [];