/**
 * The data layer every screen calls.
 *
 * One function per operation, each of which either hits the Laravel API or —
 * when `NEXT_PUBLIC_DEMO_MODE=true` — serves the bundled demo data. The demo
 * branch is confined to this file so that turning it off changes nothing about
 * how any screen is written: the same function names, arguments and return types
 * apply either way.
 *
 * That is the point of this indirection. The UI was built before the database
 * existed, and connecting the real backend required no component changes.
 */

import { DEMO_MODE, api } from '@/lib/api-client';
import {
  buildDemoDashboard,
  demoAuditLog,
  demoBatches,
  demoBusiness,
  demoCategories,
  demoCurrentUser,
  demoLedger,
  demoMovements,
  demoNotifications,
  demoPriceHistory,
  demoPrices,
  demoProducts,
  demoSuppliers,
  demoUsers,
  paginate,
} from '@/mocks/demo-data';
import type {
  AdjustmentPayload,
  AppNotification,
  AuditLogEntry,
  AuthSession,
  AvailabilityPayload,
  Business,
  Category,
  DashboardPayload,
  FifoPreview,
  LedgerEntry,
  ListFilters,
  LoginPayload,
  MovementTypeKey,
  Paginated,
  Product,
  ProductPrice,
  ProductPriceHistoryEntry,
  RegisterPayload,
  RolesPayload,
  Single,
  StockBatch,
  StockInPayload,
  StockMovement,
  StockOutPayload,
  Supplier,
  User,
} from '@/types/api';

export { DEMO_MODE };

/** Simulated latency, so loading and skeleton states are visible in demo mode. */
const DEMO_LATENCY_MS = 260;

