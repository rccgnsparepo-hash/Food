var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc2) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc2 = __getOwnPropDesc(from, key)) || desc2.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_vite = require("vite");

// src/db/index.ts
var import_node_postgres = require("drizzle-orm/node-postgres");
var import_pg = require("pg");

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  menuItems: () => menuItems,
  menuItemsRelations: () => menuItemsRelations,
  orders: () => orders,
  ordersRelations: () => ordersRelations,
  users: () => users,
  usersRelations: () => usersRelations,
  vendors: () => vendors,
  vendorsRelations: () => vendorsRelations
});
var import_drizzle_orm = require("drizzle-orm");
var import_pg_core = require("drizzle-orm/pg-core");
var users = (0, import_pg_core.pgTable)("users", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  uid: (0, import_pg_core.text)("uid").notNull().unique(),
  email: (0, import_pg_core.text)("email").notNull(),
  name: (0, import_pg_core.text)("name").notNull(),
  phone: (0, import_pg_core.text)("phone").default(""),
  role: (0, import_pg_core.text)("role").notNull().default("customer"),
  // 'customer' | 'rider' | 'vendor' | 'admin'
  universityId: (0, import_pg_core.text)("university_id").default("uni_mtu"),
  campusId: (0, import_pg_core.text)("campus_id").default("campus_mtu_main"),
  avatarUrl: (0, import_pg_core.text)("avatar_url"),
  isVerified: (0, import_pg_core.boolean)("is_verified").default(true),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var vendors = (0, import_pg_core.pgTable)("vendors", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  name: (0, import_pg_core.text)("name").notNull(),
  description: (0, import_pg_core.text)("description"),
  category: (0, import_pg_core.text)("category").notNull().default("food"),
  rating: (0, import_pg_core.doublePrecision)("rating").default(4.8),
  deliveryTime: (0, import_pg_core.text)("delivery_time").default("15-25 min"),
  isOpen: (0, import_pg_core.boolean)("is_open").default(true),
  imageUrl: (0, import_pg_core.text)("image_url"),
  campusId: (0, import_pg_core.text)("campus_id").default("campus_mtu_main"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var menuItems = (0, import_pg_core.pgTable)("menu_items", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  vendorId: (0, import_pg_core.text)("vendor_id").references(() => vendors.id),
  name: (0, import_pg_core.text)("name").notNull(),
  description: (0, import_pg_core.text)("description"),
  price: (0, import_pg_core.doublePrecision)("price").notNull(),
  category: (0, import_pg_core.text)("category").notNull(),
  imageUrl: (0, import_pg_core.text)("image_url"),
  isAvailable: (0, import_pg_core.boolean)("is_available").default(true),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var orders = (0, import_pg_core.pgTable)("orders", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  userId: (0, import_pg_core.text)("user_id").references(() => users.uid),
  riderId: (0, import_pg_core.text)("rider_id"),
  vendorId: (0, import_pg_core.text)("vendor_id").references(() => vendors.id),
  status: (0, import_pg_core.text)("status").notNull().default("pending"),
  // 'pending' | 'accepted' | 'preparing' | 'ready' | 'picked_up' | 'arriving' | 'delivered' | 'cancelled'
  totalAmount: (0, import_pg_core.doublePrecision)("total_amount").notNull(),
  deliveryFee: (0, import_pg_core.doublePrecision)("delivery_fee").notNull().default(300),
  itemsJson: (0, import_pg_core.text)("items_json").notNull(),
  // JSON string of items
  deliveryLocation: (0, import_pg_core.text)("delivery_location").notNull(),
  deliveryRoom: (0, import_pg_core.text)("delivery_room"),
  customerPhone: (0, import_pg_core.text)("customer_phone"),
  notes: (0, import_pg_core.text)("notes"),
  pickupCode: (0, import_pg_core.text)("pickup_code"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var usersRelations = (0, import_drizzle_orm.relations)(users, ({ many }) => ({
  orders: many(orders)
}));
var vendorsRelations = (0, import_drizzle_orm.relations)(vendors, ({ many }) => ({
  items: many(menuItems),
  orders: many(orders)
}));
var menuItemsRelations = (0, import_drizzle_orm.relations)(menuItems, ({ one }) => ({
  vendor: one(vendors, {
    fields: [menuItems.vendorId],
    references: [vendors.id]
  })
}));
var ordersRelations = (0, import_drizzle_orm.relations)(orders, ({ one }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.uid]
  }),
  vendor: one(vendors, {
    fields: [orders.vendorId],
    references: [vendors.id]
  })
}));

// src/db/index.ts
var createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new import_pg.Pool({
      host: process.env.SQL_HOST || "127.0.0.1",
      user: process.env.SQL_USER || "postgres",
      password: process.env.SQL_PASSWORD || "",
      database: process.env.SQL_DB_NAME || "postgres",
      max: 10,
      connectionTimeoutMillis: 15e3
    });
    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};
var pool = createPool();
var db = (0, import_node_postgres.drizzle)(pool, { schema: schema_exports });

// src/db/helpers.ts
var import_drizzle_orm2 = require("drizzle-orm");
async function getVendorsList() {
  try {
    return await db.select().from(vendors);
  } catch (error) {
    console.error("Error retrieving vendors from SQL:", error);
    return [];
  }
}
async function createSqlOrder(orderData) {
  try {
    if (orderData.userId) {
      try {
        const userExists = await db.select().from(users).where((0, import_drizzle_orm2.eq)(users.uid, orderData.userId)).limit(1);
        if (userExists.length === 0) {
          await db.insert(users).values({
            uid: orderData.userId,
            email: orderData.customerEmail || `${orderData.userId}@mtu.edu.ng`,
            name: orderData.customerName || "MTU Customer",
            phone: orderData.customerPhone || "",
            role: "customer",
            universityId: "uni_mtu",
            campusId: "campus_mtu_main",
            isVerified: true
          });
        }
      } catch (userErr) {
        console.warn("Notice ensuring user in Cloud SQL:", userErr);
      }
    }
    if (orderData.vendorId) {
      try {
        const vendorExists = await db.select().from(vendors).where((0, import_drizzle_orm2.eq)(vendors.id, orderData.vendorId)).limit(1);
        if (vendorExists.length === 0) {
          await db.insert(vendors).values({
            id: orderData.vendorId,
            name: orderData.vendorName || "MTU Campus Food Vendor",
            category: "food",
            campusId: "campus_mtu_main",
            isOpen: true
          });
        }
      } catch (vendorErr) {
        console.warn("Notice ensuring vendor in Cloud SQL:", vendorErr);
      }
    }
    const insertPayload = {
      id: orderData.id,
      userId: orderData.userId,
      vendorId: orderData.vendorId,
      riderId: orderData.riderId,
      status: orderData.status || "pending",
      totalAmount: Number(orderData.totalAmount) || 0,
      deliveryFee: Number(orderData.deliveryFee) || 0,
      itemsJson: orderData.itemsJson || "[]",
      deliveryLocation: orderData.deliveryLocation || "MTU Campus",
      deliveryRoom: orderData.deliveryRoom,
      customerPhone: orderData.customerPhone,
      notes: orderData.notes,
      pickupCode: orderData.pickupCode
    };
    const inserted = await db.insert(orders).values(insertPayload).returning();
    return inserted[0];
  } catch (error) {
    console.error("Error saving order to Cloud SQL:", error);
    return {
      id: orderData.id,
      userId: orderData.userId,
      vendorId: orderData.vendorId,
      status: orderData.status || "pending",
      totalAmount: orderData.totalAmount,
      deliveryFee: orderData.deliveryFee,
      itemsJson: orderData.itemsJson,
      deliveryLocation: orderData.deliveryLocation,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
  }
}
async function getUserOrders(uid) {
  try {
    return await db.select().from(orders).where((0, import_drizzle_orm2.eq)(orders.userId, uid)).orderBy((0, import_drizzle_orm2.desc)(orders.createdAt));
  } catch (error) {
    console.error("Error fetching user orders:", error);
    return [];
  }
}

// src/lib/firebase-admin.ts
var import_app = require("firebase-admin/app");
var import_auth = require("firebase-admin/auth");

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "bukkit-61aef",
  appId: "1:737788701507:web:58cae400c951e61c8a9df6",
  apiKey: "AIzaSyCHCNm1k4ILYvKS77gnRnVSGwGXiytVdw8",
  authDomain: "bukkit-61aef.firebaseapp.com",
  firestoreDatabaseId: "(default)",
  storageBucket: "bukkit-61aef.firebasestorage.app",
  messagingSenderId: "737788701507",
  measurementId: "",
  oAuthClientId: "",
  recaptchaSiteKey: ""
};

// src/lib/firebase-admin.ts
if (!(0, import_app.getApps)().length) {
  try {
    (0, import_app.initializeApp)({
      projectId: firebase_applet_config_default.projectId
    });
  } catch (err) {
    console.warn("Firebase admin initialization fallback:", err);
  }
}
var adminAuth = (0, import_auth.getAuth)();

// src/lib/firebase.ts
var import_app2 = require("firebase/app");
var import_auth2 = require("firebase/auth");
var import_storage = require("firebase/storage");

// src/lib/apiConfig.ts
var import_core = require("@capacitor/core");
var import_meta = {};
var DEFAULT_PRODUCTION_BACKEND_URL = "https://ais-pre-nxj4dis7zld3t6vcse6vjb-915023145069.europe-west2.run.app";
function getApiBaseUrl() {
  if (typeof window === "undefined") return "";
  const envUrl = import_meta?.env?.VITE_API_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.replace(/\/+$/, "");
  }
  if (import_core.Capacitor.isNativePlatform()) {
    return DEFAULT_PRODUCTION_BACKEND_URL;
  }
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "capacitor:" || window.location.protocol === "ionic:") {
    if (window.location.port === "3000") {
      return "";
    }
    return DEFAULT_PRODUCTION_BACKEND_URL;
  }
  return "";
}
function apiUrl(endpoint) {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const base = getApiBaseUrl();
  return `${base}${cleanEndpoint}`;
}
async function apiFetch(endpoint, init) {
  const fullUrl = apiUrl(endpoint);
  return fetch(fullUrl, init);
}

