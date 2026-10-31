import { Db, Collection, Filter } from "mongodb";

/**
 * High-fidelity in-memory MongoDB test double implementing Db and Collection interfaces.
 * Allows exhaustive integration testing of MongoAccountsRepository, MongoCasesRepository,
 * and MongoInvestigationsRepository without requiring network access or external binary downloads.
 */
export class InMemoryMongoDb {
  private collections: Map<string, any[]> = new Map();
  public pingShouldFail = false;

  public getDb(): Db {
    return {
      collection: (name: string) => this.getCollection(name) as unknown as Collection<any>,
      command: async (cmd: any) => {
        if (cmd.ping) {
          if (this.pingShouldFail) {
            throw new Error("Simulated MongoDB ping failure (connection refused)");
          }
          return { ok: 1 };
        }
        return { ok: 1 };
      },
    } as unknown as Db;
  }

  public getCollection(name: string): any {
    if (!this.collections.has(name)) {
      this.collections.set(name, []);
    }
    const docs = this.collections.get(name)!;

    return {
      createIndex: async (_spec: any, _opts?: any) => "index_ok",
      countDocuments: async (filter?: Filter<any>) => {
        return this.matchFilter(docs, filter || {}).length;
      },
      findOne: async (filter: Filter<any>, opts?: any) => {
        const matches = this.matchFilter(docs, filter);
        if (matches.length === 0) return null;
        return this.project(matches[0], opts?.projection);
      },
      find: (filter: Filter<any>, opts?: any) => {
        let results = this.matchFilter(docs, filter);

        const cursor = {
          sort: (sortSpec: Record<string, number>) => {
            const [key, dir] = Object.entries(sortSpec)[0] || [];
            if (key) {
              results.sort((a, b) => {
                if (a[key] < b[key]) return dir === 1 ? -1 : 1;
                if (a[key] > b[key]) return dir === 1 ? 1 : -1;
                return 0;
              });
            }
            return cursor;
          },
          skip: (n: number) => {
            results = results.slice(n);
            return cursor;
          },
          limit: (n: number) => {
            results = results.slice(0, n);
            return cursor;
          },
          toArray: async () => {
            return results.map((d) => this.project(d, opts?.projection));
          },
        };
        return cursor;
      },
      insertOne: async (doc: any) => {
        const cloned = { _id: `id_${Math.random()}`, ...doc };
        docs.push(cloned);
        return { acknowledged: true, insertedId: cloned._id };
      },
      insertMany: async (newDocs: any[]) => {
        const cloned = newDocs.map((d) => ({ _id: `id_${Math.random()}`, ...d }));
        docs.push(...cloned);
        return { acknowledged: true, insertedCount: cloned.length };
      },
      updateOne: async (filter: Filter<any>, update: any, opts?: { upsert?: boolean }) => {
        const idx = docs.findIndex((d) => this.matchesDoc(d, filter));
        if (idx !== -1) {
          if (update.$set) {
            docs[idx] = { ...docs[idx], ...update.$set };
          }
          return { acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
        } else if (opts?.upsert) {
          const newDoc: any = { _id: `id_${Math.random()}`, ...filter };
          if (update.$setOnInsert) Object.assign(newDoc, update.$setOnInsert);
          if (update.$set) Object.assign(newDoc, update.$set);
          docs.push(newDoc);
          return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
        }
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
      },
      updateMany: async (filter: Filter<any>, update: any) => {
        let count = 0;
        for (let i = 0; i < docs.length; i++) {
          if (this.matchesDoc(docs[i], filter)) {
            if (update.$set) {
              docs[i] = { ...docs[i], ...update.$set };
            }
            count++;
          }
        }
        return { acknowledged: true, matchedCount: count, modifiedCount: count };
      },
      findOneAndUpdate: async (filter: Filter<any>, update: any, opts?: any) => {
        const idx = docs.findIndex((d) => this.matchesDoc(d, filter));
        if (idx === -1) return null;
        if (update.$set) {
          docs[idx] = { ...docs[idx], ...update.$set };
        }
        if (update.$push) {
          for (const [field, item] of Object.entries(update.$push)) {
            if (!Array.isArray(docs[idx][field])) {
              docs[idx][field] = [];
            }
            docs[idx][field].push(item);
          }
        }
        return this.project(docs[idx], opts?.projection);
      },
      deleteMany: async (filter: Filter<any>) => {
        const initialLen = docs.length;
        const remaining = docs.filter((d) => !this.matchesDoc(d, filter));
        this.collections.set(name, remaining);
        return { acknowledged: true, deletedCount: initialLen - remaining.length };
      },
    };
  }

  private matchFilter(docs: any[], filter: Filter<any>): any[] {
    return docs.filter((d) => this.matchesDoc(d, filter));
  }

  private matchesDoc(doc: any, filter: Filter<any>): boolean {
    if (!filter || Object.keys(filter).length === 0) return true;

    for (const [key, value] of Object.entries(filter)) {
      if (key === "$or" && Array.isArray(value)) {
        const orMatches = value.some((subFilter) => this.matchesDoc(doc, subFilter));
        if (!orMatches) return false;
        continue;
      }

      if (value && typeof value === "object") {
        if (value instanceof RegExp) {
          const target = String(doc[key] ?? "");
          if (!value.test(target)) return false;
          continue;
        }

        if ("$regex" in value) {
          const reg = new RegExp(value.$regex, value.$options || "i");
          const target = Array.isArray(doc[key]) ? doc[key].join(" ") : String(doc[key] ?? "");
          if (!reg.test(target)) return false;
          continue;
        }

        if ("$in" in value && Array.isArray(value.$in)) {
          if (!value.$in.includes(doc[key])) return false;
          continue;
        }

        if ("$ne" in value) {
          if (doc[key] === value.$ne) return false;
          continue;
        }

        if ("$nin" in value && Array.isArray(value.$nin)) {
          if (value.$nin.includes(doc[key])) return false;
          continue;
        }
      }

      if (doc[key] !== value) {
        return false;
      }
    }

    return true;
  }

  private project(doc: any, projection?: Record<string, number>): any {
    if (!projection) return { ...doc };
    const result: any = { ...doc };
    for (const [k, v] of Object.entries(projection)) {
      if (v === 0) {
        delete result[k];
      }
    }
    return result;
  }
}
