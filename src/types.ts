export type Shop = {
  id: string;
  name: string;
  slug: string;
  status: string;
  logo_url: string | null;
  primary_color: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency: string;
};

export type User = {
  id: string;
  email: string;
  role: "SUPER_ADMIN" | "TENANT_ADMIN";
  tenant_id: string | null;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type OrderFile = {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  page_count: number | null;
  status: string;
  error_message: string | null;
};

export type PrintSegment = {
  id: string;
  file_id: string;
  page_start: number;
  page_end: number;
  paper_size: string;
  color_mode: string;
  sides: string;
  orientation: string;
  copies: number;
  paper_type: string;
  notes: string | null;
};

export type OrderItem = {
  id: string;
  item_type: string;
  description: string;
  quantity: string;
  unit_price: string;
  total: string;
};

export type OrderEvent = {
  id: string;
  event_type: string;
  actor_type: string;
  actor_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Payment = {
  id: string;
  provider: string;
  amount: string;
  currency: string;
  status: string;
};

export type Order = {
  id: string;
  tenant_id: string;
  order_number: string;
  pickup_code: string | null;
  status: string;
  currency: string;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  service_fee: string;
  grand_total: string;
  pricing_version: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  files: OrderFile[];
  segments: PrintSegment[];
  items: OrderItem[];
  payments: Payment[];
  events: OrderEvent[];
  access_token?: string;
};

export type PriceQuote = {
  currency: string;
  pricing_version: number;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  service_fee: string;
  grand_total: string;
  line_items: Array<{
    description: string;
    quantity: string;
    unit_price: string;
    total: string;
  }>;
};

export type PricingRule = {
  id?: string;
  code: string;
  paper_size: string;
  color_mode: string;
  sides: string;
  unit_price: string;
  unit: string;
  version?: number;
  active?: boolean;
};

export type Page<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

export type SegmentDraft = {
  file_id: string;
  page_start: number;
  page_end: number;
  paper_size: "A4" | "A3" | "LETTER";
  color_mode: "BW" | "COLOR";
  sides: "SIMPLEX" | "DUPLEX";
  orientation: "PORTRAIT" | "LANDSCAPE";
  copies: number;
};
