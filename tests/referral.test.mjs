import test from "node:test";
import assert from "node:assert/strict";
import { resolveReferral, ALLOWED_AVEN_HOSTS, LO_REFERRAL_URLS } from "../lib/referral.mjs";

function hostOf(url) {
  return new URL(url).hostname;
}

test("KY and TX resolve to Bill without a campaign hint", () => {
  for (const state of ["KY", "TX"]) {
    const result = resolveReferral({ state });
    assert.equal(result.ok, true);
    assert.equal(result.lo, "bill");
    assert.equal(hostOf(result.url), "flow.avenfoundry.com");
    assert.equal(result.url, LO_REFERRAL_URLS.bill);
  }
});

test("overlapping states fail closed without a verified LO hint", () => {
  for (const state of ["GA", "FL", "TN", "NC", "SC", "AL"]) {
    const result = resolveReferral({ state });
    assert.equal(result.ok, false);
    assert.equal(result.code, "unmapped");
  }
});

test("campaign hint plus supported state uses that LO URL", () => {
  const result = resolveReferral({ state: "GA", loHint: "nikk" });
  assert.equal(result.ok, true);
  assert.equal(result.lo, "nikk");
  assert.equal(result.url, LO_REFERRAL_URLS.nikk);
});

test("unsupported, blank, invalid, and tampered inputs fail closed", () => {
  assert.equal(resolveReferral({ state: "LA" }).code, "unsupported");
  assert.equal(resolveReferral({ state: "OTHER" }).code, "invalid");
  assert.equal(resolveReferral({ state: "" }).code, "blank");
  assert.equal(resolveReferral({}).code, "blank");
  assert.equal(resolveReferral({ state: "ga!" }).code, "invalid");
  assert.equal(resolveReferral({ state: "GA", loHint: "jason" }).code, "invalid");
  assert.equal(resolveReferral({ state: "KY", loHint: "nikk" }).code, "unmapped");
});

test("referral hosts stay on the verified allowlist", () => {
  assert.deepEqual([...ALLOWED_AVEN_HOSTS], ["flow.avenfoundry.com"]);
  for (const url of Object.values(LO_REFERRAL_URLS)) {
    assert.equal(hostOf(url), "flow.avenfoundry.com");
    assert.match(url, /^https:\/\//);
  }
});
