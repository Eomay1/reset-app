import { createReviewClient } from "./reviewClient";
import { createReviewStorage } from "./reviewStorage";

beforeEach(() => localStorage.clear());

test("review persists only prefixed data and returns typed sessions to the dashboard without network", async () => {
  const storage = createReviewStorage(localStorage);
  localStorage.setItem("sessionLog", "existing history");
  storage.setItem("sessionLog", "review history");
  expect(localStorage.getItem("sessionLog")).toBe("existing history");
  expect(storage.getItem("sessionLog")).toBe("review history");
  const client = createReviewClient(storage);
  for (const type of ["craving_reset", "acupressure_reset", "grounding_reset"]) {
    await expect(client.from("session_results").insert([{ session_id: type, intervention_type: type, stress_after: 3 }])).resolves.toMatchObject({ error: null });
  }
  const recreated = createReviewClient(storage);
  const { data } = await recreated.from("session_results").select("*").order("created_at");
  expect(data).toHaveLength(3);
  expect(data.map((row) => row.intervention_type)).toEqual(["grounding_reset", "acupressure_reset", "craving_reset"]);
  expect(localStorage.getItem("cloud-sessions")).toBeNull();
  await expect(client.from("session_results").insert([{ session_id: "grounding_reset" }])).resolves.toMatchObject({ error: { code: "23505" } });
  expect(() => client.from("consumer_accounts")).toThrow("Unsupported review table");
});
