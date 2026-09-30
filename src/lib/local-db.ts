/**
 * Lightweight localStorage-backed replacement for Supabase tables.
 * Keeps the demo app usable without a backend.
 */

export type Row = Record<string, any>;

function key(table: string) {
  return `choremate:${table}`;
}

function read(table: string): Row[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key(table)) || "[]");
  } catch {
    return [];
  }
}

function write(table: string, rows: Row[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(table), JSON.stringify(rows));
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function matches(row: Row, filters: Filter[]) {
  return filters.every(({ column, op, value }) => {
    const cell = row[column];
    if (op === "eq") return cell === value;
    if (op === "in") return Array.isArray(value) && value.includes(cell);
    return true;
  });
}

interface Filter {
  column: string;
  op: "eq" | "in";
  value: any;
}

interface Order {
  column: string;
  ascending: boolean;
}

export interface QueryBuilder<T = Row> {
  select: (columns?: string) => QueryBuilder<T>;
  eq: (column: string, value: any) => QueryBuilder<T>;
  in: (column: string, values: any[]) => QueryBuilder<T>;
  order: (column: string, opts?: { ascending?: boolean }) => QueryBuilder<T>;
  limit: (n: number) => QueryBuilder<T>;
  maybeSingle: () => Promise<{ data: T | null; error: null }>;
  single: () => Promise<{ data: T | null; error: Error | null }>;
  insert: (rows: Row | Row[]) => Promise<{ data: T[] | null; error: null }>;
  update: (patch: Row) => Promise<{ data: T[] | null; error: null }>;
  upsert: (row: Row) => Promise<{ data: T[] | null; error: null }>;
  delete: () => Promise<{ error: null }>;
  rpc: (fn: string, params?: Record<string, any>) => Promise<{ data: any; error: null }>;
}

export function from<T = Row>(table: string): QueryBuilder<T> {
  let filters: Filter[] = [];
  let orders: Order[] = [];
  let limitCount: number | undefined;
  let singleMode: "maybe" | "required" | false = false;

  const builder: QueryBuilder<T> = {
    select: () => builder,
    eq: (column, value) => {
      filters.push({ column, op: "eq", value });
      return builder;
    },
    in: (column, values) => {
      filters.push({ column, op: "in", value: values });
      return builder;
    },
    order: (column, opts = {}) => {
      orders.push({ column, ascending: opts.ascending ?? true });
      return builder;
    },
    limit: (n) => {
      limitCount = n;
      return builder;
    },
    maybeSingle: () => {
      singleMode = "maybe";
      return execute();
    },
    single: () => {
      singleMode = "required";
      return execute();
    },
    insert: async (rows) => {
      const input = Array.isArray(rows) ? rows : [rows];
      const stored = read(table);
      const created = input.map((r) => ({ ...r, id: r.id || uid() }));
      stored.push(...created);
      write(table, stored);
      return { data: created as T[], error: null };
    },
    update: async (patch) => {
      const stored = read(table);
      let updated: Row[] = [];
      const next = stored.map((row) => {
        if (matches(row, filters)) {
          const u = { ...row, ...patch };
          updated.push(u);
          return u;
        }
        return row;
      });
      write(table, next);
      return { data: updated as T[], error: null };
    },
    upsert: async (row) => {
      const stored = read(table);
      const idx = row.id ? stored.findIndex((r) => r.id === row.id) : -1;
      if (idx >= 0) {
        stored[idx] = { ...stored[idx], ...row };
        write(table, stored);
        return { data: [stored[idx]!] as T[], error: null };
      }
      const created = { ...row, id: row.id || uid() };
      stored.push(created);
      write(table, stored);
      return { data: [created] as T[], error: null };
    },
    delete: async () => {
      const stored = read(table);
      write(
        table,
        stored.filter((row) => !matches(row, filters)),
      );
      return { error: null };
    },
    rpc: async (fn, params = {}) => {
      if (fn === "join_household_by_code") {
        const households = read("households");
        const hh = households.find((h) => h.invite_code === params._code);
        if (!hh) return { data: null, error: null };
        const members = read("household_members");
        const userId = getDemoUserId();
        const already = members.find((m) => m.household_id === hh.id && m.user_id === userId);
        if (!already) {
          members.push({
            id: uid(),
            household_id: hh.id,
            user_id: userId,
            color: "teal",
            joined_at: new Date().toISOString(),
          });
          write("household_members", members);
        }
        return { data: hh.id, error: null };
      }
      return { data: null, error: null };
    },
  };

  async function execute(): Promise<any> {
    let rows = read(table).filter((row) => matches(row, filters));
    for (const o of orders) {
      rows.sort((a, b) => {
        const av = a[o.column];
        const bv = b[o.column];
        if (av == null && bv == null) return 0;
        if (av == null) return o.ascending ? 1 : -1;
        if (bv == null) return o.ascending ? -1 : 1;
        if (av < bv) return o.ascending ? -1 : 1;
        if (av > bv) return o.ascending ? 1 : -1;
        return 0;
      });
    }
    if (limitCount !== undefined) rows = rows.slice(0, limitCount);
    if (singleMode === "maybe") return { data: rows[0] || null, error: null };
    if (singleMode === "required") {
      return { data: rows[0] || null, error: rows[0] ? null : new Error("No rows found") };
    }
    return { data: rows as T[], error: null };
  }

  return builder;
}

let _demoUserId = "";

export function getDemoUserId(): string {
  if (typeof window === "undefined") return "demo-user";
  if (!_demoUserId) {
    _demoUserId = localStorage.getItem("choremate:demoUserId") || uid();
    localStorage.setItem("choremate:demoUserId", _demoUserId);
  }
  return _demoUserId;
}

export function resetDemoData() {
  if (typeof window === "undefined") return;
  const tables = ["households", "household_members", "profiles", "chores", "assignments", "swap_requests"];
  tables.forEach((t) => localStorage.removeItem(key(t)));
  localStorage.removeItem("choremate:demoUserId");
  _demoUserId = "";
}