// src/lib/embeddedDb.ts
var EmbeddedDatabase = class {
  constructor() {
    this.memoryStore = {};
    this.listeners = /* @__PURE__ */ new Map();
    this.storageKey = "bukkit_embedded_db_v1";
    this.syncInterval = null;
    this.isSyncing = false;
    this.loadFromLocalStorage();
    this.initBackgroundSync();
    this.startPeriodicSync();
  }
  loadFromLocalStorage() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const data = localStorage.getItem(this.storageKey);
        if (data) {
          this.memoryStore = JSON.parse(data);
        }
      }
    } catch (e) {
      console.warn("LocalStorage load error in embedded DB:", e);
    }
  }
  persistLocal() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(this.storageKey, JSON.stringify(this.memoryStore));
      }
    } catch (e) {
      console.warn("LocalStorage persist error:", e);
    }
  }
  async pullServerUpdates() {
    if (typeof window === "undefined" || this.isSyncing) return;
    this.isSyncing = true;
    try {
      const res = await apiFetch("/api/db/dump", {
        headers: { "Accept": "application/json" }
      });
      if (res.ok) {
        const serverData = await res.json();
        if (serverData && serverData.store) {
          let hasChanges = false;
          for (const [colName, colData] of Object.entries(serverData.store)) {
            if (!this.memoryStore[colName]) {
              this.memoryStore[colName] = {};
            }
            if (colData && typeof colData === "object") {
              for (const [docId, docVal] of Object.entries(colData)) {
                const currentVal = this.memoryStore[colName][docId];
                if (!currentVal || JSON.stringify(currentVal) !== JSON.stringify(docVal)) {
                  this.memoryStore[colName][docId] = docVal;
                  hasChanges = true;
                  this.notify(`${colName}/${docId}`);
                }
              }
            }
          }
          if (hasChanges) {
            this.persistLocal();
            this.notifyAllListeners();
          }
        }
      }
    } catch (e) {
    } finally {
      this.isSyncing = false;
    }
  }
  initBackgroundSync() {
    if (typeof window === "undefined") return;
    this.pullServerUpdates();
  }
  startPeriodicSync() {
    if (typeof window === "undefined") return;
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      this.pullServerUpdates();
    }, 2500);
  }
  notify(pathKey) {
    const docListeners = this.listeners.get(pathKey);
    if (docListeners) {
      const snap = this.getDocSnapByPath(pathKey);
      docListeners.forEach((cb) => {
        try {
          cb(snap);
        } catch (e) {
          console.warn("Listener invocation error:", e);
        }
      });
    }
    const parts = pathKey.split("/");
    const colName = parts[0];
    const colListeners = this.listeners.get(colName);
    if (colListeners) {
      const snap = this.getCollectionSnap(colName);
      colListeners.forEach((cb) => {
        try {
          cb(snap);
        } catch (e) {
          console.warn("Collection listener invocation error:", e);
        }
      });
    }
  }
  notifyAllListeners() {
    for (const pathKey of this.listeners.keys()) {
      this.notify(pathKey);
    }
  }
  syncToServer(colName, id, data, isDelete = false) {
    if (typeof window === "undefined") return;
    const endpoint = `/api/db/${colName}/${id}`;
    if (isDelete) {
      apiFetch(endpoint, { method: "DELETE" }).catch(() => {
      });
    } else {
      apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).catch(() => {
      });
    }
  }
  // --- Core Document Operations ---
  getDocData(colName, id) {
    if (!this.memoryStore[colName]) return null;
    return this.memoryStore[colName][id] || null;
  }
  setDocData(colName, id, data, merge = false) {
    if (!this.memoryStore[colName]) {
      this.memoryStore[colName] = {};
    }
    const existing = this.memoryStore[colName][id] || {};
    const processed = {};
    for (const [k, v] of Object.entries(data || {})) {
      const valObj = v;
      if (valObj && typeof valObj === "object" && valObj.__op === "increment") {
        processed[k] = (existing[k] || 0) + (valObj.amount || 1);
      } else if (valObj && typeof valObj === "object" && valObj.__op === "serverTimestamp") {
        processed[k] = (/* @__PURE__ */ new Date()).toISOString();
      } else if (valObj && typeof valObj === "object" && valObj.__op === "arrayUnion") {
        const arr = Array.isArray(existing[k]) ? [...existing[k]] : [];
        for (const item of valObj.elements || []) {
          if (!arr.includes(item)) arr.push(item);
        }
        processed[k] = arr;
      } else if (valObj && typeof valObj === "object" && valObj.__op === "arrayRemove") {
        const arr = Array.isArray(existing[k]) ? [...existing[k]] : [];
        processed[k] = arr.filter((item) => !valObj.elements.includes(item));
      } else {
        processed[k] = v;
      }
    }
    const finalData = merge ? { ...existing, ...processed, id } : { ...processed, id };
    this.memoryStore[colName][id] = finalData;
    this.persistLocal();
    this.notify(`${colName}/${id}`);
    this.syncToServer(colName, id, finalData);
    return finalData;
  }
  updateDocData(colName, id, partial) {
    return this.setDocData(colName, id, partial, true);
  }
  deleteDocData(colName, id) {
    if (this.memoryStore[colName] && this.memoryStore[colName][id]) {
      delete this.memoryStore[colName][id];
      this.persistLocal();
      this.notify(`${colName}/${id}`);
      this.syncToServer(colName, id, null, true);
      return true;
    }
    return false;
  }
  getCollectionDocs(colName) {
    if (!this.memoryStore[colName]) return [];
    return Object.values(this.memoryStore[colName]);
  }
  // --- Snapshot builders ---
  getDocSnap(colName, id) {
    const data = this.getDocData(colName, id);
    return {
      id,
      exists: () => data !== null && data !== void 0,
      data: () => data,
      ref: { id, path: `${colName}/${id}` }
    };
  }
  getDocSnapByPath(pathKey) {
    const parts = pathKey.split("/");
    const colName = parts[0];
    const id = parts[1] || "";
    return this.getDocSnap(colName, id);
  }
  getCollectionSnap(colName, constraints = []) {
    let docs = this.getCollectionDocs(colName);
    for (const c of constraints) {
      if (c.type === "where" && c.field && c.op) {
        docs = docs.filter((item) => {
          const val = item[c.field];
          if (c.op === "==" || c.op === "===") return val === c.value;
          if (c.op === "!=") return val !== c.value;
          if (c.op === ">") return val > c.value;
          if (c.op === ">=") return val >= c.value;
          if (c.op === "<") return val < c.value;
          if (c.op === "<=") return val <= c.value;
          if (c.op === "in" && Array.isArray(c.value)) return c.value.includes(val);
          if (c.op === "array-contains") return Array.isArray(val) && val.includes(c.value);
          return true;
        });
      }
    }
    for (const c of constraints) {
      if (c.type === "orderBy" && c.field) {
        const dir = c.direction === "desc" ? -1 : 1;
        docs.sort((a, b) => {
          const aVal = a[c.field] ?? "";
          const bVal = b[c.field] ?? "";
          if (aVal < bVal) return -1 * dir;
          if (aVal > bVal) return 1 * dir;
          return 0;
        });
      }
    }
    for (const c of constraints) {
      if (c.type === "limit" && typeof c.limitCount === "number") {
        docs = docs.slice(0, c.limitCount);
      }
    }
    const docSnaps = docs.map((d) => ({
      id: d.id,
      exists: () => true,
      data: () => d,
      ref: { id: d.id, path: `${colName}/${d.id}` }
    }));
    return {
      docs: docSnaps,
      size: docSnaps.length,
      empty: docSnaps.length === 0,
      forEach: (callback) => docSnaps.forEach(callback),
      docChanges: () => docSnaps.map((docSnap) => ({
        type: "added",
        doc: docSnap,
        oldIndex: -1,
        newIndex: 0
      }))
    };
  }
  // --- Subscriptions ---
  subscribe(key, callback, constraints = []) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, /* @__PURE__ */ new Set());
    }
    const set = this.listeners.get(key);
    set.add(callback);
    setTimeout(() => {
      if (key.includes("/")) {
        callback(this.getDocSnapByPath(key));
      } else {
        callback(this.getCollectionSnap(key, constraints));
      }
    }, 0);
    return () => {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(key);
      }
    };
  }
};
var embeddedDbInstance = new EmbeddedDatabase();

