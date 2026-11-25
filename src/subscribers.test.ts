import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { compRequestBody } from "./subscribers.js";

describe("compRequestBody", () => {
  test("rejects a length combined with an expiration date", () => {
    assert.throws(
      () =>
        compRequestBody({
          subscriptionLength: 30,
          expirationDate: "2027-01-01T00:00:00Z",
        }),
      /either subscriptionLength or expirationDate, not both/
    );
  });

  test("drops unset fields so the API applies its defaults", () => {
    assert.deepEqual(
      compRequestBody({
        sendWelcomeEmails: false,
        subscriptionLength: undefined,
        expirationDate: undefined,
      }),
      { sendWelcomeEmails: false }
    );
    assert.deepEqual(compRequestBody({}), {});
  });

  test("keeps a lifetime length and section settings", () => {
    const request = {
      subscriptionLength: "lifetime" as const,
      sectionEmailSettings: [{ sectionId: 4821, setting: "off" as const }],
    };
    assert.deepEqual(compRequestBody(request), request);
  });
});
