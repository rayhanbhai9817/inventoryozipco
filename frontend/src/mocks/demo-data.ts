/**
 * Demo data for building and reviewing the interface before a database exists.
 *
 * ISOLATION: nothing outside `src/mocks/` and `src/lib/data-source.ts` imports
 * this file, and it is only reachable when `NEXT_PUBLIC_DEMO_MODE=true`. It is a
 * development aid, not a fallback — with demo mode off, the app talks to the
 * Laravel API and this module is never touched.
 *
 * The data is generated the way the real system would produce it: batches are
 * consumed oldest-first, every movement appends a ledger line carrying the
 * running balance, and quantities are derived from the batches rather than set by
 * hand. That means the UI is exercised against consistent data, and the FIFO
 * panels show something truthful.
 */

import type {
  AppNotification,
  AuditLogEntry,
  Business,
  Category,
  DashboardPayload,
  LedgerEntry,
  Paginated,
  Product,
  ProductPrice,
  ProductPriceHistoryEntry,
  StockBatch,
  StockMovement,
  Supplier,
  User,
} from '@/types/api';

/* -------------------------------------------------------------------------- */
/* Deterministic pseudo-randomness                                            */
/* -------------------------------------------------------------------------- */

/**
 * A seeded generator, so the demo looks identical on every reload and between
 * server and client render. `Math.random()` here would cause hydration
 * mismatches and make screenshots useless for comparison.
 */
function createRandom(seed: number) {
  let state = seed;

  return {
    next(): number {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    },
    int(min: number, max: number): number {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(this.next() * items.length)];
    },
  };
}

const random = createRandom(20260910);

/** A fixed "now" so relative dates are stable across renders. */
const NOW = new Date('2026-09-10T14:30:00Z');

