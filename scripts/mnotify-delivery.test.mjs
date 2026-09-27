import { test } from "node:test";
import { strict as assert } from "node:assert";
import { deliveryOutcome } from "./mnotify-delivery.mjs";

test("only a report for the queued recipient confirms delivery", () => {
  assert.equal(deliveryOutcome({ status: "success", report: [{ recipient: "233241234567", status: "DELIVERED" }] }, "+233241234567"), "delivered");
  assert.equal(deliveryOutcome({ status: "success", report: [{ recipient: "233241234568", status: "DELIVERED" }] }, "+233241234567"), "unknown");
  assert.equal(deliveryOutcome({ status: "success", report: [] }, "+233241234567"), "unknown");
});

test("provider failures and pending outcomes remain distinct", () => {
  assert.equal(deliveryOutcome({ status: "success", report: [{ recipient: "233241234567", status: "FAILED" }] }, "+233241234567"), "failed");
  assert.equal(deliveryOutcome({ status: "success", report: [{ recipient: "233241234567", status: "SUBMITTED" }] }, "+233241234567"), "pending");
  assert.equal(deliveryOutcome({ status: "error", report: [{ recipient: "233241234567", status: "DELIVERED" }] }, "+233241234567"), "unknown");
});
