export interface RateTier {
  maxHours: number;
  label: string;
  nonMember: number; // in whole PHP pesos
  member: number;    // in whole PHP pesos
}

export interface PlanRate {
  type: 'weekly' | 'semi_month' | 'monthly';
  label: string;
  days: number;
  nonMember: number;
  member: number;
}

export interface Product {
  id: number;
  name: string;
  category: 'iced_coffee' | 'non_coffee' | 'lunch_dinner' | 'other';
  price: number;
  active: number;
}

export interface Customer {
  id: number;
  name: string;
  memberCardNo: string | null;
  isMember: number; // 1 or 0
  phone: string | null;
  createdAt: string;
}

export interface PlanSub {
  id: number;
  customerId: number;
  customerName: string;
  planType: 'weekly' | 'semi_month' | 'monthly';
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  price: number;
  isMember: number;
  active: number;
}

export interface VisitFoodItem {
  id: number;
  visitId: number;
  productId: number;
  itemName: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

export interface Visit {
  id: number;
  customerId: number | null;
  customerName: string;
  memberCardNo: string | null;
  isMember: number;
  planSubId: number | null;
  timeIn: string;  // ISO string
  timeOut: string | null;
  status: 'active' | 'checked_out' | 'cancelled';
  notes: string | null;
  foodItems: VisitFoodItem[];
}

export interface PaymentInput {
  method: 'cash' | 'card' | 'qrph';
  amount: number;
  tendered?: number;
  refNo?: string;
}

export interface SaleLine {
  id?: number;
  saleId?: number;
  type: 'time' | 'plan' | 'membership' | 'food';
  item: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

export interface SaleRecord {
  id: number;
  receiptNo: string;
  createdAt: string;
  staffName: string;
  customerName: string;
  isMember: number;
  minutesStayed: number;
  subtotal: number;
  discount: number;
  total: number;
  status: 'paid' | 'void';
  lines: SaleLine[];
  payments: PaymentInput[];
}

export interface ExpenseRecord {
  id: number;
  createdAt: string;
  category: string;
  amount: number;
  method: 'cash' | 'card' | 'qrph' | 'bank';
  note: string;
  staffName: string;
}

export interface ShiftRecord {
  id: number;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  closedBy: string | null;
  openingCash: number;
  countedCash: number | null;
  expectedCash: number | null;
  notes: string | null;
}

export interface AppSettings {
  shopName: string;
  branchName: string;
  address: string;
  openHour: number;
  closeHour: number;
  membershipCardPrice: number;
  qrPhImageUrl: string;
  backupFolder: string;
  tiers: RateTier[];
  plans: PlanRate[];
}