function delay<T>(value: T, ms = DEMO_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Case-insensitive match across a row's searchable fields. */
function matches(haystack: Array<string | null | undefined>, needle?: string): boolean {
  if (!needle) return true;

  const term = needle.trim().toLowerCase();

  return haystack.some((value) => value?.toLowerCase().includes(term));
}

function withinDates(value: string | null | undefined, from?: string, to?: string): boolean {
  if (!value) return !from && !to;

  const date = value.slice(0, 10);

  if (from && date < from) return false;
  if (to && date > to) return false;

  return true;
}

/* ========================================================================== */
/* Authentication                                                             */
/* ========================================================================== */

export const auth = {
  async login(payload: LoginPayload): Promise<AuthSession> {
    if (DEMO_MODE) {
      // Demo mode accepts any credentials — there is no backend to check them
      // against. It is gated behind an explicit environment flag for exactly
      // this reason, and must never be enabled in production.
      return delay({
        token: 'demo-token',
        user: demoCurrentUser,
        message: 'Signed in to the demo workspace.',
      });
    }

    return api.post<AuthSession>('/auth/login', payload, { anonymous: true });
  },

  async register(payload: RegisterPayload): Promise<AuthSession> {
    if (DEMO_MODE) {
      return delay({
        token: 'demo-token',
        user: { ...demoCurrentUser, name: payload.name, email: payload.email },
        message: 'Your demo workspace is ready.',
      });
    }

    return api.post<AuthSession>('/auth/register', payload, { anonymous: true });
  },

  async me(): Promise<{ user: User; unread_notifications: number }> {
    if (DEMO_MODE) {
      return delay({
        user: demoCurrentUser,
        unread_notifications: demoNotifications.filter((entry) => !entry.is_read).length,
      });
    }

    return api.get<{ user: User; unread_notifications: number }>('/auth/me');
  },

  async logout(): Promise<void> {
    if (DEMO_MODE) {
      await delay(null, 120);
      return;
    }

    await api.post('/auth/logout');
  },
};

/* ========================================================================== */
/* Dashboard                                                                  */
/* ========================================================================== */

export async function fetchDashboard(days = 30): Promise<DashboardPayload> {
  if (DEMO_MODE) return delay(buildDemoDashboard(days));

  const response = await api.get<Single<DashboardPayload>>('/dashboard', { query: { days } });

  return response.data;
}

/* ========================================================================== */
/* Products                                                                   */
/* ========================================================================== */

export async function fetchProducts(filters: ListFilters = {}): Promise<Paginated<Product>> {
  if (DEMO_MODE) {
    let rows = demoProducts.filter(
      (product) =>
        matches([product.name, product.sku, product.barcode, product.description], filters.search) &&
        (!filters.category_id || product.category?.id === filters.category_id) &&
        (!filters.supplier_id ||
          product.suppliers?.some((supplier) => supplier.id === filters.supplier_id)) &&
        (!filters.stock_status || product.stock_status.value === filters.stock_status) &&
        (filters.include_archived ? true : !product.is_archived),
    );

    rows = sortRows(rows, filters.sort ?? 'name', filters.direction ?? 'asc');

    return delay(
      paginate(rows, filters.page ?? 1, filters.per_page ?? 25, {
        products: rows.length,
        units: rows.reduce((sum, product) => sum + product.quantity_on_hand, 0),
        low_stock: rows.filter((product) => product.stock_status.value === 'low_stock').length,
        out_of_stock: rows.filter((product) => product.stock_status.value === 'out_of_stock').length,
      }),
    );
  }

  return api.get<Paginated<Product>>('/products', { query: filters as Record<string, unknown> });
}

export async function fetchProduct(id: number): Promise<Product> {
  if (DEMO_MODE) {
    const product = demoProducts.find((entry) => entry.id === id);
    if (!product) throw new Error('Product not found');

    return delay(product);
  }

  const response = await api.get<Single<Product>>(`/products/${id}`);

  return response.data;
}

export async function createProduct(payload: Record<string, unknown>): Promise<Product> {
  if (DEMO_MODE) return delay(demoProducts[0]);

  const response = await api.post<Single<Product>>('/products', payload);

  return response.data;
}

export async function updateProduct(id: number, payload: Record<string, unknown>): Promise<Product> {
  if (DEMO_MODE) return delay(demoProducts.find((entry) => entry.id === id) ?? demoProducts[0]);

  const response = await api.patch<Single<Product>>(`/products/${id}`, payload);

  return response.data;
}

export async function archiveProduct(id: number): Promise<void> {
  if (DEMO_MODE) {
    await delay(null);
    return;
  }

  await api.post(`/products/${id}/archive`);
}

export async function restoreProduct(id: number): Promise<void> {
  if (DEMO_MODE) {
    await delay(null);
    return;
  }

  await api.post(`/products/${id}/restore`);
}

export async function fetchProductLedger(
  id: number,
  filters: ListFilters = {},
): Promise<Paginated<LedgerEntry>> {
  if (DEMO_MODE) {
    const rows = demoLedger.filter((entry) => entry.product?.id === id);

    return delay(paginate(rows, filters.page ?? 1, filters.per_page ?? 25));
  }

  return api.get<Paginated<LedgerEntry>>(`/products/${id}/ledger`, {
    query: filters as Record<string, unknown>,
  });
}

export async function fetchProductMovements(
  id: number,
  filters: ListFilters = {},
): Promise<Paginated<StockMovement>> {
  if (DEMO_MODE) {
    const rows = demoMovements.filter(
      (movement) =>
        movement.product?.id === id && (!filters.type || movement.type.value === filters.type),
    );

    return delay(paginate(rows, filters.page ?? 1, filters.per_page ?? 25));
  }

  return api.get<Paginated<StockMovement>>(`/products/${id}/movements`, {
    query: filters as Record<string, unknown>,
  });
}

export async function fetchProductBatches(
  id: number,
  openOnly = false,
): Promise<Paginated<StockBatch>> {
  if (DEMO_MODE) {
    const rows = demoBatches.filter(
      (batch) => batch.product?.id === id && (!openOnly || batch.quantity_remaining > 0),
    );

    return delay(paginate(rows, 1, 50));
  }

  return api.get<Paginated<StockBatch>>(`/products/${id}/batches`, {
    query: { open_only: openOnly, per_page: 50 },
  });
}

/* ========================================================================== */
/* Categories                                                                 */
/* ========================================================================== */

export async function fetchCategories(filters: ListFilters = {}): Promise<Paginated<Category>> {
  if (DEMO_MODE) {
    const rows = demoCategories.filter((category) =>
      matches([category.name, category.description], filters.search),
    );

    return delay(paginate(rows, filters.page ?? 1, filters.per_page ?? 50));
  }

  return api.get<Paginated<Category>>('/categories', { query: filters as Record<string, unknown> });
}

export async function createCategory(payload: Record<string, unknown>): Promise<Category> {
  if (DEMO_MODE) return delay(demoCategories[0]);

  const response = await api.post<Single<Category>>('/categories', payload);

  return response.data;
}

export async function updateCategory(
  id: number,
  payload: Record<string, unknown>,
): Promise<Category> {
  if (DEMO_MODE) return delay(demoCategories.find((entry) => entry.id === id) ?? demoCategories[0]);

  const response = await api.patch<Single<Category>>(`/categories/${id}`, payload);

  return response.data;
}

export async function deleteCategory(id: number): Promise<void> {
  if (DEMO_MODE) {
    await delay(null);
    return;
  }

  await api.delete(`/categories/${id}`);
}

/* ========================================================================== */
/* Suppliers                                                                  */
/* ========================================================================== */

export async function fetchSuppliers(filters: ListFilters = {}): Promise<Paginated<Supplier>> {
  if (DEMO_MODE) {
    let rows = demoSuppliers.filter(
      (supplier) =>
        matches([supplier.name, supplier.code, supplier.contact_name, supplier.email], filters.search) &&
        (filters.include_inactive ? true : supplier.is_active),
    );

    rows = sortRows(rows, filters.sort ?? 'name', filters.direction ?? 'asc');

    return delay(paginate(rows, filters.page ?? 1, filters.per_page ?? 25));
  }

  return api.get<Paginated<Supplier>>('/suppliers', { query: filters as Record<string, unknown> });
}

export async function fetchSupplier(id: number): Promise<Supplier> {
  if (DEMO_MODE) {
    const supplier = demoSuppliers.find((entry) => entry.id === id);
    if (!supplier) throw new Error('Supplier not found');

    return delay({
      ...supplier,
      products: demoProducts
        .filter((product) => product.suppliers?.some((entry) => entry.id === id))
        .map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          category: product.category,
        })),
    });
  }

  const response = await api.get<Single<Supplier>>(`/suppliers/${id}`);

  return response.data;
}