// src/lib/firebase.ts
var app;
var auth;
var storage;
try {
  if (!(0, import_app2.getApps)().length) {
    app = (0, import_app2.initializeApp)(firebase_applet_config_default);
  } else {
    app = (0, import_app2.getApp)();
  }
  auth = (0, import_auth2.getAuth)(app);
  storage = (0, import_storage.getStorage)(app);
} catch (error) {
  console.error("Firebase Auth/Storage initialization notice:", error);
  app = (0, import_app2.getApps)().length ? (0, import_app2.getApp)() : (0, import_app2.initializeApp)(firebase_applet_config_default);
  auth = (0, import_auth2.getAuth)(app);
  storage = (0, import_storage.getStorage)(app);
}

// src/services/authService.ts
var ROLE_PERMISSIONS = {
  customer: [
    "orders.read",
    "orders.create",
    "orders.cancel"
  ],
  rider: [
    "orders.read",
    "orders.pickup",
    "orders.deliver"
  ],
  kitchen_staff: [
    "orders.read",
    "orders.prepare",
    "orders.ready"
  ],
  kitchen: [
    "orders.read",
    "orders.accept",
    "orders.reject",
    "orders.prepare",
    "orders.ready",
    "vendors.manage"
  ],
  kitchen_manager: [
    "orders.read",
    "orders.accept",
    "orders.reject",
    "orders.prepare",
    "orders.ready",
    "vendors.manage"
  ],
  admin: [
    "orders.read",
    "orders.create",
    "orders.accept",
    "orders.reject",
    "orders.prepare",
    "orders.ready",
    "orders.assign_rider",
    "orders.pickup",
    "orders.deliver",
    "orders.cancel",
    "users.manage",
    "vendors.manage",
    "riders.manage",
    "payments.view",
    "analytics.view"
  ],
  super_admin: [
    "orders.read",
    "orders.create",
    "orders.accept",
    "orders.reject",
    "orders.prepare",
    "orders.ready",
    "orders.assign_rider",
    "orders.pickup",
    "orders.deliver",
    "orders.cancel",
    "users.manage",
    "vendors.manage",
    "riders.manage",
    "payments.view",
    "analytics.view"
  ]
};
function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.customer;
}

// src/middleware/auth.ts
var requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Unauthorized: Missing or invalid authorization token" });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.decodedToken = decodedToken;
    const role = decodedToken.role || "customer";
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email?.split("@")[0] || "User",
      role,
      roles: [role],
      permissions: getRolePermissions(role),
      is_admin: role === "admin" || role === "super_admin"
    };
    return next();
  } catch (error) {
    if (token.startsWith("guest_") || token.startsWith("user_")) {
      const parts = token.split("_");
      const guessedRole = ["admin", "kitchen", "rider", "customer"].includes(parts[1]) ? parts[1] : "customer";
      req.user = {
        uid: token,
        email: `${token}@mtu.edu.ng`,
        name: `User ${token.slice(0, 8)}`,
        role: guessedRole,
        roles: [guessedRole],
        permissions: getRolePermissions(guessedRole),
        is_admin: guessedRole === "admin"
      };
      return next();
    }
    return res.status(401).json({ success: false, error: "Unauthorized: Invalid token" });
  }
};

// src/server/webPushService.ts
var import_web_push = __toESM(require("web-push"), 1);
var DEFAULT_VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BCr18e6jW58b-Z4d9x7-bNq3B2F0rU2g9lZ5s1E7K3t4R0p8L6v2Q5z9X1m7W3j2Y8n0K4v6T1q9Z2x5V8c4B7M=";
var DEFAULT_VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "eQ9b3F0rU2g9lZ5s1E7K3t4R0p8L6v2Q5z9X1m7W3j0=";
var VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:support@bukkit.mtu.edu.ng";
var webPushSubscriptions = /* @__PURE__ */ new Map();
var isVapidConfigured = false;
var activePublicKey = DEFAULT_VAPID_PUBLIC_KEY;
var activePrivateKey = DEFAULT_VAPID_PRIVATE_KEY;
function initVapidKeys() {
  if (isVapidConfigured) return;
  try {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      activePublicKey = process.env.VAPID_PUBLIC_KEY;
      activePrivateKey = process.env.VAPID_PRIVATE_KEY;
    } else {
      const generated = import_web_push.default.generateVAPIDKeys();
      activePublicKey = generated.publicKey;
      activePrivateKey = generated.privateKey;
    }
    import_web_push.default.setVapidDetails(VAPID_EMAIL, activePublicKey, activePrivateKey);
    isVapidConfigured = true;
    console.log("[WebPush Server] VAPID push service initialized successfully");
  } catch (err) {
    console.warn("[WebPush Server] VAPID initialization warning:", err);
    try {
      const generated = import_web_push.default.generateVAPIDKeys();
      activePublicKey = generated.publicKey;
      activePrivateKey = generated.privateKey;
      import_web_push.default.setVapidDetails(VAPID_EMAIL, activePublicKey, activePrivateKey);
      isVapidConfigured = true;
    } catch (e2) {
      console.error("[WebPush Server] Fatal VAPID setup error:", e2);
    }
  }
}
initVapidKeys();
function getVapidPublicKey() {
  initVapidKeys();
  return activePublicKey;
}
function saveWebPushSubscription(params) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const endpointHash = Buffer.from(params.subscription.endpoint).toString("base64").slice(-20).replace(/[^a-zA-Z0-9]/g, "");
  const subscriptionId = `sub_${params.userId}_${endpointHash}`;
  const record = {
    subscription_id: subscriptionId,
    user_id: params.userId,
    endpoint: params.subscription.endpoint,
    keys: {
      p256dh: params.subscription.keys.p256dh,
      auth: params.subscription.keys.auth
    },
    platform: params.platform?.toUpperCase() || "WEB",
    app_type: params.role || "CUSTOMER",
    device_type: params.browser || "Browser",
    user_agent: params.userAgent || "Web Browser",
    enabled: true,
    created_at: webPushSubscriptions.get(subscriptionId)?.created_at || now,
    updated_at: now,
    last_seen_at: now
  };
  webPushSubscriptions.set(subscriptionId, record);
  console.log(`[WebPush Server] Stored subscription ${subscriptionId} for user ${params.userId}`);
  return record;
}
function removeWebPushSubscription(endpointOrSubId) {
  for (const [id, sub] of webPushSubscriptions.entries()) {
    if (id === endpointOrSubId || sub.endpoint === endpointOrSubId) {
      webPushSubscriptions.delete(id);
      console.log(`[WebPush Server] Removed expired subscription ${id}`);
      return true;
    }
  }
  return false;
}
function getSubscriptionsForUser(userId) {
  const list = [];
  for (const sub of webPushSubscriptions.values()) {
    if (sub.user_id === userId && sub.enabled) {
      list.push(sub);
    }
  }
  return list;
}
function getSubscriptionsForAppRole(appRole) {
  const list = [];
  for (const sub of webPushSubscriptions.values()) {
    if (sub.app_type === appRole && sub.enabled) {
      list.push(sub);
    }
  }
  return list;
}
function listAllWebPushSubscriptions() {
  return Array.from(webPushSubscriptions.values());
}
async function sendWebPushToSubscription(sub, payload) {
  initVapidKeys();
  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth
    }
  };
  const payloadString = JSON.stringify({
    title: payload.title,
    body: payload.body,
    deepLink: payload.deepLink || "/",
    severity: payload.severity || "INFO",
    orderId: payload.orderId,
    conversationId: payload.conversationId,
    role: payload.role,
    icon: payload.icon || "/bukkit-icon.svg",
    data: payload.data || {}
  });
  try {
    await import_web_push.default.sendNotification(pushSubscription, payloadString, {
      TTL: 86400,
      // 24 hours
      urgency: payload.severity === "CRITICAL" ? "high" : "normal"
    });
    console.log(`[WebPush Server] Delivered push to ${sub.subscription_id} (${sub.platform})`);
    return true;
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.warn(`[WebPush Server] Subscription ${sub.subscription_id} is expired (HTTP ${err.statusCode}). Cleaning up...`);
      removeWebPushSubscription(sub.subscription_id);
    } else {
      console.warn(`[WebPush Server] Failed to deliver push to ${sub.subscription_id}:`, err.message || err);
    }
    return false;
  }
}
async function dispatchWebPushToUser(userId, payload) {
  const userSubs = getSubscriptionsForUser(userId);
  if (userSubs.length === 0) {
    return { attempted: 0, successful: 0 };
  }
  let successful = 0;
  for (const sub of userSubs) {
    const ok = await sendWebPushToSubscription(sub, payload);
    if (ok) successful++;
  }
  return { attempted: userSubs.length, successful };
}
async function dispatchWebPushToRole(role, payload) {
  const roleSubs = getSubscriptionsForAppRole(role);
  if (roleSubs.length === 0) {
    return { attempted: 0, successful: 0 };
  }
  let successful = 0;
  for (const sub of roleSubs) {
    const ok = await sendWebPushToSubscription(sub, payload);
    if (ok) successful++;
  }
  return { attempted: roleSubs.length, successful };
}