function daysAgo(days: number, hour = 9, minute = 15): string {
  const date = new Date(NOW);
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

function dateOnly(days: number): string {
  return daysAgo(days).slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/* Business and users                                                         */
/* -------------------------------------------------------------------------- */

export const demoBusiness: Business = {
  id: 1,
  name: 'Fast Sold Demo Warehouse',
  slug: 'fast-sold-demo',
  legal_name: 'Fast Sold Demo Warehouse LLC',
  contact_email: 'hello@fastsold.test',
  phone: '+1-555-0142',
  website: 'https://fastsold.test',
  industry: 'Wholesale distribution',
  address: {
    line1: '1840 Industrial Parkway',
    line2: 'Building C',
    city: 'Austin',
    state: 'TX',
    postal_code: '78744',
    country: 'US',
  },
  timezone: 'America/Chicago',
  currency: 'USD',
  logo_url: null,
  default_minimum_stock_level: 10,
  settings: {
    notifications: { low_stock_enabled: true, out_of_stock_enabled: true },
  },
  users_count: 4,
  created_at: daysAgo(420),
};

export const demoUsers: User[] = [
  {
    id: 1,
    name: 'Dana Okonkwo',
    initials: 'DO',
    email: 'owner@fastsold.test',
    role: {
      value: 'owner',
      label: 'Owner',
      description:
        'Full access to the business, including users, billing details, settings and audit history.',
    },
    job_title: 'Founder',
    phone: '+1-555-0101',
    avatar_url: null,
    is_active: true,
    is_owner: true,
    last_login_at: daysAgo(0, 8, 42),
    invited_at: null,
    must_change_password: false,
    notification_preferences: {},
    created_at: daysAgo(420),
  },
  {
    id: 2,
    name: 'Priya Raghunathan',
    initials: 'PR',
    email: 'manager@fastsold.test',
    role: {
      value: 'manager',
      label: 'Manager',
      description: 'Runs day-to-day operations: products, suppliers, stock movements and reports.',
    },
    job_title: 'Operations Manager',
    phone: '+1-555-0102',
    avatar_url: null,
    is_active: true,
    is_owner: false,
    last_login_at: daysAgo(0, 7, 55),
    invited_at: daysAgo(380),
    must_change_password: false,
    notification_preferences: {},
    created_at: daysAgo(380),
  },
  {
    id: 3,
    name: 'Marcus Oyelaran',
    initials: 'MO',
    email: 'staff@fastsold.test',
    role: {
      value: 'staff',
      label: 'Staff',
      description: 'Records stock movements and views inventory. No administrative access.',
    },
    job_title: 'Warehouse Associate',
    phone: '+1-555-0103',
    avatar_url: null,
    is_active: true,
    is_owner: false,
    last_login_at: daysAgo(1, 16, 20),
    invited_at: daysAgo(210),
    must_change_password: false,
    notification_preferences: {},
    created_at: daysAgo(210),
  },
  {
    id: 4,
    name: 'Sofia Brennan',
    initials: 'SB',
    email: 'sofia@fastsold.test',
    role: {
      value: 'staff',
      label: 'Staff',
      description: 'Records stock movements and views inventory. No administrative access.',
    },
    job_title: 'Receiving Clerk',
    phone: null,
    avatar_url: null,
    is_active: false,
    is_owner: false,
    last_login_at: daysAgo(64, 11, 5),
    invited_at: daysAgo(120),
    must_change_password: false,
    notification_preferences: {},
    created_at: daysAgo(120),
  },
];

/** The signed-in user in demo mode: an Owner, so every screen is reachable. */
export const demoCurrentUser: User = {
  ...demoUsers[0],
  business: demoBusiness,
  permissions: [
    'dashboard.view',
    'products.view',
    'products.manage',
    'products.delete',
    'categories.view',
    'categories.manage',
    'suppliers.view',
    'suppliers.manage',
    'inventory.view',
    'inventory.stock-in',
    'inventory.stock-out',
    'inventory.adjust',
    'reports.view',
    'reports.export',
    'prices.view',
    'prices.manage',
    'notifications.view',
    'audit-logs.view',
    'users.view',
    'users.manage',
    'settings.view',
    'settings.manage',
    'roles.manage',
  ],
  assignable_roles: [
    { value: 'owner', label: 'Owner' },
    { value: 'manager', label: 'Manager' },
    { value: 'staff', label: 'Staff' },
  ],
};

/* -------------------------------------------------------------------------- */
/* Categories and suppliers                                                   */
/* -------------------------------------------------------------------------- */

export const demoCategories: Category[] = [
  ['Power Tools', '#137E87'],
  ['Fasteners', '#FF5A1F'],
  ['Safety Equipment', '#6366F1'],
  ['Electrical', '#0EA5A4'],
  ['Packaging', '#A855F7'],
  ['Hand Tools', '#F79009'],
].map(([name, color], index) => ({
  id: index + 1,
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  description: `${name} stocked for trade and retail customers.`,
  color,
  is_active: true,
  products_count: 0,
  units_on_hand: 0,
  created_at: daysAgo(400 - index * 12),
  updated_at: daysAgo(30),
}));

export const demoSuppliers: Supplier[] = [
  {
    id: 1,
    name: 'Northwind Industrial',
    code: 'NWI',
    contact_name: 'Harriet Cole',
    email: 'orders@northwind.test',
    phone: '+1-555-2201',
    website: 'https://northwind.test',
    address: {
      line1: '220 Foundry Road',
      line2: null,
      city: 'Cleveland',
      state: 'OH',
      postal_code: '44114',
      country: 'US',
      formatted: '220 Foundry Road, Cleveland, OH, 44114, US',
    },
    default_lead_time_days: 7,
    notes: 'Primary supplier for power tools. Net 30 terms.',
    is_active: true,
    created_at: daysAgo(400),
    updated_at: daysAgo(22),
  },
  {
    id: 2,
    name: 'Cascade Hardware Co',
    code: 'CHC',
    contact_name: 'Jonah Reyes',
    email: 'sales@cascadehw.test',
    phone: '+1-555-2202',
    website: 'https://cascadehw.test',
    address: {
      line1: '18 Millrace Street',
      line2: 'Unit 4',
      city: 'Portland',
      state: 'OR',
      postal_code: '97209',
      country: 'US',
      formatted: '18 Millrace Street, Unit 4, Portland, OR, 97209, US',
    },
    default_lead_time_days: 14,
    notes: 'Good pricing on bulk fasteners, longer lead time.',
    is_active: true,
    created_at: daysAgo(390),
    updated_at: daysAgo(40),
  },
  {
    id: 3,
    name: 'Lumen Electrical Supply',
    code: 'LES',
    contact_name: 'Amara Diallo',
    email: 'hello@lumensupply.test',
    phone: '+1-555-2203',
    website: null,
    address: {
      line1: '905 Circuit Avenue',
      line2: null,
      city: 'Phoenix',
      state: 'AZ',
      postal_code: '85004',
      country: 'US',
      formatted: '905 Circuit Avenue, Phoenix, AZ, 85004, US',
    },
    default_lead_time_days: 10,
    notes: null,
    is_active: true,
    created_at: daysAgo(330),
    updated_at: daysAgo(15),
  },
  {
    id: 4,
    name: 'Pacific Packaging Group',
    code: 'PPG',
    contact_name: 'Wes Tanaka',
    email: 'team@pacpack.test',
    phone: '+1-555-2204',
    website: 'https://pacpack.test',
    address: {
      line1: '77 Harbour Way',
      line2: null,
      city: 'Long Beach',
      state: 'CA',
      postal_code: '90802',
      country: 'US',
      formatted: '77 Harbour Way, Long Beach, CA, 90802, US',
    },
    default_lead_time_days: 5,
    notes: 'Fastest turnaround. Slightly higher unit cost.',
    is_active: true,
    created_at: daysAgo(300),
    updated_at: daysAgo(8),
  },
  {
    id: 5,
    name: 'Granite Tool Imports',
    code: 'GTI',
    contact_name: 'Lena Fischer',
    email: 'import@granitetool.test',
    phone: '+1-555-2205',
    website: null,
    address: {
      line1: '12 Quarry Lane',
      line2: null,
      city: 'Buffalo',
      state: 'NY',
      postal_code: '14203',
      country: 'US',
      formatted: '12 Quarry Lane, Buffalo, NY, 14203, US',
    },
    default_lead_time_days: 28,
    notes: 'Dormant since Q1 — kept for historical batches.',
    is_active: false,
    created_at: daysAgo(280),
    updated_at: daysAgo(150),
  },
];

/* -------------------------------------------------------------------------- */
/* Products, batches, movements and the ledger                                */
/* -------------------------------------------------------------------------- */

interface ProductSeed {
  sku: string;
  name: string;
  categoryId: number;
  unit: [value: string, label: string, abbreviation: string];
  minimum: number;
  /** Target end state, so the demo shows all three stock statuses. */
  target: 'healthy' | 'low' | 'empty';
  price?: number;
  suppliers: number[];
}

const PRODUCT_SEEDS: ProductSeed[] = [
  { sku: 'FS-DRL-1801', name: '18V Brushless Drill Driver', categoryId: 1, unit: ['each', 'Each', 'ea'], minimum: 8, target: 'healthy', price: 189.0, suppliers: [1, 5] },
  { sku: 'FS-DRL-1802', name: '18V Impact Driver', categoryId: 1, unit: ['each', 'Each', 'ea'], minimum: 6, target: 'low', price: 164.5, suppliers: [1] },
  { sku: 'FS-SAW-7250', name: '7¼in Circular Saw', categoryId: 1, unit: ['each', 'Each', 'ea'], minimum: 4, target: 'healthy', price: 142.0, suppliers: [1, 5] },
  { sku: 'FS-GRD-125', name: '125mm Angle Grinder', categoryId: 1, unit: ['each', 'Each', 'ea'], minimum: 5, target: 'empty', price: 98.75, suppliers: [5] },
  { sku: 'FS-BLT-M8', name: 'M8 Hex Bolt, Zinc (box of 200)', categoryId: 2, unit: ['box', 'Box', 'box'], minimum: 20, target: 'healthy', price: 24.4, suppliers: [2] },
  { sku: 'FS-SCR-4530', name: '4.5 × 30mm Wood Screw (box of 500)', categoryId: 2, unit: ['box', 'Box', 'box'], minimum: 25, target: 'healthy', price: 18.9, suppliers: [2] },
  { sku: 'FS-ANC-1050', name: '10 × 50mm Wall Anchor (pack of 100)', categoryId: 2, unit: ['pack', 'Pack', 'pk'], minimum: 15, target: 'low', price: 12.25, suppliers: [2, 4] },
  { sku: 'FS-WSH-M10', name: 'M10 Flat Washer (box of 1000)', categoryId: 2, unit: ['box', 'Box', 'box'], minimum: 12, target: 'healthy', suppliers: [2] },
  { sku: 'FS-GLV-CUT3', name: 'Cut-Resistant Gloves, Level 3', categoryId: 3, unit: ['pack', 'Pack', 'pk'], minimum: 30, target: 'healthy', price: 9.6, suppliers: [4, 2] },
  { sku: 'FS-HLM-WHT', name: 'Hard Hat, Vented, White', categoryId: 3, unit: ['each', 'Each', 'ea'], minimum: 12, target: 'low', price: 22.5, suppliers: [4] },
  { sku: 'FS-GOG-CLR', name: 'Safety Goggles, Anti-Fog', categoryId: 3, unit: ['each', 'Each', 'ea'], minimum: 40, target: 'healthy', price: 7.15, suppliers: [4] },
  { sku: 'FS-VST-HIV', name: 'Hi-Vis Vest, Class 2', categoryId: 3, unit: ['each', 'Each', 'ea'], minimum: 25, target: 'empty', price: 11.4, suppliers: [4] },
  { sku: 'FS-CBL-2C15', name: '2-Core 1.5mm Cable (100m reel)', categoryId: 4, unit: ['each', 'Each', 'ea'], minimum: 5, target: 'healthy', price: 129.99, suppliers: [3] },
  { sku: 'FS-SKT-DBL', name: 'Double Socket Outlet, White', categoryId: 4, unit: ['each', 'Each', 'ea'], minimum: 25, target: 'healthy', price: 6.8, suppliers: [3] },
  { sku: 'FS-BRK-16A', name: '16A Circuit Breaker', categoryId: 4, unit: ['each', 'Each', 'ea'], minimum: 18, target: 'healthy', price: 14.2, suppliers: [3] },
  { sku: 'FS-CDU-8W', name: '8-Way Consumer Unit', categoryId: 4, unit: ['each', 'Each', 'ea'], minimum: 6, target: 'empty', suppliers: [3] },
  { sku: 'FS-BOX-MED', name: 'Double-Wall Carton, Medium', categoryId: 5, unit: ['pack', 'Pack', 'pk'], minimum: 50, target: 'healthy', price: 32.0, suppliers: [4] },
  { sku: 'FS-TAP-48', name: '48mm Packing Tape (pack of 6)', categoryId: 5, unit: ['pack', 'Pack', 'pk'], minimum: 20, target: 'healthy', price: 15.75, suppliers: [4] },
  { sku: 'FS-WRP-500', name: 'Stretch Wrap, 500mm', categoryId: 5, unit: ['each', 'Each', 'ea'], minimum: 10, target: 'low', price: 19.3, suppliers: [4] },
  { sku: 'FS-SPN-250', name: '250mm Adjustable Spanner', categoryId: 6, unit: ['each', 'Each', 'ea'], minimum: 10, target: 'healthy', price: 27.5, suppliers: [1, 5] },
  { sku: 'FS-PLR-200', name: '200mm Combination Pliers', categoryId: 6, unit: ['each', 'Each', 'ea'], minimum: 12, target: 'healthy', price: 21.0, suppliers: [1] },
  { sku: 'FS-TAP-5M', name: '5m Tape Measure', categoryId: 6, unit: ['each', 'Each', 'ea'], minimum: 30, target: 'healthy', price: 13.45, suppliers: [1, 4] },
];

interface GeneratedWorld {
  products: Product[];
  batches: StockBatch[];
  movements: StockMovement[];
  ledger: LedgerEntry[];
  prices: ProductPrice[];
  priceHistory: ProductPriceHistoryEntry[];
}

/**
 * Builds the whole demo inventory by simulating the real engine: receipts open
 * batches, withdrawals consume them oldest-first, and each step appends a ledger
 * line with the running balance. Quantities are never written directly.
 */
function generateWorld(): GeneratedWorld {
  const products: Product[] = [];
  const batches: StockBatch[] = [];
  const movements: StockMovement[] = [];
  const ledger: LedgerEntry[] = [];
  const prices: ProductPrice[] = [];
  const priceHistory: ProductPriceHistoryEntry[] = [];

  let batchId = 1;
  let movementId = 1;
  let ledgerId = 1;
  let priceHistoryId = 1;

  PRODUCT_SEEDS.forEach((seed, index) => {
    const productId = index + 1;
    const category = demoCategories.find((entry) => entry.id === seed.categoryId)!;
    const unit = { value: seed.unit[0], label: seed.unit[1], abbreviation: seed.unit[2] };
    const productSummary = { id: productId, sku: seed.sku, name: seed.name, unit };

    // --- receipts -------------------------------------------------------
    const openBatches: Array<{ batch: StockBatch; remaining: number }> = [];
    let balance = 0;

    const receipts = [
      { days: 68, size: 40 + random.int(0, 40) },
      { days: 40, size: 25 + random.int(0, 30) },
      { days: 14, size: 20 + random.int(0, 25) },
    ];

    receipts.forEach((receipt, wave) => {
      const supplierId = seed.suppliers[wave % seed.suppliers.length];
      const supplier = demoSuppliers.find((entry) => entry.id === supplierId)!;
      const receivedAt = daysAgo(receipt.days);
      const unitCost = seed.price ? (seed.price * 0.62).toFixed(4) : null;

      const batch: StockBatch = {
        id: batchId,
        batch_number: `IN-${seed.sku.replace(/[^A-Z0-9]/g, '').slice(0, 6)}-${String(batchId).padStart(4, '0')}`,
        reference: `PO-${1000 + productId * 3 + wave}`,
        quantity_received: receipt.size,
        quantity_remaining: receipt.size,
        quantity_consumed: 0,
        unit_cost: unitCost,
        currency: unitCost ? 'USD' : null,
        received_at: receivedAt,
        expires_at: null,
        is_expired: false,
        is_depleted: false,
        notes: null,
        product: productSummary,
        supplier: { id: supplier.id, name: supplier.name },
        created_by: { id: 2, name: 'Priya Raghunathan', initials: 'PR' },
        created_at: receivedAt,
      };

      batches.push(batch);
      openBatches.push({ batch, remaining: receipt.size });
      balance += receipt.size;
      batchId += 1;

      const movement: StockMovement = {
        id: movementId++,
        type: { value: 'stock_in', label: 'Stock in' },
        direction: 1,
        quantity: receipt.size,
        signed_quantity: receipt.size,
        balance_after: balance,
        reference: batch.reference,
        reason: null,
        notes: wave === 0 ? 'Opening stock for the demo catalogue.' : null,
        occurred_at: receivedAt,
        product: productSummary,
        supplier: { id: supplier.id, name: supplier.name },
        batch: { id: batch.id, batch_number: batch.batch_number, received_at: receivedAt },
        created_by: { id: 2, name: 'Priya Raghunathan', initials: 'PR' },
        created_at: receivedAt,
      };

      movements.push(movement);

      ledger.push({
        id: ledgerId++,
        type: movement.type,
        quantity_change: receipt.size,
        balance_after: balance,
        reference: batch.reference,
        notes: movement.notes,
        occurred_at: receivedAt,
        meta: { batch_number: batch.batch_number },
        product: productSummary,
        supplier: { id: supplier.id, name: supplier.name },
        batch: { id: batch.id, batch_number: batch.batch_number, received_at: receivedAt },
        user: { id: 2, name: 'Priya Raghunathan', initials: 'PR' },
        movement_id: movement.id,
        created_at: receivedAt,
      });
    });

    // --- withdrawals, consuming FIFO ------------------------------------
    const target =
      seed.target === 'empty' ? 0 : seed.target === 'low' ? Math.max(1, Math.floor(seed.minimum * 0.6)) : Math.floor(balance * 0.55);

    let toIssue = Math.max(0, balance - target);
    const withdrawals = toIssue > 0 ? Math.min(4, Math.max(1, Math.floor(toIssue / 14))) : 0;

    for (let slice = 0; slice < withdrawals; slice += 1) {
      const isLast = slice === withdrawals - 1;
      const amount = isLast ? toIssue : Math.max(1, Math.floor(toIssue / (withdrawals - slice)));

      if (amount <= 0) continue;

      const occurredAt = daysAgo(10 - slice * 2, 14, 30);
      const allocations: StockMovement['allocations'] = [];
      let outstanding = amount;
      let runningBalance = balance;

      // Oldest batch first.
      for (const entry of openBatches) {
        if (outstanding <= 0) break;
        if (entry.remaining <= 0) continue;

        const take = Math.min(entry.remaining, outstanding);
        entry.remaining -= take;
        entry.batch.quantity_remaining = entry.remaining;
        entry.batch.quantity_consumed = entry.batch.quantity_received - entry.remaining;
        entry.batch.is_depleted = entry.remaining === 0;

        outstanding -= take;
        runningBalance -= take;

        allocations.push({
          batch_id: entry.batch.id,
          batch_number: entry.batch.batch_number,
          batch_received_at: entry.batch.received_at,
          quantity: take,
        });

        ledger.push({
          id: ledgerId++,
          type: { value: 'stock_out', label: 'Stock out' },
          quantity_change: -take,
          balance_after: runningBalance,
          reference: `SO-${5000 + productId * 4 + slice}`,
          notes: null,
          occurred_at: occurredAt,
          meta: { batch_number: entry.batch.batch_number, fifo: true },
          product: productSummary,
          supplier: entry.batch.supplier,
          batch: {
            id: entry.batch.id,
            batch_number: entry.batch.batch_number,
            received_at: entry.batch.received_at,
          },
          user: { id: 3, name: 'Marcus Oyelaran', initials: 'MO' },
          movement_id: movementId,
          created_at: occurredAt,
        });
      }

      balance = runningBalance;
      toIssue -= amount;

      movements.push({
        id: movementId++,
        type: { value: 'stock_out', label: 'Stock out' },
        direction: -1,
        quantity: amount,
        signed_quantity: -amount,
        balance_after: balance,
        reference: `SO-${5000 + productId * 4 + slice}`,
        reason: random.pick(['Customer order', 'Trade counter', 'Branch transfer', 'Contract job']),
        notes: null,
        occurred_at: occurredAt,
        product: productSummary,
        allocations,
        created_by: { id: 3, name: 'Marcus Oyelaran', initials: 'MO' },
        created_at: occurredAt,
      });
    }

    // --- one adjustment, so the ledger shows all three types -------------
    if (index % 7 === 3 && balance > 3) {
      const occurredAt = daysAgo(4, 11, 5);
      const delta = -2;
      const oldest = openBatches.find((entry) => entry.remaining > 0);

      if (oldest) {
        oldest.remaining -= 2;
        oldest.batch.quantity_remaining = oldest.remaining;
        oldest.batch.quantity_consumed = oldest.batch.quantity_received - oldest.remaining;
        balance += delta;

        movements.push({
          id: movementId++,
          type: { value: 'adjustment', label: 'Adjustment' },
          direction: -1,
          quantity: 2,
          signed_quantity: delta,
          balance_after: balance,
          reference: null,
          reason: 'Damaged during handling',
          notes: 'Found during the weekly count.',
          occurred_at: occurredAt,
          product: productSummary,
          created_by: { id: 1, name: 'Dana Okonkwo', initials: 'DO' },
          created_at: occurredAt,
        });

        ledger.push({
          id: ledgerId++,
          type: { value: 'adjustment', label: 'Adjustment' },
          quantity_change: delta,
          balance_after: balance,
          reference: null,
          notes: 'Found during the weekly count.',
          occurred_at: occurredAt,
          meta: { reason: 'Damaged during handling', batch_number: oldest.batch.batch_number },
          product: productSummary,
          batch: {
            id: oldest.batch.id,
            batch_number: oldest.batch.batch_number,
            received_at: oldest.batch.received_at,
          },
          user: { id: 1, name: 'Dana Okonkwo', initials: 'DO' },
          movement_id: movementId - 1,
          created_at: occurredAt,
        });
      }
    }

    // --- reference price, for most products ------------------------------
    if (seed.price) {
      const previous = Number((seed.price * 0.92).toFixed(2));

      priceHistory.push({
        id: priceHistoryId++,
        reference_price: previous.toFixed(4),
        previous_price: null,
        change_percentage: null,
        currency: 'USD',
        effective_from: dateOnly(150),
        effective_to: dateOnly(30),
        is_current: false,
        source: 'Supplier list, spring',
        notes: null,
        image_url: null,
        product: productSummary,
        recorded_by: { id: 1, name: 'Dana Okonkwo', initials: 'DO' },
        created_at: daysAgo(150),
      });

      priceHistory.push({
        id: priceHistoryId++,
        reference_price: seed.price.toFixed(4),
        previous_price: previous.toFixed(4),
        change_percentage: Number((((seed.price - previous) / previous) * 100).toFixed(2)),
        currency: 'USD',
        effective_from: dateOnly(30),
        effective_to: null,
        is_current: true,
        source: 'Supplier list, current',
        notes: 'Reference only — does not affect inventory valuation.',
        image_url: null,
        product: productSummary,
        recorded_by: { id: 1, name: 'Dana Okonkwo', initials: 'DO' },
        created_at: daysAgo(30),
      });

      prices.push({
        id: prices.length + 1,
        product_id: productId,
        reference_price: seed.price.toFixed(4),
        currency: 'USD',
        effective_from: dateOnly(30),
        source: 'Supplier list, current',
        notes: 'Reference only — does not affect inventory valuation.',
        image_url: null,
        product: { ...productSummary, category },
        updated_by: { id: 1, name: 'Dana Okonkwo', initials: 'DO' },
        updated_at: daysAgo(30),
      });
    }

    const status =
      balance <= 0 ? 'out_of_stock' : seed.minimum > 0 && balance <= seed.minimum ? 'low_stock' : 'in_stock';

    const productBatches = batches.filter((batch) => batch.product?.id === productId);

    products.push({
      id: productId,
      sku: seed.sku,
      barcode: `50${String(productId).padStart(11, '0')}`,
      name: seed.name,
      description: `${seed.name} — stocked for trade and retail customers. Demo catalogue item.`,
      unit,
      image_url: null,
      minimum_stock_level: seed.minimum,
      reorder_quantity: seed.minimum * 4,
      quantity_on_hand: balance,
      stock_status: {
        value: status,
        label: status === 'in_stock' ? 'In stock' : status === 'low_stock' ? 'Low stock' : 'Out of stock',
      },
      is_active: true,
      is_archived: false,
      archived_at: null,
      category,
      suppliers: seed.suppliers.map((supplierId, supplierIndex) => {
        const supplier = demoSuppliers.find((entry) => entry.id === supplierId)!;

        return {
          id: supplier.id,
          name: supplier.name,
          link: {
            supplier_sku: `${supplier.code}-${seed.sku.slice(-4)}`,
            lead_time_days: supplier.default_lead_time_days,
            minimum_order_quantity: 10,
            is_preferred: supplierIndex === 0,
          },
        };
      }),
      price: prices.find((price) => price.product_id === productId),
      open_batches: productBatches.filter((batch) => batch.quantity_remaining > 0),
      batch_count: productBatches.length,
      movement_count: movements.filter((movement) => movement.product?.id === productId).length,
      created_at: daysAgo(300 - index * 6),
      updated_at: daysAgo(2),
    });
  });

  // Backfill the per-category counters now that every product exists.
  demoCategories.forEach((category) => {
    const owned = products.filter((product) => product.category?.id === category.id);
    category.products_count = owned.length;
    category.units_on_hand = owned.reduce((sum, product) => sum + product.quantity_on_hand, 0);
  });

  // Same for supplier aggregates.
  demoSuppliers.forEach((supplier) => {
    const supplied = batches.filter((batch) => batch.supplier?.id === supplier.id);
    supplier.batches_count = supplied.length;
    supplier.units_supplied = supplied.reduce((sum, batch) => sum + batch.quantity_received, 0);
    supplier.products_count = products.filter((product) =>
      product.suppliers?.some((entry) => entry.id === supplier.id),
    ).length;
    supplier.linked_products_count = supplier.products_count;
  });

  // Newest first, which is how every list in the product reads.
  movements.sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? '') || b.id - a.id);
  ledger.sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? '') || b.id - a.id);

  return { products, batches, movements, ledger, prices, priceHistory };
}