export async function createSupplier(payload: Record<string, unknown>): Promise<Supplier> {
  if (DEMO_MODE) return delay(demoSuppliers[0]);

  const response = await api.post<Single<Supplier>>('/suppliers', payload);

  return response.data;
}

export async function updateSupplier(
  id: number,
  payload: Record<string, unknown>,
): Promise<Supplier> {
  if (DEMO_MODE) return delay(demoSuppliers.find((entry) => entry.id === id) ?? demoSuppliers[0]);

  const response = await api.patch<Single<Supplier>>(`/suppliers/${id}`, payload);

  return response.data;
}

export async function toggleSupplierActive(id: number): Promise<void> {
  if (DEMO_MODE) {
    await delay(null);
    return;
  }

  await api.post(`/suppliers/${id}/toggle-active`);
}

export async function fetchSupplierBatches(
  id: number,
  filters: ListFilters = {},
): Promise<Paginated<StockBatch>> {
  if (DEMO_MODE) {
    const rows = demoBatches.filter((batch) => batch.supplier?.id === id);

    return delay(paginate(rows, filters.page ?? 1, filters.per_page ?? 25));
  }

  return api.get<Paginated<StockBatch>>(`/suppliers/${id}/batches`, {
    query: filters as Record<string, unknown>,
  });
}

export async function fetchSupplierMovements(
  id: number,
  filters: ListFilters = {},
): Promise<Paginated<StockMovement>> {
  if (DEMO_MODE) {
    const rows = demoMovements.filter(
      (movement) =>
        movement.supplier?.id === id ||
        demoBatches.some(
          (batch) => batch.supplier?.id === id && batch.id === movement.batch?.id,
        ),
    );

    return delay(paginate(rows, filters.page ?? 1, filters.per_page ?? 25));
  }

  return api.get<Paginated<StockMovement>>(`/suppliers/${id}/movements`, {
    query: filters as Record<string, unknown>,
  });
}