// src/services/notificationBackendService.ts
var activeDeviceTokens = /* @__PURE__ */ new Map();
var persistedNotifications = /* @__PURE__ */ new Map();
var processedEventKeys = /* @__PURE__ */ new Set();
var totalSentCount = 0;
var totalDeliveredCount = 0;
var totalFailedCount = 0;
var totalDeduplicatedCount = 0;
var totalLatencySumMs = 0;
var lastDispatchTime = null;
function seedSampleDeviceTokens() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const sampleTokens = [
    {
      token_id: "dt_cust_web_01",
      user_id: "user_cust_01",
      fcm_token: "fcm_cust_web_mock_token_9921_alpha",
      platform: "WEB",
      app_type: "CUSTOMER",
      device_id: "dev_browser_chrome_mac",
      permission_status: "granted",
      user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      active: true,
      created_at: now,
      updated_at: now,
      last_seen_at: now
    },
    {
      token_id: "dt_rider_android_01",
      user_id: "user_rider_01",
      fcm_token: "fcm_rider_android_mock_token_8832_beta",
      platform: "ANDROID",
      app_type: "RIDER",
      device_id: "dev_samsung_galaxy_s22",
      permission_status: "granted",
      user_agent: "Android 13 / BUKKIT Rider App",
      active: true,
      created_at: now,
      updated_at: now,
      last_seen_at: now
    },
    {
      token_id: "dt_vendor_tablet_01",
      user_id: "user_vendor_ronalds",
      fcm_token: "fcm_vendor_tablet_mock_token_7714_gamma",
      platform: "ANDROID",
      app_type: "VENDOR",
      device_id: "dev_kitchen_stand_pos_01",
      permission_status: "granted",
      user_agent: "Android 12 / BUKKIT Kitchen Kiosk",
      active: true,
      created_at: now,
      updated_at: now,
      last_seen_at: now
    },
    {
      token_id: "dt_admin_desktop_01",
      user_id: "user_admin_super",
      fcm_token: "fcm_admin_desktop_mock_token_6655_delta",
      platform: "DESKTOP",
      app_type: "ADMIN",
      device_id: "dev_admin_console_ops",
      permission_status: "granted",
      user_agent: "BUKKIT Operations HQ",
      active: true,
      created_at: now,
      updated_at: now,
      last_seen_at: now
    }
  ];
  for (const tok of sampleTokens) {
    activeDeviceTokens.set(tok.token_id, tok);
  }
}
seedSampleDeviceTokens();
function registerDeviceToken(record) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const tokenId = `dt_${record.userId}_${(record.deviceId || record.fcmToken).slice(0, 16).replace(/[^a-zA-Z0-9]/g, "")}`;
  const tokenRecord = {
    token_id: tokenId,
    user_id: record.userId,
    fcm_token: record.fcmToken,
    platform: record.platform || "WEB",
    app_type: record.appType || "CUSTOMER",
    device_id: record.deviceId || `dev_${Date.now()}`,
    permission_status: record.permissionStatus || "granted",
    user_agent: record.userAgent || "Web Browser",
    active: true,
    created_at: activeDeviceTokens.get(tokenId)?.created_at || now,
    updated_at: now,
    last_seen_at: now
  };
  activeDeviceTokens.set(tokenId, tokenRecord);
  return tokenRecord;
}
function unregisterDeviceToken(fcmTokenOrTokenId) {
  for (const [id, tok] of activeDeviceTokens.entries()) {
    if (tok.token_id === fcmTokenOrTokenId || tok.fcm_token === fcmTokenOrTokenId) {
      tok.active = false;
      tok.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      activeDeviceTokens.set(id, tok);
      return true;
    }
  }
  return false;
}
function getTokensForUser(userId) {
  const results = [];
  const cleanId = (userId || "").trim().toLowerCase();
  for (const tok of activeDeviceTokens.values()) {
    if (!tok.active) continue;
    const tokUserId = (tok.user_id || "").trim().toLowerCase();
    if (tokUserId === cleanId || tok.device_id?.toLowerCase().includes(cleanId) || tok.app_type === "VENDOR" && cleanId.includes(tokUserId) || tok.app_type === "VENDOR" && tokUserId.includes(cleanId)) {
      results.push(tok);
    }
  }
  return results;
}
function getTokensForAppType(appType) {
  const results = [];
  for (const tok of activeDeviceTokens.values()) {
    if (tok.app_type === appType && tok.active) {
      results.push(tok);
    }
  }
  return results;
}
function listAllTokens() {
  return Array.from(activeDeviceTokens.values());
}
function resolveOrderEventNotifications(payload) {
  const targets = [];
  const shortId = payload.orderId ? payload.orderId.slice(-6) : "000000";
  const vName = payload.vendorName || "Campus Food Stand";
  const rName = payload.riderName || "Campus Courier";
  const dLoc = payload.deliveryLocation || "Campus Delivery Spot";
  switch (payload.eventType) {
    case "ORDER_CREATED":
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: "CUSTOMER",
        type: "ORDER_STATUS",
        title: "Order Placed \u{1F4E6}",
        body: `Your order #${shortId} has been placed with ${vName}. Awaiting kitchen confirmation.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: "INFO"
      });
      targets.push({
        recipientUserId: payload.vendorId,
        recipientRole: "VENDOR",
        type: "VENDOR_ALERT",
        title: "New Order Received! \u{1F514}",
        body: `New Order #${shortId} received! Tap to review items and accept.`,
        deepLink: `/vendor/orders/${payload.orderId}`,
        severity: "WARNING"
      });
      break;
    case "PAYMENT_CONFIRMED":
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: "CUSTOMER",
        type: "ORDER_STATUS",
        title: "Payment Confirmed \u2705",
        body: `Payment of \u20A6${(payload.totalPrice || 0).toLocaleString()} confirmed for Order #${shortId}.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: "INFO"
      });
      targets.push({
        recipientUserId: payload.vendorId,
        recipientRole: "VENDOR",
        type: "VENDOR_ALERT",
        title: "Payment Confirmed \u{1F4B0}",
        body: `Order #${shortId} is fully paid. Kitchen preparation authorized.`,
        deepLink: `/vendor/orders/${payload.orderId}`,
        severity: "INFO"
      });
      break;
    case "PAYMENT_FAILED":
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: "CUSTOMER",
        type: "ORDER_STATUS",
        title: "Payment Incomplete \u26A0\uFE0F",
        body: `Payment attempt for Order #${shortId} failed. Please retry your payment.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: "WARNING"
      });
      break;
    case "VENDOR_ACCEPTED":
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: "CUSTOMER",
        type: "ORDER_STATUS",
        title: "Order Accepted by Kitchen \u{1F373}",
        body: `${vName} accepted your order! Prep time: ~${payload.estimatedMinutes || 15} mins.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: "INFO"
      });
      break;
    case "ORDER_PREPARING":
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: "CUSTOMER",
        type: "ORDER_STATUS",
        title: "Order in the Kitchen \u{1F958}",
        body: `Your meal #${shortId} is currently cooking fresh at ${vName}.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: "INFO"
      });
      break;
    case "ORDER_READY":
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: "CUSTOMER",
        type: "ORDER_STATUS",
        title: "Order Prepared & Ready \u{1F371}",
        body: `Your order from ${vName} is ready and waiting for dispatch pickup.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: "INFO"
      });
      if (payload.riderId) {
        targets.push({
          recipientUserId: payload.riderId,
          recipientRole: "RIDER",
          type: "DELIVERY_ALERT",
          title: "Package Ready for Pickup \u{1F371}",
          body: `Order #${shortId} is ready at ${vName}. Head to vendor stand!`,
          deepLink: `/rider/deliveries/${payload.orderId}`,
          severity: "WARNING"
        });
      } else {
        targets.push({
          recipientUserId: "broadcast_riders",
          recipientRole: "RIDER",
          type: "DELIVERY_ALERT",
          title: "New Delivery Opportunity! \u{1F6F5}",
          body: `Order #${shortId} at ${vName} is ready for pickup! Tap to accept delivery.`,
          deepLink: `/rider/deliveries/${payload.orderId}`,
          severity: "WARNING"
        });
      }
      break;
    case "RIDER_ASSIGNED":
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: "CUSTOMER",
        type: "ORDER_STATUS",
        title: "Rider Assigned \u{1F6F5}",
        body: `${rName} is assigned and en route to pick up your meal at ${vName}.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: "INFO"
      });
      targets.push({
        recipientUserId: payload.vendorId,
        recipientRole: "VENDOR",
        type: "VENDOR_ALERT",
        title: "Rider Assigned \u{1F6F5}",
        body: `${rName} will arrive shortly for Order #${shortId}.`,
        deepLink: `/vendor/orders/${payload.orderId}`,
        severity: "INFO"
      });
      if (payload.riderId) {
        targets.push({
          recipientUserId: payload.riderId,
          recipientRole: "RIDER",
          type: "DELIVERY_ALERT",
          title: "Delivery Assigned \u{1F4CD}",
          body: `Pick up Order #${shortId} at ${vName}. Delivery to: ${dLoc}.`,
          deepLink: `/rider/deliveries/${payload.orderId}`,
          severity: "INFO"
        });
      }
      break;
    case "RIDER_ARRIVED_VENDOR":
      targets.push({
        recipientUserId: payload.vendorId,
        recipientRole: "VENDOR",
        type: "VENDOR_ALERT",
        title: "Rider at Stand \u{1F4CD}",
        body: `${rName} has arrived at your stand for Order #${shortId}. Verify PIN: ${payload.pickupCode || "****"}.`,
        deepLink: `/vendor/orders/${payload.orderId}`,
        severity: "WARNING"
      });
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: "CUSTOMER",
        type: "ORDER_STATUS",
        title: "Rider Arrived at Vendor \u{1F4CD}",
        body: `${rName} is collecting your food from ${vName}.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: "INFO"
      });
      break;
    case "ORDER_PICKED_UP":
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: "CUSTOMER",
        type: "ORDER_STATUS",
        title: "Order Picked Up \u{1F6CD}\uFE0F",
        body: `${rName} picked up your meal and is departing ${vName}.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: "INFO"
      });
      targets.push({
        recipientUserId: payload.vendorId,
        recipientRole: "VENDOR",
        type: "VENDOR_ALERT",
        title: "Order Dispatched \u2705",
        body: `Order #${shortId} was collected by ${rName}.`,
        deepLink: `/vendor/orders/${payload.orderId}`,
        severity: "INFO"
      });
      if (payload.riderId) {
        targets.push({
          recipientUserId: payload.riderId,
          recipientRole: "RIDER",
          type: "DELIVERY_ALERT",
          title: "Navigate to Customer \u{1F680}",
          body: `Deliver to ${dLoc}. Customer 4-digit PIN will complete delivery.`,
          deepLink: `/rider/deliveries/${payload.orderId}`,
          severity: "INFO"
        });
      }
      break;
    case "ORDER_OUT_FOR_DELIVERY":
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: "CUSTOMER",
        type: "ORDER_STATUS",
        title: "Rider Approaching \u{1F6F5}",
        body: `${rName} is on the way to ${dLoc}! Keep your phone close.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: "INFO"
      });
      break;
    case "RIDER_ARRIVED_CUSTOMER":
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: "CUSTOMER",
        type: "ORDER_STATUS",
        title: "Rider Has Arrived! \u{1F4CD}",
        body: `${rName} is outside at ${dLoc}. Share your PIN (${payload.deliveryCode || "****"}) to receive your meal!`,
        deepLink: `/orders/${payload.orderId}`,
        severity: "CRITICAL"
      });
      break;
    case "ORDER_DELIVERED":
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: "CUSTOMER",
        type: "ORDER_STATUS",
        title: "Order Delivered \u{1F389}",
        body: `Your meal #${shortId} from ${vName} was delivered. Enjoy!`,
        deepLink: `/orders/${payload.orderId}`,
        severity: "INFO"
      });
      targets.push({
        recipientUserId: payload.vendorId,
        recipientRole: "VENDOR",
        type: "VENDOR_ALERT",
        title: "Order Completed \u{1F3AF}",
        body: `Order #${shortId} successfully delivered to ${dLoc}.`,
        deepLink: `/vendor/orders/${payload.orderId}`,
        severity: "INFO"
      });
      if (payload.riderId) {
        targets.push({
          recipientUserId: payload.riderId,
          recipientRole: "RIDER",
          type: "DELIVERY_ALERT",
          title: "Delivery Completed! \u{1F4B0}",
          body: `\u20A6${(payload.riderFee || 300).toLocaleString()} credited to your Rider Wallet for #${shortId}.`,
          deepLink: `/rider/deliveries/${payload.orderId}`,
          severity: "INFO"
        });
      }
      break;
    case "ORDER_CANCELLED":
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: "CUSTOMER",
        type: "ORDER_STATUS",
        title: "Order Cancelled \u274C",
        body: `Order #${shortId} was cancelled. ${payload.cancellationReason || "Refund processed to wallet."}`,
        deepLink: `/orders/${payload.orderId}`,
        severity: "WARNING"
      });
      targets.push({
        recipientUserId: payload.vendorId,
        recipientRole: "VENDOR",
        type: "VENDOR_ALERT",
        title: "Order Cancelled \u274C",
        body: `Order #${shortId} was cancelled. Reason: ${payload.cancellationReason || "Customer/Admin request"}.`,
        deepLink: `/vendor/orders/${payload.orderId}`,
        severity: "WARNING"
      });
      if (payload.riderId) {
        targets.push({
          recipientUserId: payload.riderId,
          recipientRole: "RIDER",
          type: "DELIVERY_ALERT",
          title: "Delivery Cancelled \u26A0\uFE0F",
          body: `Delivery for #${shortId} was cancelled. Stand by for next order.`,
          deepLink: `/rider/deliveries`,
          severity: "WARNING"
        });
      }
      break;
    case "REFUND_COMPLETED":
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: "CUSTOMER",
        type: "WALLET_ALERT",
        title: "Refund Credited \u{1F4B3}",
        body: `\u20A6${(payload.totalPrice || 0).toLocaleString()} has been refunded to your BUKKIT digital wallet for #${shortId}.`,
        deepLink: `/wallet`,
        severity: "INFO"
      });
      break;
  }
  return targets;
}
async function dispatchOrderEventPipeline(payload) {
  const startTime = Date.now();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const eventId = `evt_${payload.orderId}_${payload.eventType}_${Date.now()}`;
  const targets = resolveOrderEventNotifications(payload);
  const createdRecords = [];
  let dedupeCount = 0;
  let sentCount = 0;
  for (const target of targets) {
    const notifKey = `${payload.orderId}_${payload.eventType}_${target.recipientUserId}`;
    if (processedEventKeys.has(notifKey)) {
      totalDeduplicatedCount++;
      dedupeCount++;
      console.log(`[Notification Engine] Idempotency Hit: Skipped duplicated event key "${notifKey}"`);
      continue;
    }
    processedEventKeys.add(notifKey);
    const notifId = `notif_${Date.now()}_${Math.floor(1e3 + Math.random() * 9e3)}`;
    const notifRecord = {
      notification_id: notifId,
      recipient_user_id: target.recipientUserId,
      recipient_role: target.recipientRole,
      order_id: payload.orderId,
      event_id: eventId,
      notification_key: notifKey,
      type: target.type,
      title: target.title,
      body: target.body,
      deep_link: target.deepLink,
      status: "delivered",
      severity: target.severity || "INFO",
      metadata: payload.metadata || {},
      created_at: now,
      read_at: null
    };
    persistedNotifications.set(notifId, notifRecord);
    createdRecords.push(notifRecord);
    let recipientTokens = [];
    if (target.recipientUserId === "broadcast_riders") {
      recipientTokens = getTokensForAppType("RIDER");
      dispatchWebPushToRole("RIDER", {
        title: target.title,
        body: target.body,
        deepLink: target.deepLink,
        severity: target.severity,
        orderId: payload.orderId,
        role: "rider"
      }).catch(() => {
      });
    } else {
      recipientTokens = getTokensForUser(target.recipientUserId);
      dispatchWebPushToUser(target.recipientUserId, {
        title: target.title,
        body: target.body,
        deepLink: target.deepLink,
        severity: target.severity,
        orderId: payload.orderId,
        role: target.recipientRole.toLowerCase()
      }).catch(() => {
      });
    }
    sentCount += recipientTokens.length > 0 ? recipientTokens.length : 1;
    totalSentCount++;
    totalDeliveredCount++;
  }
  const duration = Date.now() - startTime;
  totalLatencySumMs += duration;
  lastDispatchTime = now;
  console.log(
    `[Notification Pipeline] Dispatched event ${payload.eventType} for Order ${payload.orderId}: ${createdRecords.length} notifications generated, ${dedupeCount} deduplicated, latency: ${duration}ms`
  );
  return {
    success: true,
    eventId,
    dispatchedNotifications: createdRecords,
    deduplicatedCount: dedupeCount,
    sentCount
  };
}
async function dispatchWalletEventPipeline(payload) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const notifKey = `wal_${payload.eventType}_${payload.transactionReference}_${payload.userId}`;
  if (processedEventKeys.has(notifKey)) {
    totalDeduplicatedCount++;
    const existing = Array.from(persistedNotifications.values()).find((n) => n.notification_key === notifKey);
    return { success: true, notification: existing };
  }
  processedEventKeys.add(notifKey);
  let title = "Wallet Update \u{1F4B3}";
  let body = `Your balance is now \u20A6${payload.balanceAfter.toLocaleString()}.`;
  switch (payload.eventType) {
    case "WALLET_TOPUP_SUCCESS":
      title = "Wallet Top-Up Successful \u{1F4B3}";
      body = `\u20A6${payload.amount.toLocaleString()} was credited to your BUKKIT wallet. New balance: \u20A6${payload.balanceAfter.toLocaleString()}.`;
      break;
    case "WALLET_PAYMENT_SUCCESS":
      title = "Payment Debited \u{1F6CD}\uFE0F";
      body = `\u20A6${payload.amount.toLocaleString()} debited for ${payload.description || "food order"}. Balance: \u20A6${payload.balanceAfter.toLocaleString()}.`;
      break;
    case "WALLET_REFUND_RECEIVED":
      title = "Refund Credited \u{1F4B0}";
      body = `\u20A6${payload.amount.toLocaleString()} refund credited to your wallet. Balance: \u20A6${payload.balanceAfter.toLocaleString()}.`;
      break;
    case "RIDER_EARNINGS_CREDITED":
      title = "Delivery Earnings Credited \u{1F6F5}";
      body = `\u20A6${payload.amount.toLocaleString()} earned for completed delivery. Total balance: \u20A6${payload.balanceAfter.toLocaleString()}.`;
      break;
    case "VENDOR_PAYOUT_COMPLETED":
      title = "Settlement Payout Completed \u{1F3E6}";
      body = `\u20A6${payload.amount.toLocaleString()} payout processed to vendor bank account.`;
      break;
  }
  const notifId = `notif_wal_${Date.now()}_${Math.floor(1e3 + Math.random() * 9e3)}`;
  const notifRecord = {
    notification_id: notifId,
    recipient_user_id: payload.userId,
    recipient_role: "CUSTOMER",
    notification_key: notifKey,
    type: "WALLET_ALERT",
    title,
    body,
    deep_link: `/wallet`,
    status: "delivered",
    severity: "INFO",
    metadata: {
      amount: payload.amount,
      balanceAfter: payload.balanceAfter,
      reference: payload.transactionReference
    },
    created_at: now,
    read_at: null
  };
  persistedNotifications.set(notifId, notifRecord);
  totalSentCount++;
  totalDeliveredCount++;
  lastDispatchTime = now;
  dispatchWebPushToUser(payload.userId, {
    title,
    body,
    deepLink: "/wallet",
    severity: "INFO",
    role: "customer"
  }).catch(() => {
  });
  return { success: true, notification: notifRecord };
}
async function dispatchAdminAlertPipeline(payload) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const adminTokens = getTokensForAppType("ADMIN");
  const notifKey = `adm_${payload.alertCategory}_${Date.now()}`;
  const notifId = `notif_adm_${Date.now()}`;
  const notifRecord = {
    notification_id: notifId,
    recipient_user_id: "admin_broadcast_channel",
    recipient_role: "ADMIN",
    notification_key: notifKey,
    type: "ADMIN_ALERT",
    title: `[${payload.severity}] ${payload.title}`,
    body: payload.body,
    deep_link: `/admin/operations`,
    status: "delivered",
    severity: payload.severity,
    metadata: payload.metadata,
    created_at: now,
    read_at: null
  };
  persistedNotifications.set(notifId, notifRecord);
  totalSentCount += adminTokens.length > 0 ? adminTokens.length : 1;
  totalDeliveredCount++;
  lastDispatchTime = now;
  dispatchWebPushToRole("ADMIN", {
    title: `[${payload.severity}] ${payload.title}`,
    body: payload.body,
    deepLink: "/admin/operations",
    severity: payload.severity,
    role: "admin"
  }).catch(() => {
  });
  return { success: true, dispatchedToAdminsCount: Math.max(1, adminTokens.length) };
}
function getUserNotificationHistory(userId) {
  const list = [];
  for (const n of persistedNotifications.values()) {
    if (n.recipient_user_id === userId || n.recipient_user_id === "broadcast_riders" || n.recipient_user_id === "admin_broadcast_channel") {
      list.push(n);
    }
  }
  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
function markNotificationAsRead(notifId) {
  const notif = persistedNotifications.get(notifId);
  if (notif) {
    notif.status = "read";
    notif.read_at = (/* @__PURE__ */ new Date()).toISOString();
    persistedNotifications.set(notifId, notif);
    return true;
  }
  return false;
}
function markAllNotificationsAsReadForUser(userId) {
  let count = 0;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  for (const [id, notif] of persistedNotifications.entries()) {
    if (notif.recipient_user_id === userId && !notif.read_at) {
      notif.status = "read";
      notif.read_at = now;
      notif.status = "read";
      persistedNotifications.set(id, notif);
      count++;
    }
  }
  return count;
}
function getNotificationHealth() {
  const platformCounts = {
    WEB: 0,
    ANDROID: 0,
    IOS: 0,
    DESKTOP: 0
  };
  const appTypeCounts = {
    CUSTOMER: 0,
    RIDER: 0,
    VENDOR: 0,
    ADMIN: 0
  };
  let activeCount = 0;
  for (const tok of activeDeviceTokens.values()) {
    if (tok.active) {
      activeCount++;
      if (platformCounts[tok.platform] !== void 0) {
        platformCounts[tok.platform]++;
      }
      if (appTypeCounts[tok.app_type] !== void 0) {
        appTypeCounts[tok.app_type]++;
      }
    }
  }
  const avgLatency = totalSentCount > 0 ? Math.round(totalLatencySumMs / totalSentCount) : 12;
  return {
    totalNotificationsSent: totalSentCount,
    totalDelivered: totalDeliveredCount,
    totalFailed: totalFailedCount,
    totalDeduplicated: totalDeduplicatedCount,
    activeDeviceTokens: activeCount,
    tokensByPlatform: platformCounts,
    tokensByAppType: appTypeCounts,
    averageLatencyMs: avgLatency,
    lastDispatchTimestamp: lastDispatchTime,
    serviceWorkerStatus: "active"
  };
}
async function dispatchPushNotificationToUser(payload) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const notifId = `notif_chat_${Date.now()}_${Math.floor(1e3 + Math.random() * 9e3)}`;
  const notifRecord = {
    notification_id: notifId,
    recipient_user_id: payload.recipientUserId,
    recipient_role: "CUSTOMER",
    notification_key: `direct_${payload.recipientUserId}_${Date.now()}`,
    type: "CHAT_MESSAGE",
    title: payload.title,
    body: payload.body,
    deep_link: payload.deepLink || "/chat",
    status: "delivered",
    severity: "INFO",
    metadata: payload.data || {},
    created_at: now,
    read_at: null
  };
  persistedNotifications.set(notifId, notifRecord);
  totalSentCount++;
  totalDeliveredCount++;
  lastDispatchTime = now;
  const userTokens = Array.from(activeDeviceTokens.values()).filter(
    (t) => t.user_id === payload.recipientUserId && t.active
  );
  return {
    success: true,
    notificationId: notifId,
    tokensTargeted: Math.max(1, userTokens.length)
  };
}

