/**
 * TypeScript mirrors of the Laravel API Resources.
 *
 * These are the contract between the two applications. When a resource in
 * `backend/app/Http/Resources` changes, its type here changes with it.
 */

/* -------------------------------------------------------------------------- */
/* Envelopes                                                                  */
/* -------------------------------------------------------------------------- */

export interface Paginated<T> {
  data: T[];
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number | null;
    last_page: number;
    path: string;
    per_page: number;
    to: number | null;
    total: number;
    /** Present on endpoints that also return aggregate totals. */
    totals?: Record<string, number>;
  };
}

export interface Single<T> {
  data: T;
  message?: string;
}

/** The error shape every failed request resolves to. */
export interface ApiErrorBody {
  message: string;
  error?: string;
  errors?: Record<string, string[]>;
  context?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/* Enumerated values                                                          */
/* -------------------------------------------------------------------------- */

export type RoleKey = 'owner' | 'manager' | 'staff';

export type StockStatusKey = 'in_stock' | 'low_stock' | 'out_of_stock';

export type MovementTypeKey = 'stock_in' | 'stock_out' | 'adjustment';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical';

/**
 * Permission keys, mirroring `App\Enums\Permission`. The UI uses these only to
 * decide what to render — every one is re-checked server-side.
 */
export type PermissionKey =
  | 'dashboard.view'
  | 'products.view'
  | 'products.manage'
  | 'products.delete'
  | 'categories.view'
  | 'categories.manage'
  | 'suppliers.view'
  | 'suppliers.manage'
  | 'inventory.view'
  | 'inventory.stock-in'
  | 'inventory.stock-out'
  | 'inventory.adjust'
  | 'reports.view'
  | 'reports.export'
  | 'prices.view'
  | 'prices.manage'
  | 'notifications.view'
  | 'audit-logs.view'
  | 'users.view'
  | 'users.manage'
  | 'settings.view'
  | 'settings.manage'
  | 'roles.manage';

/** The API returns enums as a value/label pair so the UI never hard-codes copy. */
export interface Labelled<TValue extends string = string> {
  value: TValue;
  label: string;
}

export interface UnitInfo extends Labelled {
  abbreviation: string;
}

/* -------------------------------------------------------------------------- */
/* Core resources                                                             */
/* -------------------------------------------------------------------------- */

export interface Address {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  formatted?: string | null;
}

export interface Business {
  id: number;
  name: string;
  slug: string;
  legal_name: string | null;
  contact_email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  address: Address;
  timezone: string;
  currency: string;
  logo_url: string | null;
  default_minimum_stock_level: number;
  settings: {
    notifications?: {
      low_stock_enabled?: boolean;
      out_of_stock_enabled?: boolean;
    };
  } & Record<string, unknown>;
  users_count?: number;
  created_at: string | null;
}

export interface UserSummary {
  id: number;
  name: string;
  initials: string;
}

export interface User {
  id: number;
  name: string;
  initials: string;
  email: string;
  role: Labelled<RoleKey> & { description: string };
  job_title: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_owner: boolean;
  last_login_at: string | null;
  invited_at: string | null;
  must_change_password: boolean;
  notification_preferences: Record<string, boolean>;
  business?: Business;
  /** Only present on `/auth/me` and `/users/{id}`. */
  permissions?: PermissionKey[];
  assignable_roles?: Labelled<RoleKey>[];
  created_at: string | null;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  products_count?: number;
  units_on_hand?: number | string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SupplierLink {
  supplier_sku: string | null;
  lead_time_days: number | null;
  minimum_order_quantity: number | null;
  is_preferred: boolean;
}

export interface SupplierSummary {
  id: number;
  name: string;
  link?: SupplierLink;
}

export interface Supplier {
  id: number;
  name: string;
  code: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: Address;
  default_lead_time_days: number | null;
  notes: string | null;
  is_active: boolean;
  products_count?: number;
  linked_products_count?: number;
  batches_count?: number;
  units_supplied?: number;
  link?: SupplierLink;
  products?: ProductSummary[];
  created_at: string | null;
  updated_at: string | null;
}

export interface ProductSummary {
  id: number;
  sku: string;
  name: string;
  unit: UnitInfo;
  category?: Category;
}

export interface Product {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  unit: UnitInfo;
  image_url: string | null;
  minimum_stock_level: number;
  reorder_quantity: number | null;
  quantity_on_hand: number;
  stock_status: Labelled<StockStatusKey>;
  is_active: boolean;
  is_archived: boolean;
  archived_at: string | null;
  category?: Category;
  suppliers?: SupplierSummary[];
  price?: ProductPrice;
  open_batches?: StockBatch[];
  batch_count?: number;
  movement_count?: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface StockBatchSummary {
  id: number;
  batch_number: string;
  received_at: string | null;
}

export interface StockBatch {
  id: number;
  batch_number: string;
  reference: string | null;
  quantity_received: number;
  quantity_remaining: number;
  quantity_consumed: number;
  /** Captured at receipt for traceability. Never used for valuation. */
  unit_cost: string | null;
  currency: string | null;
  received_at: string | null;
  expires_at: string | null;
  is_expired: boolean;
  is_depleted: boolean;
  notes: string | null;
  product?: ProductSummary;
  supplier?: SupplierSummary;
  created_by?: UserSummary;
  created_at: string | null;
}

export interface MovementAllocation {
  batch_id: number;
  batch_number: string | null;
  batch_received_at: string | null;
  quantity: number;
}

export interface StockMovement {
  id: number;
  type: Labelled<MovementTypeKey>;
  direction: 1 | -1;
  quantity: number;
  signed_quantity: number;
  balance_after: number;
  reference: string | null;
  reason: string | null;
  notes: string | null;
  occurred_at: string | null;
  product?: ProductSummary;
  supplier?: SupplierSummary;
  batch?: StockBatchSummary;
  /** Which batches FIFO consumed. Present on outbound movements. */
  allocations?: MovementAllocation[];
  created_by?: UserSummary;
  created_at: string | null;
}

export interface LedgerEntry {
  id: number;
  type: Labelled<MovementTypeKey>;
  quantity_change: number;
  balance_after: number;
  reference: string | null;
  notes: string | null;
  occurred_at: string | null;
  meta: Record<string, unknown> | null;
  product?: ProductSummary;
  supplier?: SupplierSummary;
  batch?: StockBatchSummary;
  user?: UserSummary;
  movement_id: number;
  created_at: string | null;
}

export interface ProductPriceHistoryEntry {
  id: number;
  reference_price: string;
  previous_price: string | null;
  change_percentage: number | null;
  currency: string;
  effective_from: string | null;
  effective_to: string | null;
  is_current: boolean;
  source: string | null;
  notes: string | null;
  image_url: string | null;
  product?: ProductSummary;
  recorded_by?: UserSummary;
  created_at: string | null;
}

export interface ProductPrice {
  id: number;
  product_id: number;
  reference_price: string;
  currency: string;
  effective_from: string | null;
  source: string | null;
  notes: string | null;
  image_url: string | null;
  product?: ProductSummary;
  updated_by?: UserSummary;
  history?: ProductPriceHistoryEntry[];
  updated_at: string | null;
}

export interface AppNotification {
  id: number;
  type: Labelled;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  resource_type: string | null;
  resource_id: number | null;
  action_url: string | null;
  data: Record<string, unknown> | null;
  is_personal: boolean;
  is_read: boolean;
  created_at: string | null;
}

export interface AuditLogEntry {
  id: number;
  action: Labelled;
  category: string;
  description: string;
  resource: { type: string | null; id: number | null };
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  ip_address: string | null;
  user: { id: number | null; name: string | null };
  created_at: string | null;
}

/* -------------------------------------------------------------------------- */
/* Composite payloads                                                         */
/* -------------------------------------------------------------------------- */

export interface DashboardKpis {
  total_products: number;
  total_inventory_units: number;
  low_stock_count: number;
  out_of_stock_count: number;
  stock_in_units: number;
  stock_out_units: number;
  stock_in_movements: number;
  stock_out_movements: number;
  adjustment_movements: number;
  active_suppliers: number;
  categories_count: number;
}

export interface MovementTrendPoint {
  date: string;
  stock_in: number;
  stock_out: number;
}

export interface CategoryBreakdownRow {
  category: string;
  color: string | null;
  products: number;
  units: number;
}

export interface TopMoverRow {
  product_id: number;
  name: string;
  sku: string;
  units_out: number;
}

export interface DashboardPayload {
  kpis: DashboardKpis;
  movement_trend: MovementTrendPoint[];
  category_breakdown: CategoryBreakdownRow[];
  top_movers: TopMoverRow[];
  recent_stock_in: StockMovement[];
  recent_stock_out: StockMovement[];
  low_stock: Product[];
  out_of_stock: Product[];
  recent_activity: AuditLogEntry[];
  recent_notifications: AppNotification[];
  period: { days: number; from: string; to: string };
}

export interface FifoPreview {
  available: number;
  sufficient: boolean;
  allocations: Array<{
    batch_id: number;
    batch_number: string;
    received_at: string;
    supplier: string | null;
    quantity_remaining: number;
    quantity_taken: number;
    depletes_batch: boolean;
  }>;
}

export interface AvailabilityPayload {
  product_id: number;
  sku: string;
  quantity_on_hand: number;
  available: number;
  minimum_stock_level: number;
  stock_status: StockStatusKey;
}

export interface PermissionCatalogueGroup {
  group: string;
  permissions: Array<{ key: PermissionKey; label: string; owner_only: boolean }>;
}

export interface RoleMatrixRow {
  key: RoleKey;
  label: string;
  description: string;
  is_editable: boolean;
  permissions: PermissionKey[];
}

export interface RolesPayload {
  roles: RoleMatrixRow[];
  catalogue: PermissionCatalogueGroup[];
}

export interface AuthSession {
  token: string;
  user: User;
  message?: string;
}

/* -------------------------------------------------------------------------- */
/* Request payloads                                                           */
/* -------------------------------------------------------------------------- */

export interface LoginPayload {
  email: string;
  password: string;
  remember?: boolean;
  device_name?: string;
}

export interface RegisterPayload {
  business_name: string;
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  industry?: string;
  timezone?: string;
  currency?: string;
  terms_accepted: boolean;
}

export interface StockInPayload {
  product_id: number;
  quantity: number;
  supplier_id?: number | null;
  batch_number?: string | null;
  reference?: string | null;
  unit_cost?: string | null;
  received_at?: string | null;
  expires_at?: string | null;
  notes?: string | null;
}

export interface StockOutPayload {
  product_id: number;
  quantity: number;
  reference?: string | null;
  reason?: string | null;
  occurred_at?: string | null;
  notes?: string | null;
}

export interface AdjustmentPayload {
  product_id: number;
  quantity_delta: number;
  reason: string;
  reference?: string | null;
  occurred_at?: string | null;
  notes?: string | null;
}

/** Filters accepted by the list and report endpoints. */
export interface ListFilters {
  search?: string;
  date_from?: string;
  date_to?: string;
  product_id?: number;
  supplier_id?: number;
  category_id?: number;
  type?: MovementTypeKey;
  stock_status?: StockStatusKey;
  include_archived?: boolean;
  include_inactive?: boolean;
  include_depleted?: boolean;
  sort?: string;
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}
