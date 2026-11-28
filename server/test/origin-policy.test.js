import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin } from "../src/origin-policy.js";

const allowedOrigins = new Set([
  "http://localhost:5173",
  "https://saral-form.example",
  "https://formsaathi-web.vercel.app",
  "https://formsaathi-web-git-feat-web-a-2407d5-shashishrivastava0290-2666.vercel.app"
]);

test("rejects requests without an Origin header", () => {
  assert.equal(isAllowedOrigin(undefined, allowedOrigins), false);
  assert.equal(isAllowedOrigin(null, allowedOrigins), false);
  assert.equal(isAllowedOrigin("", allowedOrigins), false);
});

test("allows configured web origins", () => {
  assert.equal(isAllowedOrigin("http://localhost:5173", allowedOrigins), true);
  assert.equal(isAllowedOrigin("https://saral-form.example", allowedOrigins), true);
  assert.equal(isAllowedOrigin("https://formsaathi-web.vercel.app", allowedOrigins), true);
  assert.equal(isAllowedOrigin("https://formsaathi-web-git-feat-web-a-2407d5-shashishrivastava0290-2666.vercel.app", allowedOrigins), true);
});

test("allows syntactically valid Chrome extension origins", () => {
  assert.equal(isAllowedOrigin("chrome-extension://abcdefghijklmnopabcdefghijklmnop", allowedOrigins), true);
});

test("rejects foreign and malformed extension origins", () => {
  assert.equal(isAllowedOrigin("https://attacker.example", allowedOrigins), false);
  assert.equal(isAllowedOrigin("chrome-extension://not-a-valid-id", allowedOrigins), false);
});