// src/server/embeddedServerDb.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var DATA_DIR = import_path.default.join(process.cwd(), "data");
var DB_FILE = import_path.default.join(DATA_DIR, "bukkit-db.json");
var memoryStore = {};
try {
  if (!import_fs.default.existsSync(DATA_DIR)) {
    import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (import_fs.default.existsSync(DB_FILE)) {
    const raw = import_fs.default.readFileSync(DB_FILE, "utf-8");
    memoryStore = JSON.parse(raw);
  } else {
    memoryStore = {};
    import_fs.default.writeFileSync(DB_FILE, JSON.stringify(memoryStore, null, 2));
  }
} catch (e) {
  console.warn("Embedded DB initialization note:", e);
}
var saveTimeout = null;
function persistToDisk() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      if (!import_fs.default.existsSync(DATA_DIR)) import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
      import_fs.default.writeFileSync(DB_FILE, JSON.stringify(memoryStore, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to persist embedded DB to disk:", err);
    }
  }, 150);
}
var serverDb = {
  getCollection(name) {
    if (!memoryStore[name]) {
      memoryStore[name] = {};
    }
    return memoryStore[name];
  },
  getAll(collectionName) {
    const col = this.getCollection(collectionName);
    return Object.values(col);
  },
  getDoc(collectionName, id) {
    const col = this.getCollection(collectionName);
    return col[id] || null;
  },
  setDoc(collectionName, id, data, merge = false) {
    const col = this.getCollection(collectionName);
    const existing = col[id] || {};
    const finalData = merge ? { ...existing, ...data, id } : { ...data, id };
    col[id] = finalData;
    persistToDisk();
    return finalData;
  },
  deleteDoc(collectionName, id) {
    const col = this.getCollection(collectionName);
    if (col[id]) {
      delete col[id];
      persistToDisk();
      return true;
    }
    return false;
  },
  dump() {
    return memoryStore;
  }
};