/* ========================================================================== */
/* Inventory                                                                  */
/* ========================================================================== */

export async function fetchInventory(filters: ListFilters = {}): Promise<Paginated<Product>> {
  return fetchProducts(filters);
}

export async function fetchLedger(filters: ListFilters = {}): Promise<Paginated<LedgerEntry>> {
  if (DEMO_MODE) {
    const rows = demoLedger.filter(
      (entry) =>
        (!filters.product_id || entry.product?.id === filters.product_id) &&
        (!filters.supplier_id || entry.supplier?.id === filters.supplier_id) &&
        (!filters.type || entry.type.value === filters.type) &&
        withinDates(entry.occurred_at, filters.date_from, filters.date_to),
    );

    return delay(paginate(rows, filters.page ?? 1, filters.per_page ?? 25));
  }

  return api.get<Paginated<LedgerEntry>>('/inventory/ledger', {
    query: filters as Record<string, unknown>,
  });
}

export async function fetchMovements(
  filters: ListFilters = {},
  type?: MovementTypeKey,
): Promise<Paginated<StockMovement>> {
  if (DEMO_MODE) {
    const rows = demoMovements.filter(
      (movement) =>
        (!type || movement.type.value === type) &&
        (!filters.type || movement.type.value === filters.type) &&
        (!filters.product_id || movement.product?.id === filters.product_id) &&
        (!filters.supplier_id || movement.supplier?.id === filters.supplier_id) &&
        (!filters.category_id || productCategoryId(movement.product?.id) === filters.category_id) &&
        withinDates(movement.occurred_at, filters.date_from, filters.date_to) &&
        matches(
          [movement.reference, movement.notes, movement.product?.name, movement.product?.sku],
          filters.search,
        ),
    );

    return delay(
      paginate(rows, filters.page ?? 1, filters.per_page ?? 25, {
        movements: rows.length,
        units: rows.reduce((sum, movement) => sum + movement.quantity, 0),
        products: new Set(rows.map((movement) => movement.product?.id)).size,
      }),
    );
  }

  const path = type === 'stock_in' ? '/stock-in' : type === 'stock_out' ? '/stock-out' : '/inventory/movements';

  return api.get<Paginated<StockMovement>>(path, { query: filters as Record<string, unknown> });
}

export async function fetchBatches(filters: ListFilters = {}): Promise<Paginated<StockBatch>> {
  if (DEMO_MODE) {
    const rows = demoBatches.filter(
      (batch) =>
        (!filters.product_id || batch.product?.id === filters.product_id) &&
        (!filters.supplier_id || batch.supplier?.id === filters.supplier_id) &&
        (filters.include_depleted ? true : batch.quantity_remaining > 0),
    );

    return delay(paginate(rows, filters.page ?? 1, filters.per_page ?? 25));
  }

  return api.get<Paginated<StockBatch>>('/inventory/batches', {
    query: filters as Record<string, unknown>,
  });
}

export async function fetchAvailability(productId: number): Promise<AvailabilityPayload> {
  if (DEMO_MODE) {
    const product = demoProducts.find((entry) => entry.id === productId);

    return delay(
      {
        product_id: productId,
        sku: product?.sku ?? '',
        quantity_on_hand: product?.quantity_on_hand ?? 0,
        available: product?.quantity_on_hand ?? 0,
        minimum_stock_level: product?.minimum_stock_level ?? 0,
        stock_status: product?.stock_status.value ?? 'out_of_stock',
      },
      120,
    );
  }

  const response = await api.get<Single<AvailabilityPayload>>(
    `/inventory/products/${productId}/availability`,
  );

  return response.data;
}

export async function recordStockIn(payload: StockInPayload): Promise<StockMovement> {
  if (DEMO_MODE) {
    return delay(demoMovements.find((movement) => movement.type.value === 'stock_in')!);
  }

  const response = await api.post<Single<StockMovement>>('/stock-in', payload);

  return response.data;
}

