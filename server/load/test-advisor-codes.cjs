const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

// Import compiled dist services
const {
  normalizeAdvisorCode,
  isValidAdvisorCode,
} = require("../dist/services/advisorCodeService");

describe("Advisor Unique Code & Assignment System", () => {
  test("normalizeAdvisorCode standardizes variations into canonical ADV-XXXXXX format", () => {
    assert.equal(normalizeAdvisorCode("ADV-482910"), "ADV-482910");
    assert.equal(normalizeAdvisorCode("adv-482910"), "ADV-482910");
    assert.equal(normalizeAdvisorCode("482910"), "ADV-482910");
    assert.equal(normalizeAdvisorCode("ADV482910"), "ADV-482910");
    assert.equal(normalizeAdvisorCode("  adv-100000  "), "ADV-100000");

    // Invalid codes
    assert.equal(normalizeAdvisorCode(""), null);
    assert.equal(normalizeAdvisorCode("123"), null);
    assert.equal(normalizeAdvisorCode("ADV-012345"), null); // non-zero starting digit
    assert.equal(normalizeAdvisorCode("random-string"), null);
    assert.equal(normalizeAdvisorCode(null), null);
    assert.equal(normalizeAdvisorCode(undefined), null);
  });

  test("isValidAdvisorCode validates strict ADV-XXXXXX structure", () => {
    assert.equal(isValidAdvisorCode("ADV-100000"), true);
    assert.equal(isValidAdvisorCode("ADV-999999"), true);
    assert.equal(isValidAdvisorCode("ADV-482910"), true);

    assert.equal(isValidAdvisorCode("482910"), false);
    assert.equal(isValidAdvisorCode("adv-482910"), false);
    assert.equal(isValidAdvisorCode("ADV-082910"), false);
    assert.equal(isValidAdvisorCode("ADV-12345"), false);
    assert.equal(isValidAdvisorCode("ADV-1234567"), false);
  });
});