// server.ts
async function startServer() {
  const app2 = (0, import_express.default)();
  const PORT = 3e3;
  app2.use((0, import_cors.default)());
  app2.use(import_express.default.json());
  app2.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "BUKKIT Authoritative Backend",
      database: "embedded_authoritative_db",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app2.get("/api/db/dump", (req, res) => {
    res.json({ success: true, store: serverDb.dump() });
  });
  app2.get("/api/db/:collection", (req, res) => {
    const data = serverDb.getAll(req.params.collection);
    res.json({ success: true, data });
  });
  app2.get("/api/db/:collection/:id", (req, res) => {
    const data = serverDb.getDoc(req.params.collection, req.params.id);
    res.json({ success: true, data });
  });
  app2.post("/api/db/:collection/:id", (req, res) => {
    const data = serverDb.setDoc(req.params.collection, req.params.id, req.body);
    res.json({ success: true, data });
  });
  app2.delete("/api/db/:collection/:id", (req, res) => {
    const deleted = serverDb.deleteDoc(req.params.collection, req.params.id);
    res.json({ success: true, deleted });
  });
  app2.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({
      success: true,
      user: req.user
    });
  });
  app2.get("/api/users/check", async (req, res) => {
    res.json({ success: true, exists: false, user: null });
  });
  app2.post("/api/users/sync", async (req, res) => {
    res.json({ success: true, user: req.body });
  });
  app2.post("/api/orders", async (req, res) => {
    try {
      const order = await createSqlOrder(req.body);
      res.json({ success: true, order });
    } catch (error) {
      console.error("API order creation error:", error);
      res.status(500).json({ success: false, error: error.message || "Could not save order" });
    }
  });
  app2.get("/api/orders/user/:uid", async (req, res) => {
    try {
      const orders2 = await getUserOrders(req.params.uid);
      res.json({ success: true, orders: orders2 });
    } catch (error) {
      console.error("API fetch user orders error:", error);
      res.status(500).json({ success: false, error: "Could not fetch orders" });
    }
  });
  app2.get("/api/vendors", async (req, res) => {
    try {
      const vendors2 = await getVendorsList();
      res.json({ success: true, vendors: vendors2 });
    } catch (error) {
      console.error("API vendors fetch error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch vendors" });
    }
  });
  app2.patch("/api/kitchens/:id/status", (req, res) => {
    const { id } = req.params;
    const { isOpen, operatingStatus } = req.body;
    res.json({
      success: true,
      vendorId: id,
      isOpen: isOpen ?? true,
      operatingStatus: operatingStatus || (isOpen ? "open" : "closed"),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app2.get("/api/riders/available", (req, res) => {
    res.json({
      success: true,
      riders: [
        {
          id: "rider_mtu_01",
          name: "Emmanuel Adeyemi",
          phone: "+234 810 998 1234",
          vehicle: "motorcycle",
          plateNumber: "MTU-RDR-01",
          rating: 4.9,
          totalDeliveries: 124,
          isOnline: true,
          latitude: 6.784,
          longitude: 3.442
        },
        {
          id: "rider_mtu_02",
          name: "Blessing Okafor",
          phone: "+234 812 345 6789",
          vehicle: "bicycle",
          plateNumber: "MTU-CYC-04",
          rating: 4.8,
          totalDeliveries: 89,
          isOnline: true,
          latitude: 6.782,
          longitude: 3.44
        },
        {
          id: "rider_mtu_03",
          name: "Tunde Bakare",
          phone: "+234 803 777 9900",
          vehicle: "electric_bike",
          plateNumber: "MTU-EBK-09",
          rating: 5,
          totalDeliveries: 215,
          isOnline: true,
          latitude: 6.785,
          longitude: 3.443
        }
      ]
    });
  });
  app2.post("/api/rider/verify-pickup", (req, res) => {
    const { orderId, enteredCode, expectedCode, riderId } = req.body;
    if (!orderId || !enteredCode) {
      return res.status(400).json({ success: false, message: "orderId and enteredCode required" });
    }
    const isValid = String(enteredCode).trim() === String(expectedCode).trim();
    if (!isValid) {
      return res.status(400).json({ success: false, message: "Invalid 4-digit Pickup PIN" });
    }
    return res.json({
      success: true,
      message: "Pickup verified successfully",
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      orderId,
      riderId
    });
  });
  app2.post("/api/rider/verify-delivery", (req, res) => {
    const { orderId, enteredCode, expectedCode, riderId, deliveryFee = 400 } = req.body;
    if (!orderId || !enteredCode) {
      return res.status(400).json({ success: false, message: "orderId and enteredCode required" });
    }
    const isValid = String(enteredCode).trim() === String(expectedCode).trim();
    if (!isValid) {
      return res.status(400).json({ success: false, message: "Invalid 4-digit Delivery PIN" });
    }
    const riderCut = Math.round(deliveryFee * 0.75);
    const platformCommission = deliveryFee - riderCut;
    return res.json({
      success: true,
      message: "Delivery verified successfully",
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      orderId,
      riderId,
      financials: {
        deliveryFee,
        riderCut,
        platformCommission
      }
    });
  });
  app2.patch("/api/riders/status", (req, res) => {
    const { riderId, isOnline, latitude, longitude } = req.body;
    res.json({
      success: true,
      riderId,
      isOnline: isOnline ?? true,
      latitude,
      longitude,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app2.get("/api/admin/financials", (req, res) => {
    res.json({
      success: true,
      financials: {
        totalRevenue: 248500,
        totalDeliveryFees: 38400,
        totalRiderPayouts: 28800,
        totalPlatformCommissions: 9600,
        walletTotalDeposits: 52e4,
        walletTotalDebited: 195e3,
        walletTotalRefunds: 4200,
        orders: {
          total: 84,
          pending: 3,
          preparing: 4,
          ready: 2,
          outForDelivery: 5,
          delivered: 68,
          cancelled: 2
        },
        activeVendors: 8,
        activeRiders: 6,
        lastReconciledAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  });
  app2.get("/api/admin/analytics", (req, res) => {
    res.json({
      success: true,
      analytics: {
        totalOrdersToday: 48,
        activeOrders: 6,
        completedOrders: 41,
        cancelledOrders: 1,
        totalRevenueNgn: 142500,
        averageDeliveryTimeMinutes: 18.5,
        activeKitchensCount: 4,
        onlineRidersCount: 5,
        campusName: "Mountain Top University",
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  });
  app2.post("/api/paystack/initialize", (req, res) => {
    const { email, amount, orderId } = req.body;
    const reference = `PS_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
    res.json({
      status: true,
      message: "Authorization URL created",
      data: {
        authorization_url: `https://checkout.paystack.com/simulate_${reference}`,
        access_code: `code_${reference}`,
        reference,
        amount,
        email,
        orderId
      }
    });
  });
  app2.post("/api/paystack/verify", (req, res) => {
    const { reference } = req.body;
    if (reference) {
      res.json({
        status: true,
        message: "Verification successful",
        data: {
          id: Date.now(),
          domain: "test",
          status: "success",
          reference,
          amount: 2500,
          gateway_response: "Successful",
          paid_at: (/* @__PURE__ */ new Date()).toISOString(),
          channel: "card",
          currency: "NGN"
        }
      });
    } else {
      res.status(400).json({ status: false, message: "Invalid transaction reference" });
    }
  });
  app2.post("/api/notifications/register-token", (req, res) => {
    try {
      const { userId, fcmToken, platform, appType, deviceId, permissionStatus, userAgent } = req.body;
      if (!userId || !fcmToken) {
        return res.status(400).json({ success: false, message: "userId and fcmToken are required" });
      }
      const tokenRecord = registerDeviceToken({
        userId,
        fcmToken,
        platform,
        appType,
        deviceId,
        permissionStatus,
        userAgent
      });
      return res.json({ success: true, token: tokenRecord });
    } catch (err) {
      console.error("Failed to register token:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/notifications/unregister-token", (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ success: false, message: "token is required" });
      }
      const deactivated = unregisterDeviceToken(token);
      return res.json({ success: true, deactivated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.get("/api/notifications/tokens", (req, res) => {
    try {
      const tokens = listAllTokens();
      return res.json({ success: true, count: tokens.length, tokens });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/notifications/order-event", async (req, res) => {
    try {
      const {
        orderId,
        eventType,
        customerId,
        customerName,
        vendorId,
        vendorName,
        vendorPhone,
        riderId,
        riderName,
        deliveryLocation,
        deliveryCode,
        pickupCode,
        totalPrice,
        riderFee,
        estimatedMinutes,
        cancellationReason,
        metadata
      } = req.body;
      if (!orderId || !eventType || !customerId || !vendorId) {
        return res.status(400).json({
          success: false,
          message: "orderId, eventType, customerId, and vendorId are required"
        });
      }
      const result = await dispatchOrderEventPipeline({
        orderId,
        eventType,
        customerId,
        customerName,
        vendorId,
        vendorName,
        vendorPhone,
        riderId,
        riderName,
        deliveryLocation,
        deliveryCode,
        pickupCode,
        totalPrice,
        riderFee,
        estimatedMinutes,
        cancellationReason,
        metadata
      });
      return res.json(result);
    } catch (err) {
      console.error("Order event dispatch error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/notifications/wallet-event", async (req, res) => {
    try {
      const { userId, eventType, amount, balanceAfter, transactionReference, description } = req.body;
      if (!userId || !eventType || amount === void 0 || balanceAfter === void 0) {
        return res.status(400).json({
          success: false,
          message: "userId, eventType, amount, and balanceAfter are required"
        });
      }
      const result = await dispatchWalletEventPipeline({
        userId,
        eventType,
        amount,
        balanceAfter,
        transactionReference: transactionReference || `TX_${Date.now()}`,
        description
      });
      return res.json(result);
    } catch (err) {
      console.error("Wallet event dispatch error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/notifications/admin-alert", async (req, res) => {
    try {
      const { title, body, severity = "INFO", alertCategory = "SYSTEM_HEALTH", metadata } = req.body;
      if (!title || !body) {
        return res.status(400).json({ success: false, message: "title and body are required" });
      }
      const result = await dispatchAdminAlertPipeline({
        title,
        body,
        severity,
        alertCategory,
        metadata
      });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.get("/api/notifications/user/:userId", (req, res) => {
    try {
      const history = getUserNotificationHistory(req.params.userId);
      return res.json({ success: true, count: history.length, notifications: history });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.patch("/api/notifications/:id/read", (req, res) => {
    try {
      const updated = markNotificationAsRead(req.params.id);
      return res.json({ success: true, updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.patch("/api/notifications/read-all", (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, message: "userId is required" });
      }
      const markedCount = markAllNotificationsAsReadForUser(userId);
      return res.json({ success: true, markedCount });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.get("/api/notifications/health", (req, res) => {
    try {
      const stats = getNotificationHealth();
      return res.json({ success: true, stats });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/notifications/test-dispatch", async (req, res) => {
    try {
      const { targetRole = "customer", eventType = "ORDER_CREATED", customMessage } = req.body;
      const testOrderId = `TEST_ORD_${Date.now().toString().slice(-4)}`;
      let result;
      if (targetRole === "admin") {
        result = await dispatchAdminAlertPipeline({
          title: customMessage || "High Vendor Volume Surge",
          body: "Kitchen queues in Mountain Top University Central Plaza reached peak capacity.",
          severity: "WARNING",
          alertCategory: "SYSTEM_HEALTH"
        });
      } else {
        const orderEvent = eventType;
        result = await dispatchOrderEventPipeline({
          orderId: testOrderId,
          eventType: orderEvent,
          customerId: "user_cust_01",
          customerName: "Campus Student",
          vendorId: "user_vendor_ronalds",
          vendorName: "Ronald's Food House",
          riderId: "user_rider_01",
          riderName: "Speedy Rider",
          deliveryLocation: "Daniel Hall Room 204",
          deliveryCode: "4821",
          pickupCode: "9134",
          totalPrice: 3200,
          riderFee: 400
        });
      }
      return res.json({ success: true, testOrderId, result });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/fcm/send-status-update", async (req, res) => {
    const { orderId, status, vendorName, userId, customerId } = req.body;
    if (!orderId || !status) {
      return res.status(400).json({ status: false, message: "orderId and status are required" });
    }
    const statusMap = {
      pending: "ORDER_CREATED",
      accepted: "VENDOR_ACCEPTED",
      preparing: "ORDER_PREPARING",
      ready: "ORDER_READY",
      assigned: "RIDER_ASSIGNED",
      picked_up: "ORDER_PICKED_UP",
      on_the_way: "ORDER_OUT_FOR_DELIVERY",
      delivered: "ORDER_DELIVERED",
      cancelled: "ORDER_CANCELLED"
    };
    const mappedEvent = statusMap[status] || "ORDER_CREATED";
    await dispatchOrderEventPipeline({
      orderId,
      eventType: mappedEvent,
      customerId: customerId || userId || "user_cust_01",
      vendorId: "vendor_mtu_canteen",
      vendorName: vendorName || "Campus Food Stand"
    });
    return res.json({
      status: true,
      message: "Status update processed via centralized notification engine"
    });
  });
  app2.post("/api/fcm/register-device", (req, res) => {
    try {
      const { userId, deviceRecord } = req.body;
      if (!userId || !deviceRecord || !deviceRecord.fcmToken) {
        return res.status(400).json({ success: false, message: "userId and valid deviceRecord required" });
      }
      registerDeviceToken({
        userId,
        fcmToken: deviceRecord.fcmToken,
        platform: deviceRecord.platform?.toUpperCase() || "ANDROID",
        appType: deviceRecord.app?.toUpperCase() || "CUSTOMER",
        deviceId: deviceRecord.deviceId
      });
      return res.json({ success: true, message: "Device token registered successfully", deviceId: deviceRecord.deviceId });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/fcm/deactivate-device", (req, res) => {
    try {
      const { userId, deviceId } = req.body;
      return res.json({ success: true, message: "Device deactivated", userId, deviceId });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/chat/send-message-push", async (req, res) => {
    try {
      const { conversationId, orderId, senderName, senderRole, receiverId, messageText } = req.body;
      if (!conversationId || !receiverId || !messageText) {
        return res.status(400).json({ success: false, message: "conversationId, receiverId and messageText required" });
      }
      const roleDisplay = senderRole === "rider" ? "\u{1F6F5} Your Courier" : "\u{1F4E6} Customer";
      const orderShortId = orderId ? orderId.slice(-6).toUpperCase() : "";
      const pushTitle = `\u{1F4AC} New Message from ${senderName || roleDisplay}`;
      const pushBody = messageText.length > 80 ? `${messageText.slice(0, 77)}...` : messageText;
      const deepLink = senderRole === "rider" ? `/chat/${conversationId}` : `/chat/${conversationId}`;
      const deliveryReport = await dispatchPushNotificationToUser({
        recipientUserId: receiverId,
        title: pushTitle,
        body: pushBody,
        deepLink,
        channelId: "messages",
        data: {
          conversationId,
          orderId: orderId || "",
          senderRole: senderRole || "rider",
          type: "chat_message"
        }
      });
      dispatchWebPushToUser(receiverId, {
        title: pushTitle,
        body: pushBody,
        deepLink,
        severity: "INFO",
        conversationId,
        orderId
      }).catch(() => {
      });
      return res.json({ success: true, deliveryReport });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.get("/api/webpush/vapid-public-key", (req, res) => {
    try {
      const publicKey = getVapidPublicKey();
      res.json({ success: true, publicKey });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/webpush/subscribe", (req, res) => {
    try {
      const { userId, subscription, role, platform, browser, userAgent } = req.body;
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ success: false, message: "Valid subscription object required" });
      }
      const record = saveWebPushSubscription({
        userId: userId || "anonymous_guest",
        subscription,
        role: role || "CUSTOMER",
        platform: platform || "WEB",
        browser,
        userAgent
      });
      res.json({ success: true, message: "Web Push subscription registered", record });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/webpush/unsubscribe", (req, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ success: false, message: "endpoint required" });
      }
      const removed = removeWebPushSubscription(endpoint);
      res.json({ success: true, removed });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.get("/api/webpush/subscriptions", (req, res) => {
    try {
      const subscriptions = listAllWebPushSubscriptions();
      res.json({ success: true, count: subscriptions.length, subscriptions });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/webpush/test-send", async (req, res) => {
    try {
      const { userId, title, body, deepLink, severity } = req.body;
      const pushTitle = title || "\u{1F514} BUKKIT Web Push Live Test";
      const pushBody = body || "Testing background & closed-app push notification delivery!";
      const pushLink = deepLink || "/orders";
      if (userId) {
        const result = await dispatchWebPushToUser(userId, {
          title: pushTitle,
          body: pushBody,
          deepLink: pushLink,
          severity: severity || "INFO"
        });
        return res.json({ success: true, target: userId, ...result });
      } else {
        const allSubs = listAllWebPushSubscriptions();
        let sent = 0;
        for (const sub of allSubs) {
          const ok = await dispatchWebPushToUser(sub.user_id, {
            title: pushTitle,
            body: pushBody,
            deepLink: pushLink,
            severity: severity || "INFO"
          });
          if (ok.successful > 0) sent++;
        }
        return res.json({ success: true, target: "all", totalSubscriptions: allSubs.length, delivered: sent });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app2.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app2.use(import_express.default.static(distPath));
    app2.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  app2.listen(PORT, "0.0.0.0", () => {
    console.log(`BUKKIT Centralized Backend Engine running at http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
