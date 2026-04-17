import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

function parseJsonField(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapOrder(row) {
  if (!row) {
    return null;
  }

  return {
    orderId: row.order_id,
    slug: row.slug,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    packKey: row.pack_key,
    packPrice: row.pack_price,
    currency: row.currency,
    profile: parseJsonField(row.profile_json, {}),
    customization: parseJsonField(row.customization_json, {}),
    orderContact: parseJsonField(row.order_contact_json, {}),
    assets: parseJsonField(row.assets_json, {}),
    packageSelection: parseJsonField(row.package_json, {}),
    finalCardUrl: row.final_card_url,
    orderStatus: row.order_status,
    paymentProvider: row.payment_provider,
    paymentStatus: row.payment_status,
    paymentReference: row.payment_reference,
    paymentUrl: row.payment_url,
    paymentPayload: parseJsonField(row.payment_payload_json, {}),
    adminNotes: row.admin_notes,
    deliveryNotes: row.delivery_notes,
    couponCode: row.coupon_code ?? null,
    discountAmount: row.discount_amount ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createDatabase({ databasePath }) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const database = new Database(databasePath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  database.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      pack_key TEXT NOT NULL,
      pack_price INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'XOF',
      profile_json TEXT NOT NULL,
      customization_json TEXT NOT NULL,
      order_contact_json TEXT NOT NULL,
      assets_json TEXT NOT NULL,
      package_json TEXT NOT NULL,
      final_card_url TEXT NOT NULL,
      order_status TEXT NOT NULL DEFAULT 'submitted',
      payment_provider TEXT NOT NULL DEFAULT 'cinetpay',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      payment_reference TEXT,
      payment_url TEXT,
      payment_payload_json TEXT,
      admin_notes TEXT NOT NULL DEFAULT '',
      delivery_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
    CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);

    CREATE TABLE IF NOT EXISTS inventory (
      item_type TEXT NOT NULL,
      item_key  TEXT NOT NULL,
      in_stock  INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (item_type, item_key)
    );

    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      discount_type TEXT NOT NULL DEFAULT 'percent',
      discount_value INTEGER NOT NULL,
      max_uses INTEGER NOT NULL DEFAULT 0,
      used_count INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ceremonies (
      id TEXT PRIMARY KEY,
      contact_name TEXT NOT NULL,
      contact_email TEXT NOT NULL DEFAULT '',
      contact_phone TEXT NOT NULL,
      company TEXT NOT NULL DEFAULT '',
      event_type TEXT NOT NULL,
      event_name TEXT NOT NULL DEFAULT '',
      event_date TEXT NOT NULL DEFAULT '',
      event_city TEXT NOT NULL DEFAULT '',
      guest_count TEXT NOT NULL DEFAULT '',
      services_json TEXT NOT NULL DEFAULT '[]',
      custom_design TEXT NOT NULL DEFAULT '',
      budget TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'nouveau',
      admin_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Migrate existing orders table to add coupon columns if needed
  const orderCols = database.prepare("PRAGMA table_info(orders)").all().map(c => c.name);
  if (!orderCols.includes('coupon_code')) {
    database.exec("ALTER TABLE orders ADD COLUMN coupon_code TEXT");
  }
  if (!orderCols.includes('discount_amount')) {
    database.exec("ALTER TABLE orders ADD COLUMN discount_amount INTEGER NOT NULL DEFAULT 0");
  }

  const insertOrder = database.prepare(`
    INSERT INTO orders (
      order_id,
      slug,
      customer_name,
      customer_email,
      customer_phone,
      pack_key,
      pack_price,
      currency,
      profile_json,
      customization_json,
      order_contact_json,
      assets_json,
      package_json,
      final_card_url,
      order_status,
      payment_provider,
      payment_status,
      payment_reference,
      payment_url,
      payment_payload_json,
      admin_notes,
      delivery_notes,
      coupon_code,
      discount_amount,
      created_at,
      updated_at
    ) VALUES (
      @order_id,
      @slug,
      @customer_name,
      @customer_email,
      @customer_phone,
      @pack_key,
      @pack_price,
      @currency,
      @profile_json,
      @customization_json,
      @order_contact_json,
      @assets_json,
      @package_json,
      @final_card_url,
      @order_status,
      @payment_provider,
      @payment_status,
      @payment_reference,
      @payment_url,
      @payment_payload_json,
      @admin_notes,
      @delivery_notes,
      @coupon_code,
      @discount_amount,
      @created_at,
      @updated_at
    )
  `);

  const selectOrderById = database.prepare('SELECT * FROM orders WHERE order_id = ?');
  const selectOrderBySlug = database.prepare('SELECT * FROM orders WHERE slug = ?');
  const selectAllOrders = database.prepare('SELECT * FROM orders ORDER BY datetime(created_at) DESC');
  const selectSlug = database.prepare('SELECT slug FROM orders WHERE slug = ?');

  const selectInventory = database.prepare('SELECT * FROM inventory');
  const upsertInventoryItem = database.prepare(`
    INSERT INTO inventory (item_type, item_key, in_stock, updated_at)
    VALUES (@item_type, @item_key, @in_stock, @updated_at)
    ON CONFLICT (item_type, item_key) DO UPDATE SET
      in_stock = @in_stock,
      updated_at = @updated_at
  `);

  const updatePayment = database.prepare(`
    UPDATE orders
    SET payment_status = @payment_status,
        payment_reference = @payment_reference,
        payment_url = @payment_url,
        payment_payload_json = @payment_payload_json,
        updated_at = @updated_at
    WHERE order_id = @order_id
  `);

  const updatePaymentByReference = database.prepare(`
    UPDATE orders
    SET payment_status = @payment_status,
        payment_payload_json = @payment_payload_json,
        updated_at = @updated_at
    WHERE payment_reference = @payment_reference
  `);

  const updateAdminOrder = database.prepare(`
    UPDATE orders
    SET order_status = @order_status,
        payment_status = @payment_status,
        admin_notes = @admin_notes,
        delivery_notes = @delivery_notes,
        updated_at = @updated_at
    WHERE order_id = @order_id
  `);

  const updateOrderCoupon = database.prepare(`
    UPDATE orders
    SET coupon_code = @coupon_code,
        discount_amount = @discount_amount,
        updated_at = @updated_at
    WHERE order_id = @order_id
  `);

  function ensureUniqueSlug(desiredSlug) {
    const baseSlug = desiredSlug || `card-${Date.now()}`;
    let candidate = baseSlug;
    let counter = 2;

    while (selectSlug.get(candidate)) {
      candidate = `${baseSlug}-${counter}`;
      counter += 1;
    }

    return candidate;
  }

  return {
    ensureUniqueSlug,

    createOrder(order) {
      insertOrder.run({
        order_id: order.orderId,
        slug: order.slug,
        customer_name: order.customerName,
        customer_email: order.customerEmail,
        customer_phone: order.customerPhone,
        pack_key: order.packKey,
        pack_price: order.packPrice,
        currency: order.currency,
        profile_json: JSON.stringify(order.profile),
        customization_json: JSON.stringify(order.customization),
        order_contact_json: JSON.stringify(order.orderContact),
        assets_json: JSON.stringify(order.assets),
        package_json: JSON.stringify(order.packageSelection),
        final_card_url: order.finalCardUrl,
        order_status: order.orderStatus,
        payment_provider: order.paymentProvider,
        payment_status: order.paymentStatus,
        payment_reference: order.paymentReference ?? null,
        payment_url: order.paymentUrl ?? null,
        payment_payload_json: order.paymentPayload ? JSON.stringify(order.paymentPayload) : null,
        admin_notes: order.adminNotes ?? '',
        delivery_notes: order.deliveryNotes ?? '',
        coupon_code: order.couponCode ?? null,
        discount_amount: order.discountAmount ?? 0,
        created_at: order.createdAt,
        updated_at: order.updatedAt,
      });

      return mapOrder(selectOrderById.get(order.orderId));
    },

    getOrderById(orderId) {
      return mapOrder(selectOrderById.get(orderId));
    },

    getOrderBySlug(slug) {
      return mapOrder(selectOrderBySlug.get(slug));
    },

    listOrders() {
      return selectAllOrders.all().map(mapOrder);
    },

    // Return unpaid orders older than `maxAgeMs` for cleanup.
    // Only purge orders where checkout was never initiated (payment_reference IS NULL).
    // Orders that started checkout (have a Wave/CinetPay reference) are kept — the user
    // may still complete payment and the webhook will update the status.
    listExpiredUnpaidOrders(maxAgeMs = 30 * 60 * 1000) {
      const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
      return database
        .prepare("SELECT * FROM orders WHERE payment_status = 'pending' AND payment_reference IS NULL AND created_at < ?")
        .all(cutoff)
        .map(mapOrder);
    },

    deleteOrder(orderId) {
      database.prepare('DELETE FROM orders WHERE order_id = ?').run(orderId);
    },

    updatePayment({ orderId, paymentStatus, paymentReference, paymentUrl, paymentPayload }) {
      updatePayment.run({
        order_id: orderId,
        payment_status: paymentStatus,
        payment_reference: paymentReference ?? null,
        payment_url: paymentUrl ?? null,
        payment_payload_json: paymentPayload ? JSON.stringify(paymentPayload) : null,
        updated_at: new Date().toISOString(),
      });

      return mapOrder(selectOrderById.get(orderId));
    },

    updatePaymentByReference({ paymentReference, paymentStatus, paymentPayload }) {
      updatePaymentByReference.run({
        payment_reference: paymentReference,
        payment_status: paymentStatus,
        payment_payload_json: paymentPayload ? JSON.stringify(paymentPayload) : null,
        updated_at: new Date().toISOString(),
      });

      const row = database.prepare('SELECT * FROM orders WHERE payment_reference = ?').get(paymentReference);
      return mapOrder(row);
    },

    updateAdminOrder({ orderId, orderStatus, paymentStatus, adminNotes, deliveryNotes }) {
      updateAdminOrder.run({
        order_id: orderId,
        order_status: orderStatus,
        payment_status: paymentStatus,
        admin_notes: adminNotes,
        delivery_notes: deliveryNotes,
        updated_at: new Date().toISOString(),
      });

      return mapOrder(selectOrderById.get(orderId));
    },

    updateOrderCoupon({ orderId, couponCode, discountAmount }) {
      updateOrderCoupon.run({
        order_id: orderId,
        coupon_code: couponCode ?? null,
        discount_amount: discountAmount ?? 0,
        updated_at: new Date().toISOString(),
      });

      return mapOrder(selectOrderById.get(orderId));
    },

    updateOrderAssets({ orderId, assets }) {
      database.prepare('UPDATE orders SET assets_json=?, updated_at=? WHERE order_id=?')
        .run(JSON.stringify(assets), new Date().toISOString(), orderId);
      return mapOrder(selectOrderById.get(orderId));
    },

    getInventory() {
      const rows = selectInventory.all();
      return Object.fromEntries(
        rows.map((row) => [
          `${row.item_type}:${row.item_key}`,
          { itemType: row.item_type, itemKey: row.item_key, inStock: Boolean(row.in_stock) },
        ]),
      );
    },

    setInventoryItem({ itemType, itemKey, inStock }) {
      upsertInventoryItem.run({
        item_type: itemType,
        item_key: itemKey,
        in_stock: inStock ? 1 : 0,
        updated_at: new Date().toISOString(),
      });
    },

    // ── COUPONS ─────────────────────────────────────────────
    listCoupons() {
      return database.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all().map(r => ({
        code: r.code, discountType: r.discount_type, discountValue: r.discount_value,
        maxUses: r.max_uses, usedCount: r.used_count, active: Boolean(r.active), createdAt: r.created_at,
      }));
    },

    getCoupon(code) {
      const r = database.prepare('SELECT * FROM coupons WHERE code = ?').get(code.toUpperCase());
      if (!r) return null;
      return { code: r.code, discountType: r.discount_type, discountValue: r.discount_value,
        maxUses: r.max_uses, usedCount: r.used_count, active: Boolean(r.active), createdAt: r.created_at };
    },

    createCoupon({ code, discountType, discountValue, maxUses }) {
      database.prepare(`
        INSERT INTO coupons (code, discount_type, discount_value, max_uses, used_count, active, created_at)
        VALUES (?, ?, ?, ?, 0, 1, ?)
      `).run(code.toUpperCase(), discountType, discountValue, maxUses ?? 0, new Date().toISOString());
      return this.getCoupon(code);
    },

    deleteCoupon(code) {
      database.prepare('DELETE FROM coupons WHERE code = ?').run(code.toUpperCase());
    },

    useCoupon(code) {
      database.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?').run(code.toUpperCase());
    },

    // ── CEREMONIES ──────────────────────────────────────────
    createCeremony(data) {
      const now = new Date().toISOString();
      database.prepare(`
        INSERT INTO ceremonies (id, contact_name, contact_email, contact_phone, company, event_type, event_name, event_date, event_city, guest_count, services_json, custom_design, budget, notes, status, admin_notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nouveau', '', ?, ?)
      `).run(
        data.id, data.contactName, data.contactEmail ?? '', data.contactPhone,
        data.company ?? '', data.eventType, data.eventName ?? '', data.eventDate ?? '',
        data.eventCity ?? '', String(data.guestCount ?? ''), JSON.stringify(data.services ?? []),
        data.customDesign ?? '', data.budget ?? '', data.notes ?? '', now, now,
      );
      return this.getCeremonyById(data.id);
    },

    getCeremonyById(id) {
      const r = database.prepare('SELECT * FROM ceremonies WHERE id = ?').get(id);
      if (!r) return null;
      return {
        id: r.id, contactName: r.contact_name, contactEmail: r.contact_email,
        contactPhone: r.contact_phone, company: r.company, eventType: r.event_type,
        eventName: r.event_name, eventDate: r.event_date, eventCity: r.event_city,
        guestCount: r.guest_count, services: parseJsonField(r.services_json, []),
        customDesign: r.custom_design, budget: r.budget, notes: r.notes,
        status: r.status, adminNotes: r.admin_notes,
        createdAt: r.created_at, updatedAt: r.updated_at,
      };
    },

    listCeremonies() {
      return database.prepare('SELECT * FROM ceremonies ORDER BY datetime(created_at) DESC').all().map((r) => ({
        id: r.id, contactName: r.contact_name, contactEmail: r.contact_email,
        contactPhone: r.contact_phone, company: r.company, eventType: r.event_type,
        eventName: r.event_name, eventDate: r.event_date, eventCity: r.event_city,
        guestCount: r.guest_count, services: parseJsonField(r.services_json, []),
        customDesign: r.custom_design, budget: r.budget, notes: r.notes,
        status: r.status, adminNotes: r.admin_notes,
        createdAt: r.created_at, updatedAt: r.updated_at,
      }));
    },

    updateCeremony({ id, status, adminNotes }) {
      database.prepare(`
        UPDATE ceremonies SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?
      `).run(status, adminNotes ?? '', new Date().toISOString(), id);
      return this.getCeremonyById(id);
    },
  };
}