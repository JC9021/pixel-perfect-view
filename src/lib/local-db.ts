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

type Mode = "select" | "insert" | "update" | "upsert" | "delete";

class Query<T = Row> {
  private table: string;
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitCount: number | undefined;
  private mode: Mode = "select";
  private insertRows: Row[] | undefined;
  private updatePatch: Row | undefined;
  private returnData = false;

  constructor(table: string) {
    this.table = table;
  }

  select(_columns?: string): this {
    this.mode = "select";
    this.returnData = true;
    return this;
  }

  eq(column: string, value: any): this {
    this.filters.push({ column, op: "eq", value });
    return this;
  }

  in(column: string, values: any[]): this {
    this.filters.push({ column, op: "in", value: values });
    return this;
  }

  order(column: string, opts: { ascending?: boolean } = {}): this {
    this.orders.push({ column, ascending: opts.ascending ?? true });
    return this;
  }

  limit(n: number): this {
    this.limitCount = n;
    return this;
  }

  insert(rows: Row | Row[]): this {
    this.mode = "insert";
    this.insertRows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(patch: Row): this {
    this.mode = "update";
    this.updatePatch = patch;
    return this;
  }

  upsert(row: Row): this {
    this.mode = "upsert";
    this.insertRows = [row];
    return this;
  }

  delete(): this {
    this.mode = "delete";
    return this;
  }

  rpc(_fn: string, params?: Record<string, any>): Promise<{ data: any; error: null }> {
    if (this.table === "" && params?._code) {
      const households = read("households");
      const hh = households.find((h) => h.invite_code === params._code);
      if (!hh) return Promise.resolve({ data: null, error: null });
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
      return Promise.resolve({ data: hh.id, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }

  maybeSingle(): Promise<{ data: T | null; error: null }> {
    return this.executeSingle("maybe") as any;
  }

  single(): Promise<{ data: T | null; error: Error | null }> {
    return this.executeSingle("required") as any;
  }

  private executeSingle(kind: "maybe" | "required"): Promise<{ data: any; error: any }> {
    return this.run().then((rows) => {
      const data = rows[0] || null;
      if (kind === "required" && !data) {
        return { data: null, error: new Error("No rows found") };
      }
      return { data, error: null };
    });
  }

  private run(): Promise<T[]> {
    if (this.mode === "insert") {
      const stored = read(this.table);
      const created = (this.insertRows ?? []).map((r) => ({ ...r, id: r.id || uid() }));
      stored.push(...created);
      write(this.table, stored);
      return Promise.resolve(created as T[]);
    }

    if (this.mode === "upsert") {
      const stored = read(this.table);
      const row = this.insertRows?.[0];
      if (!row) return Promise.resolve([]);
      const idx = row.id ? stored.findIndex((r) => r.id === row.id) : -1;
      if (idx >= 0) {
        stored[idx] = { ...stored[idx], ...row };
        write(this.table, stored);
        return Promise.resolve([stored[idx]!] as T[]);
      }
      const created = { ...row, id: row.id || uid() };
      stored.push(created);
      write(this.table, stored);
      return Promise.resolve([created] as T[]);
    }

    if (this.mode === "update") {
      const stored = read(this.table);
      const patch = this.updatePatch ?? {};
      const updated: Row[] = [];
      const next = stored.map((row) => {
        if (matches(row, this.filters)) {
          const u = { ...row, ...patch };
          updated.push(u);
          return u;
        }
        return row;
      });
      write(this.table, next);
      return Promise.resolve(updated as T[]);
    }

    if (this.mode === "delete") {
      const stored = read(this.table);
      write(
        this.table,
        stored.filter((row) => !matches(row, this.filters)),
      );
      return Promise.resolve([]);
    }

    let rows = read(this.table).filter((row) => matches(row, this.filters));
    for (const o of this.orders) {
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
    if (this.limitCount !== undefined) rows = rows.slice(0, this.limitCount);
    return Promise.resolve(rows as T[]);
  }

  // Make the query thenable so `await query` works like `.select()` by default.
  then<TResult1 = { data: T[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[]; error: null }) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    return this.run().then((rows) => ({ data: rows, error: null })).then(onfulfilled, onrejected);
  }
}

export type QueryBuilder<T = Row> = Query<T>;

export function from<T = Row>(table: string): QueryBuilder<T> {
  return new Query<T>(table);
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