export async function recordStockOut(payload: StockOutPayload): Promise<StockMovement> {
  if (DEMO_MODE) {
    return delay(demoMovements.find((movement) => movement.type.value === 'stock_out')!);
  }

  const response = await api.post<Single<StockMovement>>('/stock-out', payload);

  return response.data;
}

export async function recordAdjustment(payload: AdjustmentPayload): Promise<StockMovement> {
  if (DEMO_MODE) {
    return delay(demoMovements[0]);
  }

  const response = await api.post<Single<StockMovement>>('/inventory/adjustments', payload);

  return response.data;
}

/**
 * What a withdrawal would consume, without writing anything.
 *
 * In demo mode this walks the batches the same way the backend does, so the FIFO
 * preview panel shows a real allocation rather than a fabricated one.
 */
export async function previewStockOut(productId: number, quantity: number): Promise<FifoPreview> {
  if (DEMO_MODE) {
    const open = demoBatches
      .filter((batch) => batch.product?.id === productId && batch.quantity_remaining > 0)
      .sort((a, b) => (a.received_at ?? '').localeCompare(b.received_at ?? ''));

    const available = open.reduce((sum, batch) => sum + batch.quantity_remaining, 0);
    let outstanding = Math.max(0, quantity);
    const allocations: FifoPreview['allocations'] = [];

    for (const batch of open) {
      if (outstanding <= 0) break;

      const take = Math.min(batch.quantity_remaining, outstanding);
      outstanding -= take;

      allocations.push({
        batch_id: batch.id,
        batch_number: batch.batch_number,
        received_at: batch.received_at ?? '',
        supplier: batch.supplier?.name ?? null,
        quantity_remaining: batch.quantity_remaining,
        quantity_taken: take,
        depletes_batch: take === batch.quantity_remaining,
      });
    }

    return delay({ available, sufficient: quantity <= available, allocations }, 150);
  }

  const response = await api.get<Single<FifoPreview>>('/stock-out/preview', {
    query: { product_id: productId, quantity },
  });

  return response.data;
}

/* ========================================================================== */
/* Price catalogue                                                            */
/* ========================================================================== */

export async function fetchPrices(filters: ListFilters = {}): Promise<Paginated<ProductPrice>> {
  if (DEMO_MODE) {
    const rows = demoPrices.filter(
      (price) =>
        matches([price.product?.name, price.product?.sku], filters.search) &&
        (!filters.category_id || price.product?.category?.id === filters.category_id),
    );

    return delay(paginate(rows, filters.page ?? 1, filters.per_page ?? 25));
  }

  return api.get<Paginated<ProductPrice>>('/price-catalog', {
    query: filters as Record<string, unknown>,
  });
}

export async function fetchPriceHistory(
  productId: number,
): Promise<Paginated<ProductPriceHistoryEntry>> {
  if (DEMO_MODE) {
    const rows = demoPriceHistory
      .filter((entry) => entry.product?.id === productId)
      .sort((a, b) => (b.effective_from ?? '').localeCompare(a.effective_from ?? ''));

    return delay(paginate(rows, 1, 50));
  }

  return api.get<Paginated<ProductPriceHistoryEntry>>(
    `/price-catalog/products/${productId}/history`,
    { query: { per_page: 50 } },
  );
}

export async function savePrice(payload: Record<string, unknown>): Promise<ProductPrice> {
  if (DEMO_MODE) return delay(demoPrices[0]);

  const response = await api.post<Single<ProductPrice>>('/price-catalog', payload);

  return response.data;
}

export async function deletePrice(id: number): Promise<void> {
  if (DEMO_MODE) {
    await delay(null);
    return;
  }

  await api.delete(`/price-catalog/${id}`);
}

/* ========================================================================== */
/* Reports                                                                    */
/* ========================================================================== */