const world = generateWorld();

export const demoProducts = world.products;
export const demoBatches = world.batches;
export const demoMovements = world.movements;
export const demoLedger = world.ledger;
export const demoPrices = world.prices;
export const demoPriceHistory = world.priceHistory;

/* -------------------------------------------------------------------------- */
/* Notifications and audit log                                                */
/* -------------------------------------------------------------------------- */

export const demoNotifications: AppNotification[] = [
  ...demoProducts
    .filter((product) => product.stock_status.value === 'out_of_stock')
    .map((product, index) => ({
      id: 100 + index,
      type: { value: 'out_of_stock', label: 'Out of stock' },
      severity: 'critical' as const,
      title: `${product.name} is out of stock`,
      body: `${product.name} (${product.sku}) has no remaining stock. Record a stock in to replenish it.`,
      resource_type: 'product',
      resource_id: product.id,
      action_url: `/products/${product.id}`,
      data: { product_sku: product.sku, quantity_on_hand: 0 },
      is_personal: false,
      is_read: false,
      created_at: daysAgo(index, 10, 12),
    })),
  ...demoProducts
    .filter((product) => product.stock_status.value === 'low_stock')
    .map((product, index) => ({
      id: 200 + index,
      type: { value: 'low_stock', label: 'Low stock' },
      severity: 'warning' as const,
      title: `${product.name} is running low`,
      body: `${product.name} (${product.sku}) is down to ${product.quantity_on_hand} ${product.unit.abbreviation}, at or below its minimum of ${product.minimum_stock_level}.`,
      resource_type: 'product',
      resource_id: product.id,
      action_url: `/products/${product.id}`,
      data: { product_sku: product.sku, quantity_on_hand: product.quantity_on_hand },
      is_personal: false,
      is_read: index > 0,
      created_at: daysAgo(index + 1, 15, 40),
    })),
  {
    id: 300,
    type: { value: 'missing_price_reference', label: 'Product without price reference' },
    severity: 'warning',
    title: 'FS-WSH-M10 has no reference price',
    body: 'Add FS-WSH-M10 to the price catalogue to keep reference pricing complete.',
    resource_type: 'product',
    resource_id: 8,
    action_url: '/price-catalog',
    data: null,
    is_personal: false,
    is_read: false,
    created_at: daysAgo(3, 9, 5),
  },
  {
    id: 301,
    type: { value: 'stock_in_recorded', label: 'Stock in recorded' },
    severity: 'success',
    title: 'Stock in recorded for 2-Core 1.5mm Cable',
    body: '45 ea received against PO-1039. Balance is now 97.',
    resource_type: 'product',
    resource_id: 13,
    action_url: '/stock-in',
    data: null,
    is_personal: false,
    is_read: true,
    created_at: daysAgo(14, 9, 15),
  },
  {
    id: 302,
    type: { value: 'role_changed', label: 'Role changed' },
    severity: 'info',
    title: 'Your role is now Owner',
    body: 'Full access to the business, including users, settings and audit history.',
    resource_type: null,
    resource_id: null,
    action_url: '/settings',
    data: null,
    is_personal: true,
    is_read: true,
    created_at: daysAgo(380, 12, 0),
  },
];

