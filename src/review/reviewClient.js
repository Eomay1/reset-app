// Deliberately limited mock: unsupported operations fail rather than contact a server.
export function createReviewClient(storage) {
  const read = () => JSON.parse(storage.getItem("cloud-sessions") || "[]");
  return {
    from(table) {
      if (table !== "session_results") throw new Error(`Unsupported review table: ${table}`);
      return {
        async insert(rows) {
          const existing = read();
          if (rows.some((row) => existing.some((saved) => saved.session_id === row.session_id))) {
            return { error: { code: "23505" } };
          }
          storage.setItem("cloud-sessions", JSON.stringify([...existing, ...rows.map((row) => ({ ...row, created_at: new Date().toISOString() }))]));
          return { data: rows, error: null };
        },
        select() {
          return { async order() { return { data: read().reverse(), error: null }; } };
        }
      };
    }
  };
}