export async function fetchReport(
  slug: string,
  filters: ListFilters = {},
): Promise<Paginated<unknown>> {
  if (DEMO_MODE) {
    switch (slug) {
      case 'stock-in':
        return fetchMovements(filters, 'stock_in');
      case 'stock-out':
        return fetchMovements(filters, 'stock_out');
      case 'product-movement':
        return fetchMovements(filters);
      case 'ledger':
        return fetchLedger(filters);
      case 'low-stock':
        return fetchProducts({ ...filters, stock_status: 'low_stock' });
      case 'out-of-stock':
        return fetchProducts({ ...filters, stock_status: 'out_of_stock' });
      case 'suppliers':
        return fetchSuppliers({ ...filters, include_inactive: true });
      case 'price-history': {
        const rows = demoPriceHistory.filter(
          (entry) =>
            matches([entry.product?.name, entry.product?.sku], filters.search) &&
            (!filters.product_id || entry.product?.id === filters.product_id),
        );

        return delay(paginate(rows, filters.page ?? 1, filters.per_page ?? 25));
      }
      case 'inventory-summary':
      default:
        return fetchProducts(filters);
    }
  }

  return api.get<Paginated<unknown>>(`/reports/${slug}`, {
    query: filters as Record<string, unknown>,
  });
}

/**
 * Trigger a CSV download.
 *
 * Demo mode builds the file in the browser from the demo rows, so the export
 * button is genuinely testable without a backend.
 */
export async function exportReport(slug: string, filters: ListFilters = {}): Promise<void> {
  if (DEMO_MODE) {
    const page = await fetchReport(slug, { ...filters, per_page: 200, page: 1 });
    const csv = toCsv(page.data as Array<Record<string, unknown>>);

    triggerDownload(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      `fastsold-${slug}-demo.csv`,
    );

    return;
  }

  const { blob, filename } = await api.download(
    `/reports/${slug}/export`,
    filters as Record<string, unknown>,
  );

  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();

  // Revoke on the next tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Flatten rows into CSV, quoting anything that needs it. */
function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';

  const flatten = (row: Record<string, unknown>, prefix = ''): Record<string, string> =>
    Object.entries(row).reduce<Record<string, string>>((flat, [key, value]) => {
      const name = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flat, flatten(value as Record<string, unknown>, name));
      } else if (!Array.isArray(value)) {
        flat[name] = value === null || value === undefined ? '' : String(value);
      }

      return flat;
    }, {});

  const flatRows = rows.map((row) => flatten(row));
  const columns = [...new Set(flatRows.flatMap((row) => Object.keys(row)))];

  const escape = (value: string) =>
    /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

  return [
    columns.map(escape).join(','),
    ...flatRows.map((row) => columns.map((column) => escape(row[column] ?? '')).join(',')),
  ].join('\n');
}

/* ========================================================================== */
/* Notifications                                                              */
/* ========================================================================== */

export async function fetchNotifications(
  filters: { type?: string; unread_only?: boolean; page?: number; per_page?: number } = {},
): Promise<Paginated<AppNotification> & { meta: { unread_count?: number } }> {
  if (DEMO_MODE) {
    const rows = demoNotifications.filter(
      (entry) =>
        (!filters.type || entry.type.value === filters.type) &&
        (!filters.unread_only || !entry.is_read),
    );

    const page = paginate(rows, filters.page ?? 1, filters.per_page ?? 25);

    return delay({
      ...page,
      meta: {
        ...page.meta,
        unread_count: demoNotifications.filter((entry) => !entry.is_read).length,
      },
    });
  }

  return api.get<Paginated<AppNotification> & { meta: { unread_count?: number } }>(
    '/notifications',
    { query: filters as Record<string, unknown> },
  );
}

export async function fetchUnreadCount(): Promise<number> {
  if (DEMO_MODE) {
    return delay(demoNotifications.filter((entry) => !entry.is_read).length, 80);
  }

  const response = await api.get<Single<{ unread_count: number }>>('/notifications/unread-count');

  return response.data.unread_count;
}

export async function markNotificationRead(id: number): Promise<void> {
  if (DEMO_MODE) {
    const entry = demoNotifications.find((notification) => notification.id === id);
    if (entry) entry.is_read = true;
    await delay(null, 100);
    return;
  }

  await api.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  if (DEMO_MODE) {
    demoNotifications.forEach((entry) => {
      entry.is_read = true;
    });
    await delay(null, 150);
    return;
  }

  await api.post('/notifications/read-all');
}