export const demoAuditLog: AuditLogEntry[] = [
  {
    id: 1,
    action: { value: 'inventory.stock_out', label: 'Inventory · Stock out' },
    category: 'inventory',
    description: 'Issued 18 ea of Safety Goggles, Anti-Fog (FS-GOG-CLR)',
    resource: { type: 'Product', id: 11 },
    old_values: null,
    new_values: { quantity: 18, reference: 'SO-5044', balance_after: 126 },
    meta: null,
    ip_address: '198.51.100.24',
    user: { id: 3, name: 'Marcus Oyelaran' },
    created_at: daysAgo(0, 11, 42),
  },
  {
    id: 2,
    action: { value: 'inventory.adjusted', label: 'Inventory · Adjusted' },
    category: 'inventory',
    description: 'Adjusted 125mm Angle Grinder (FS-GRD-125) by −2 ea — Damaged during handling',
    resource: { type: 'Product', id: 4 },
    old_values: { quantity_on_hand: 2 },
    new_values: { quantity_on_hand: 0, reason: 'Damaged during handling' },
    meta: null,
    ip_address: '198.51.100.11',
    user: { id: 1, name: 'Dana Okonkwo' },
    created_at: daysAgo(4, 11, 5),
  },
  {
    id: 3,
    action: { value: 'price.updated', label: 'Price · Updated' },
    category: 'price',
    description: 'Updated reference price for 18V Brushless Drill Driver (FS-DRL-1801): USD 189.0000',
    resource: { type: 'Product', id: 1 },
    old_values: { reference_price: '173.8800' },
    new_values: { reference_price: '189.0000', currency: 'USD' },
    meta: null,
    ip_address: '198.51.100.11',
    user: { id: 1, name: 'Dana Okonkwo' },
    created_at: daysAgo(30, 16, 20),
  },
  {
    id: 4,
    action: { value: 'inventory.stock_in', label: 'Inventory · Stock in' },
    category: 'inventory',
    description: 'Received 45 ea of 2-Core 1.5mm Cable (FS-CBL-2C15)',
    resource: { type: 'Product', id: 13 },
    old_values: null,
    new_values: { quantity: 45, reference: 'PO-1039', balance_after: 97 },
    meta: null,
    ip_address: '198.51.100.18',
    user: { id: 2, name: 'Priya Raghunathan' },
    created_at: daysAgo(14, 9, 15),
  },
  {
    id: 5,
    action: { value: 'product.created', label: 'Product · Created' },
    category: 'product',
    description: 'Created product 5m Tape Measure (FS-TAP-5M)',
    resource: { type: 'Product', id: 22 },
    old_values: null,
    new_values: { sku: 'FS-TAP-5M', name: '5m Tape Measure', unit: 'each' },
    meta: null,
    ip_address: '198.51.100.18',
    user: { id: 2, name: 'Priya Raghunathan' },
    created_at: daysAgo(46, 10, 30),
  },
  {
    id: 6,
    action: { value: 'user.deactivated', label: 'User · Deactivated' },
    category: 'user',
    description: 'Deactivated Sofia Brennan',
    resource: { type: 'User', id: 4 },
    old_values: null,
    new_values: { is_active: false },
    meta: null,
    ip_address: '198.51.100.11',
    user: { id: 1, name: 'Dana Okonkwo' },
    created_at: daysAgo(64, 17, 2),
  },
  {
    id: 7,
    action: { value: 'auth.login', label: 'Auth · Login' },
    category: 'auth',
    description: 'Dana Okonkwo signed in',
    resource: { type: 'User', id: 1 },
    old_values: null,
    new_values: null,
    meta: null,
    ip_address: '198.51.100.11',
    user: { id: 1, name: 'Dana Okonkwo' },
    created_at: daysAgo(0, 8, 42),
  },
  {
    id: 8,
    action: { value: 'supplier.updated', label: 'Supplier · Updated' },
    category: 'supplier',
    description: 'Updated supplier "Pacific Packaging Group"',
    resource: { type: 'Supplier', id: 4 },
    old_values: { default_lead_time_days: 7 },
    new_values: { default_lead_time_days: 5 },
    meta: null,
    ip_address: '198.51.100.18',
    user: { id: 2, name: 'Priya Raghunathan' },
    created_at: daysAgo(8, 13, 15),
  },
];

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export function buildDemoDashboard(days = 30): DashboardPayload {
  const since = new Date(NOW);
  since.setUTCDate(since.getUTCDate() - days);

  const inWindow = demoMovements.filter(
    (movement) => movement.occurred_at && new Date(movement.occurred_at) >= since,
  );

  const sumOf = (type: string) =>
    inWindow
      .filter((movement) => movement.type.value === type)
      .reduce((sum, movement) => sum + movement.quantity, 0);

  const countOf = (type: string) =>
    inWindow.filter((movement) => movement.type.value === type).length;

  // One point per day, with movements bucketed by date.
  const trend = Array.from({ length: days + 1 }, (_, offset) => {
    const date = new Date(since);
    date.setUTCDate(date.getUTCDate() + offset);
    const key = date.toISOString().slice(0, 10);

    const forDay = demoMovements.filter((movement) => movement.occurred_at?.startsWith(key));

    return {
      date: key,
      stock_in: forDay
        .filter((movement) => movement.type.value === 'stock_in')
        .reduce((sum, movement) => sum + movement.quantity, 0),
      stock_out: forDay
        .filter((movement) => movement.type.value === 'stock_out')
        .reduce((sum, movement) => sum + movement.quantity, 0),
    };
  });

  const lowStock = demoProducts.filter((product) => product.stock_status.value === 'low_stock');
  const outOfStock = demoProducts.filter((product) => product.stock_status.value === 'out_of_stock');

  return {
    kpis: {
      total_products: demoProducts.length,
      total_inventory_units: demoProducts.reduce((sum, product) => sum + product.quantity_on_hand, 0),
      low_stock_count: lowStock.length,
      out_of_stock_count: outOfStock.length,
      stock_in_units: sumOf('stock_in'),
      stock_out_units: sumOf('stock_out'),
      stock_in_movements: countOf('stock_in'),
      stock_out_movements: countOf('stock_out'),
      adjustment_movements: countOf('adjustment'),
      active_suppliers: demoSuppliers.filter((supplier) => supplier.is_active).length,
      categories_count: demoCategories.filter((category) => category.is_active).length,
    },
    movement_trend: trend,
    category_breakdown: demoCategories
      .map((category) => ({
        category: category.name,
        color: category.color,
        products: category.products_count ?? 0,
        units: Number(category.units_on_hand ?? 0),
      }))
      .sort((a, b) => b.units - a.units),
    top_movers: demoProducts
      .map((product) => ({
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        units_out: demoMovements
          .filter((movement) => movement.product?.id === product.id && movement.type.value === 'stock_out')
          .reduce((sum, movement) => sum + movement.quantity, 0),
      }))
      .sort((a, b) => b.units_out - a.units_out)
      .slice(0, 5),
    recent_stock_in: demoMovements.filter((movement) => movement.type.value === 'stock_in').slice(0, 6),
    recent_stock_out: demoMovements.filter((movement) => movement.type.value === 'stock_out').slice(0, 6),
    low_stock: lowStock.slice(0, 8),
    out_of_stock: outOfStock.slice(0, 8),
    recent_activity: demoAuditLog.slice(0, 8),
    recent_notifications: demoNotifications.slice(0, 5),
    period: { days, from: since.toISOString().slice(0, 10), to: NOW.toISOString().slice(0, 10) },
  };
}

/* -------------------------------------------------------------------------- */
/* Pagination helper                                                          */
/* -------------------------------------------------------------------------- */

/** Wrap an array in the same envelope the API returns, so screens see one shape. */
export function paginate<T>(
  items: T[],
  page = 1,
  perPage = 25,
  totals?: Record<string, number>,
): Paginated<T> {
  const lastPage = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(Math.max(1, page), lastPage);
  const start = (current - 1) * perPage;
  const slice = items.slice(start, start + perPage);

  return {
    data: slice,
    links: { first: null, last: null, prev: null, next: null },
    meta: {
      current_page: current,
      from: slice.length ? start + 1 : null,
      last_page: lastPage,
      path: '',
      per_page: perPage,
      to: slice.length ? start + slice.length : null,
      total: items.length,
      ...(totals ? { totals } : {}),
    },
  };
}
