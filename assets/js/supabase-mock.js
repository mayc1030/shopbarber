// =========================================================================
// EMULADOR LOCAL DE SUPABASE (Solo activo en localhost / 127.0.0.1)
// Simula Auth, PostgREST (tablas, filtros, joins, upsert) y Storage.
// =========================================================================
(function () {
  const STORAGE_DB_KEY = "shopbarber_mock_db_v2";
  const STORAGE_SESSION_KEY = "shopbarber_mock_session_v2";
  const MOCK_API_BASE = "/mock-supabase";

  function localDateOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function generateUuid(prefix = "00000000-0000-4000-8000-") {
    const rand = Math.random().toString(16).slice(2, 14).padEnd(12, "0");
    return prefix + rand;
  }

  function createSeedDb() {
    const now = new Date().toISOString();
    const today = localDateOffset(0);
    const tomorrow = localDateOffset(1);

    const adminJuanId = "11111111-1111-4111-8111-111111111111";
    const adminDemoId = "22222222-2222-4222-8222-222222222222";
    const barberCarlosUserId = "33333333-3333-4333-8333-333333333333";
    const barberSofiaUserId = "44444444-4444-4444-8444-444444444444";

    return {
      _meta: { nextIds: { barbers: 3, services: 4, appointments: 5 } },
      users: [
        { id: adminJuanId, email: "juan@losangelesbarber.com", password: "123456*" },
        { id: adminDemoId, email: "admin@barberia.com", password: "123456" },
        { id: barberCarlosUserId, email: "carlos@losangelesbarber.com", password: "123456" },
        { id: barberSofiaUserId, email: "sofia@losangelesbarber.com", password: "123456" }
      ],
      profiles: [
        { id: adminJuanId, is_admin: true, created_at: now },
        { id: adminDemoId, is_admin: true, created_at: now },
        { id: barberCarlosUserId, is_admin: false, created_at: now },
        { id: barberSofiaUserId, is_admin: false, created_at: now }
      ],
      barbers: [
        {
          id: 1,
          user_id: barberCarlosUserId,
          login_email: "carlos@losangelesbarber.com",
          name: "Carlos Gómez",
          photo_url: "/assets/img/barber.png",
          bio: "Especialista en degradados limpios, corte clásico y perfilado de barba con 8 años de experiencia.",
          specialties: ["Fade", "Corte Clásico", "Barba"],
          active: true,
          created_at: now
        },
        {
          id: 2,
          user_id: barberSofiaUserId,
          login_email: "sofia@losangelesbarber.com",
          name: "Sofía Martínez",
          photo_url: "/assets/img/barbera.png",
          bio: "Estilista profesional enfocada en diseño moderno, navaja libre y ritual de toalla caliente.",
          specialties: ["Diseño", "Navaja", "Ritual Barba"],
          active: true,
          created_at: now
        }
      ],
      services: [
        {
          id: 1,
          name: "Corte de Cabello Tradicional",
          duration_minutes: 30,
          price: 25000,
          description: "Lavado, corte clásico o degradado y peinado con cera premium.",
          active: true,
          created_at: now
        },
        {
          id: 2,
          name: "Afeitado o Perfilado de Barba",
          duration_minutes: 25,
          price: 18000,
          description: "Ritual de toalla caliente, afeitado con navaja libre y bálsamo hidratante.",
          active: true,
          created_at: now
        },
        {
          id: 3,
          name: "Combo Corte + Barba",
          duration_minutes: 50,
          price: 38000,
          description: "El paquete completo para lucir impecable.",
          active: true,
          created_at: now
        }
      ],
      appointments: [
        {
          id: 1,
          client_name: "Mateo Rivera",
          client_phone: "3001112233",
          client_email: "mateo@ejemplo.com",
          barber_id: 1,
          service_id: 3,
          appointment_date: today,
          appointment_time: "10:00:00",
          status: "scheduled",
          created_at: now
        },
        {
          id: 2,
          client_name: "Andrés López",
          client_phone: "3104445566",
          client_email: null,
          barber_id: 1,
          service_id: 1,
          appointment_date: today,
          appointment_time: "11:00:00",
          status: "pending",
          created_at: now
        },
        {
          id: 3,
          client_name: "Daniel Torres",
          client_phone: "3207778899",
          client_email: "daniel@ejemplo.com",
          barber_id: 2,
          service_id: 2,
          appointment_date: today,
          appointment_time: "09:30:00",
          status: "completed",
          created_at: now
        },
        {
          id: 4,
          client_name: "Luis Fernández",
          client_phone: "3159990011",
          client_email: null,
          barber_id: 2,
          service_id: 1,
          appointment_date: tomorrow,
          appointment_time: "15:00:00",
          status: "pending",
          created_at: now
        }
      ],
      settings: [
        { id: "hero_subtitle", value: "Corte & Estilo Premium" },
        { id: "hero_title", value: "Refina Tu Estilo Diario" },
        { id: "hero_desc", value: "Agenda tu turno en segundos con barberos profesionales altamente calificados." },
        { id: "info_address", value: "Av. Principal 123, Centro de la Ciudad" },
        { id: "info_hours_wk", value: "Lunes a Sábado: 9:00 AM - 7:00 PM" },
        { id: "info_hours_we", value: "Domingos: Cerrado" },
        { id: "social_whatsapp", value: "573001234567" },
        { id: "social_instagram", value: "https://instagram.com/losangelesbarber" },
        { id: "facebook_url", value: "https://facebook.com/losangelesbarber" },
        { id: "schedule_start", value: "09:00" },
        { id: "schedule_end", value: "18:00" },
        { id: "schedule_interval", value: "30" },
        { id: "closed_days", value: "[0]" },
        { id: "gallery_images", value: JSON.stringify(["/assets/img/barber.png", "/assets/img/barbera.png"]) }
      ]
    };
  }

  let dbCache = null;
  let loadPromise = null;
  const uploadedUrls = {};

  async function ensureLoaded() {
    if (dbCache) return dbCache;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      try {
        const res = await fetch(`${MOCK_API_BASE}/db`, { cache: "no-store" });
        if (res.ok) {
          const remote = await res.json();
          if (remote && !remote.empty && Array.isArray(remote.services)) {
            dbCache = remote;
            try { localStorage.setItem(STORAGE_DB_KEY, JSON.stringify(dbCache)); } catch (_) {}
            return dbCache;
          }
        }
      } catch (_) {}

      try {
        const raw = localStorage.getItem(STORAGE_DB_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.services)) {
            dbCache = parsed;
            return dbCache;
          }
        }
      } catch (_) {}

      dbCache = createSeedDb();
      await saveDb();
      return dbCache;
    })();

    try {
      return await loadPromise;
    } finally {
      loadPromise = null;
    }
  }

  async function saveDb() {
    if (!dbCache) return;
    try {
      localStorage.setItem(STORAGE_DB_KEY, JSON.stringify(dbCache));
    } catch (_) {}
    try {
      await fetch(`${MOCK_API_BASE}/db`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dbCache)
      });
    } catch (_) {}
  }

  function clone(val) {
    return JSON.parse(JSON.stringify(val));
  }

  function pickColumns(obj, colsStr) {
    if (!obj) return null;
    const trimmed = colsStr.trim();
    if (trimmed === "*") return clone(obj);
    const out = {};
    trimmed.split(",").forEach((c) => {
      const key = c.trim();
      if (key && key in obj) out[key] = clone(obj[key]);
    });
    return out;
  }

  function applySelectProjection(tableName, rows, selectStr) {
    const raw = (selectStr || "*").trim();
    const relations = [];
    const stripped = raw.replace(/([A-Za-z0-9_]+)\s*\(([^)]+)\)/g, (_, relName, relCols) => {
      relations.push({ name: relName.trim(), cols: relCols.trim() });
      return "";
    });

    const scalarCols = stripped
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const includeAll = scalarCols.length === 0 || scalarCols.includes("*");

    return rows.map((row) => {
      const base = includeAll ? clone(row) : pickColumns(row, scalarCols.join(","));

      relations.forEach((rel) => {
        if (tableName === "appointments" && rel.name === "barbers") {
          const target = (dbCache.barbers || []).find((b) => String(b.id) === String(row.barber_id));
          base.barbers = pickColumns(target, rel.cols);
        } else if (tableName === "appointments" && rel.name === "services") {
          const target = (dbCache.services || []).find((s) => String(s.id) === String(row.service_id));
          base.services = pickColumns(target, rel.cols);
        }
      });

      return base;
    });
  }

  class MockQueryBuilder {
    constructor(tableName) {
      this.tableName = tableName;
      this.operation = "select";
      this.selectCols = "*";
      this.payload = null;
      this.filters = [];
      this.orders = [];
      this.expectMode = null; // "single" | "maybeSingle"
    }

    select(cols = "*") {
      if (this.operation === "select") {
        this.selectCols = cols;
      } else {
        // Encadenado tras insert/update/upsert: devolver filas modificadas
        this.selectCols = cols;
      }
      return this;
    }

    insert(rows) {
      this.operation = "insert";
      this.payload = Array.isArray(rows) ? rows : [rows];
      return this;
    }

    update(patch) {
      this.operation = "update";
      this.payload = patch;
      return this;
    }

    upsert(rows) {
      this.operation = "upsert";
      this.payload = Array.isArray(rows) ? rows : [rows];
      return this;
    }

    delete() {
      this.operation = "delete";
      return this;
    }

    eq(col, val) {
      this.filters.push((row) => {
        if (typeof val === "boolean") return Boolean(row[col]) === val;
        return String(row[col]) === String(val);
      });
      return this;
    }

    neq(col, val) {
      this.filters.push((row) => String(row[col]) !== String(val));
      return this;
    }

    gte(col, val) {
      this.filters.push((row) => row[col] >= val);
      return this;
    }

    lte(col, val) {
      this.filters.push((row) => row[col] <= val);
      return this;
    }

    order(col, opts = {}) {
      this.orders.push({ col, ascending: opts.ascending !== false });
      return this;
    }

    single() {
      this.expectMode = "single";
      return this;
    }

    maybeSingle() {
      this.expectMode = "maybeSingle";
      return this;
    }

    then(resolve, reject) {
      return this._execute().then(resolve, reject);
    }

    async _execute() {
      const db = await ensureLoaded();
      const table = db[this.tableName];
      if (!Array.isArray(table)) {
        return { data: null, error: { message: `Tabla simulada no encontrada: ${this.tableName}` } };
      }

      const matchesAll = (row) => this.filters.every((fn) => fn(row));

      if (this.operation === "select") {
        let rows = table.filter(matchesAll);

        if (this.orders.length > 0) {
          rows = rows.slice().sort((a, b) => {
            for (const ord of this.orders) {
              const av = a[ord.col];
              const bv = b[ord.col];
              if (av === bv) continue;
              if (av == null) return 1;
              if (bv == null) return -1;
              const cmp = av < bv ? -1 : 1;
              return ord.ascending ? cmp : -cmp;
            }
            return 0;
          });
        }

        const projected = applySelectProjection(this.tableName, rows, this.selectCols);

        if (this.expectMode === "single") {
          if (projected.length !== 1) {
            return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned" } };
          }
          return { data: projected[0], error: null };
        }

        if (this.expectMode === "maybeSingle") {
          if (projected.length > 1) {
            return { data: null, error: { message: "Multiple rows returned" } };
          }
          return { data: projected[0] || null, error: null };
        }

        return { data: projected, error: null };
      }

      if (this.operation === "insert") {
        const inserted = [];
        for (const item of this.payload) {
          const row = clone(item);
          if (this.tableName === "appointments" && row.status !== "cancelled") {
            const conflict = table.some(
              (existing) =>
                existing.status !== "cancelled" &&
                String(existing.barber_id) === String(row.barber_id) &&
                existing.appointment_date === row.appointment_date &&
                String(existing.appointment_time).slice(0, 5) === String(row.appointment_time).slice(0, 5)
            );
            if (conflict) {
              return {
                data: null,
                error: { code: "23505", message: "duplicate key value violates unique constraint" }
              };
            }
          }
          if (!("id" in row) && this.tableName !== "settings" && this.tableName !== "profiles") {
            const nextMap = db._meta.nextIds;
            const nextId = nextMap[this.tableName] || 1;
            nextMap[this.tableName] = nextId + 1;
            row.id = nextId;
          }
          if (!row.created_at && this.tableName !== "settings") {
            row.created_at = new Date().toISOString();
          }
          table.push(row);
          inserted.push(clone(row));
        }
        await saveDb();
        return { data: inserted, error: null };
      }

      if (this.operation === "update") {
        const updated = [];
        for (let i = 0; i < table.length; i++) {
          if (matchesAll(table[i])) {
            table[i] = { ...table[i], ...clone(this.payload) };
            updated.push(clone(table[i]));
          }
        }
        await saveDb();
        return { data: updated, error: null };
      }

      if (this.operation === "upsert") {
        const affected = [];
        for (const item of this.payload) {
          const row = clone(item);
          const idx = table.findIndex((existing) => String(existing.id) === String(row.id));
          if (idx >= 0) {
            table[idx] = { ...table[idx], ...row };
            affected.push(clone(table[idx]));
          } else {
            table.push(row);
            affected.push(clone(row));
          }
        }
        await saveDb();
        return { data: affected, error: null };
      }

      if (this.operation === "delete") {
        const kept = [];
        const deleted = [];
        for (const row of table) {
          if (matchesAll(row)) deleted.push(clone(row));
          else kept.push(row);
        }
        db[this.tableName] = kept;
        await saveDb();
        return { data: deleted, error: null };
      }

      return { data: null, error: { message: "Operación no soportada" } };
    }
  }

  function readSession() {
    try {
      const raw = localStorage.getItem(STORAGE_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeSession(session) {
    try {
      if (session) localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(STORAGE_SESSION_KEY);
    } catch (_) {}
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.readAsDataURL(file);
    });
  }

  function createMockClient(_url, _key, options = {}) {
    const persistSession = !options.auth || options.auth.persistSession !== false;

    return {
      auth: {
        async getSession() {
          await ensureLoaded();
          return { data: { session: readSession() }, error: null };
        },
        async signInWithPassword({ email, password }) {
          const db = await ensureLoaded();
          const normalized = String(email || "").trim().toLowerCase();
          const found = db.users.find(
            (u) => u.email.toLowerCase() === normalized && u.password === password
          );
          if (!found) {
            return {
              data: { user: null, session: null },
              error: { message: "Credenciales inválidas (modo local simulado)" }
            };
          }
          const user = { id: found.id, email: found.email };
          const session = { access_token: "mock-token", user };
          if (persistSession) writeSession(session);
          return { data: { user, session }, error: null };
        },
        async signUp({ email, password }) {
          const db = await ensureLoaded();
          const normalized = String(email || "").trim().toLowerCase();
          if (db.users.some((u) => u.email.toLowerCase() === normalized)) {
            return {
              data: { user: null, session: null },
              error: { message: "User already registered" }
            };
          }
          const newId = generateUuid();
          const newUser = { id: newId, email: normalized, password };
          db.users.push(newUser);
          db.profiles.push({
            id: newId,
            is_admin: false,
            created_at: new Date().toISOString()
          });
          await saveDb();

          const publicUser = { id: newId, email: normalized };
          const session = persistSession ? { access_token: "mock-token", user: publicUser } : null;
          if (persistSession) writeSession(session);
          return { data: { user: publicUser, session }, error: null };
        },
        async signOut() {
          if (persistSession) writeSession(null);
          return { error: null };
        }
      },
      from(tableName) {
        return new MockQueryBuilder(tableName);
      },
      async rpc(fnName, params = {}) {
        const db = await ensureLoaded();
        if (fnName === "get_busy_slots") {
          const rows = (db.appointments || [])
            .filter(
              (a) =>
                String(a.barber_id) === String(params.p_barber_id) &&
                a.appointment_date === params.p_date &&
                a.status !== "cancelled"
            )
            .map((a) => {
              const svc = (db.services || []).find((s) => String(s.id) === String(a.service_id));
              return {
                appointment_time: a.appointment_time,
                duration_minutes: svc ? Number(svc.duration_minutes) || 30 : 30
              };
            });
          return { data: rows, error: null };
        }
        return { data: null, error: { message: `RPC simulada no soportada: ${fnName}` } };
      },
      storage: {
        from(bucket) {
          return {
            async upload(fileName, file) {
              const cacheKey = `${bucket}/${fileName}`;
              try {
                const res = await fetch(
                  `${MOCK_API_BASE}/storage/${encodeURIComponent(bucket)}/${encodeURIComponent(fileName)}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": file.type || "application/octet-stream" },
                    body: file
                  }
                );
                if (res.ok) {
                  uploadedUrls[cacheKey] = `${window.location.origin}${MOCK_API_BASE}/storage/${encodeURIComponent(bucket)}/${encodeURIComponent(fileName)}`;
                  return { data: { path: fileName }, error: null };
                }
              } catch (_) {}

              // Fallback en memoria / DataURL si el servidor no expone /mock-supabase/storage
              uploadedUrls[cacheKey] = await fileToDataUrl(file);
              return { data: { path: fileName }, error: null };
            },
            getPublicUrl(fileName) {
              const cacheKey = `${bucket}/${fileName}`;
              const publicUrl =
                uploadedUrls[cacheKey] ||
                `${window.location.origin}${MOCK_API_BASE}/storage/${encodeURIComponent(bucket)}/${encodeURIComponent(fileName)}`;
              return { data: { publicUrl } };
            }
          };
        }
      }
    };
  }

  window.MockSupabaseLib = {
    createClient: createMockClient,
    async resetMockDb() {
      dbCache = createSeedDb();
      writeSession(null);
      await saveDb();
      return dbCache;
    }
  };
})();