/* ========================================================================== */
/* Audit log                                                                  */
/* ========================================================================== */

export async function fetchAuditLog(
  filters: {
    search?: string;
    action?: string;
    category?: string;
    user_id?: number;
    date_from?: string;
    date_to?: string;
    page?: number;
    per_page?: number;
  } = {},
): Promise<Paginated<AuditLogEntry>> {
  if (DEMO_MODE) {
    const rows = demoAuditLog.filter(
      (entry) =>
        matches([entry.description, entry.user.name, entry.action.value], filters.search) &&
        (!filters.category || entry.category === filters.category) &&
        (!filters.action || entry.action.value === filters.action) &&
        (!filters.user_id || entry.user.id === filters.user_id) &&
        withinDates(entry.created_at, filters.date_from, filters.date_to),
    );

    return delay(paginate(rows, filters.page ?? 1, filters.per_page ?? 30));
  }

  return api.get<Paginated<AuditLogEntry>>('/audit-logs', {
    query: filters as Record<string, unknown>,
  });
}

/* ========================================================================== */
/* Users and settings                                                         */
/* ========================================================================== */

export async function fetchUsers(
  filters: { search?: string; role?: string; is_active?: boolean; page?: number } = {},
): Promise<Paginated<User>> {
  if (DEMO_MODE) {
    const rows = demoUsers.filter(
      (user) =>
        matches([user.name, user.email, user.job_title], filters.search) &&
        (!filters.role || user.role.value === filters.role),
    );

    return delay(paginate(rows, filters.page ?? 1, 25));
  }

  return api.get<Paginated<User>>('/users', { query: filters as Record<string, unknown> });
}

export async function createUser(payload: Record<string, unknown>): Promise<User> {
  if (DEMO_MODE) return delay(demoUsers[2]);

  const response = await api.post<Single<User>>('/users', payload);

  return response.data;
}

export async function updateUser(id: number, payload: Record<string, unknown>): Promise<User> {
  if (DEMO_MODE) return delay(demoUsers.find((user) => user.id === id) ?? demoUsers[0]);

  const response = await api.patch<Single<User>>(`/users/${id}`, payload);

  return response.data;
}

export async function deleteUser(id: number): Promise<void> {
  if (DEMO_MODE) {
    await delay(null);
    return;
  }

  await api.delete(`/users/${id}`);
}

export async function fetchBusiness(): Promise<Business> {
  if (DEMO_MODE) return delay(demoBusiness);

  const response = await api.get<Single<Business>>('/settings/business');

  return response.data;
}

export async function updateBusiness(payload: Record<string, unknown>): Promise<Business> {
  if (DEMO_MODE) return delay({ ...demoBusiness, ...(payload as Partial<Business>) });

  const response = await api.patch<Single<Business>>('/settings/business', payload);

  return response.data;
}

export async function updateProfile(payload: Record<string, unknown>): Promise<User> {
  if (DEMO_MODE) return delay({ ...demoCurrentUser, ...(payload as Partial<User>) });

  const response = await api.patch<Single<User>>('/settings/profile', payload);

  return response.data;
}

export async function updatePassword(payload: {
  current_password: string;
  password: string;
  password_confirmation: string;
}): Promise<void> {
  if (DEMO_MODE) {
    await delay(null, 400);
    return;
  }

  await api.put('/settings/password', payload);
}

export async function fetchRoles(): Promise<RolesPayload> {
  if (DEMO_MODE) {
    return delay({
      roles: [
        {
          key: 'owner',
          label: 'Owner',
          description:
            'Full access to the business, including users, billing details, settings and audit history.',
          is_editable: false,
          permissions: demoCurrentUser.permissions ?? [],
        },
        {
          key: 'manager',
          label: 'Manager',
          description:
            'Runs day-to-day operations: products, suppliers, stock movements and reports.',
          is_editable: true,
          permissions: [
            'dashboard.view',
            'products.view',
            'products.manage',
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
            'users.view',
          ],
        },
        {
          key: 'staff',
          label: 'Staff',
          description: 'Records stock movements and views inventory. No administrative access.',
          is_editable: true,
          permissions: [
            'dashboard.view',
            'products.view',
            'categories.view',
            'suppliers.view',
            'inventory.view',
            'inventory.stock-in',
            'inventory.stock-out',
            'notifications.view',
          ],
        },
      ],
      catalogue: DEMO_PERMISSION_CATALOGUE,
    });
  }

  const response = await api.get<Single<RolesPayload>>('/settings/roles');

  return response.data;
}

export async function updateRolePermissions(role: string, permissions: string[]): Promise<void> {
  if (DEMO_MODE) {
    await delay(null, 350);
    return;
  }

  await api.put(`/settings/roles/${role}`, { permissions });
}

/* ========================================================================== */
/* Helpers                                                                    */
/* ========================================================================== */

function productCategoryId(productId: number | undefined): number | undefined {
  return demoProducts.find((product) => product.id === productId)?.category?.id;
}

/** Generic client-side sort for demo mode. */
function sortRows<T extends object>(rows: T[], key: string, direction: 'asc' | 'desc'): T[] {
  const multiplier = direction === 'desc' ? -1 : 1;
  const read = (row: T): unknown => (row as Record<string, unknown>)[key];

  return [...rows].sort((a, b) => {
    const left = read(a);
    const right = read(b);

    if (typeof left === 'number' && typeof right === 'number') {
      return (left - right) * multiplier;
    }

    return String(left ?? '').localeCompare(String(right ?? '')) * multiplier;
  });
}

const DEMO_PERMISSION_CATALOGUE: RolesPayload['catalogue'] = [
  {
    group: 'Dashboard',
    permissions: [{ key: 'dashboard.view', label: 'View dashboard', owner_only: false }],
  },
  {
    group: 'Products',
    permissions: [
      { key: 'products.view', label: 'View products', owner_only: false },
      { key: 'products.manage', label: 'Create and edit products', owner_only: false },
      { key: 'products.delete', label: 'Archive and delete products', owner_only: false },
    ],
  },
  {
    group: 'Categories',
    permissions: [
      { key: 'categories.view', label: 'View categories', owner_only: false },
      { key: 'categories.manage', label: 'Manage categories', owner_only: false },
    ],
  },
  {
    group: 'Suppliers',
    permissions: [
      { key: 'suppliers.view', label: 'View suppliers', owner_only: false },
      { key: 'suppliers.manage', label: 'Manage suppliers', owner_only: false },
    ],
  },
  {
    group: 'Inventory',
    permissions: [
      { key: 'inventory.view', label: 'View inventory and ledger', owner_only: false },
      { key: 'inventory.stock-in', label: 'Record stock in', owner_only: false },
      { key: 'inventory.stock-out', label: 'Record stock out', owner_only: false },
      { key: 'inventory.adjust', label: 'Adjust inventory', owner_only: false },
    ],
  },
  {
    group: 'Reports',
    permissions: [
      { key: 'reports.view', label: 'View reports', owner_only: false },
      { key: 'reports.export', label: 'Export reports', owner_only: false },
    ],
  },
  {
    group: 'Price catalogue',
    permissions: [
      { key: 'prices.view', label: 'View price catalogue', owner_only: false },
      { key: 'prices.manage', label: 'Manage price catalogue', owner_only: false },
    ],
  },
  {
    group: 'Notifications',
    permissions: [{ key: 'notifications.view', label: 'View notifications', owner_only: false }],
  },
  {
    group: 'Audit',
    permissions: [{ key: 'audit-logs.view', label: 'View audit logs', owner_only: true }],
  },
  {
    group: 'Users',
    permissions: [
      { key: 'users.view', label: 'View users', owner_only: false },
      { key: 'users.manage', label: 'Manage users and roles', owner_only: true },
    ],
  },
  {
    group: 'Settings',
    permissions: [
      { key: 'settings.view', label: 'View settings', owner_only: false },
      { key: 'settings.manage', label: 'Manage business settings', owner_only: true },
      { key: 'roles.manage', label: 'Manage roles and permissions', owner_only: true },
    ],
  },
];

export { demoCategories as demoCategoryOptions, demoProducts as demoProductOptions, demoSuppliers as demoSupplierOptions };
