import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  sha256Hex,
  verifyEvidenceHash,
  computeEvidenceSetHash,
} from "../../src/lib/crypto";

describe("7-Tier Provenance & Cryptographic SHA-256 Engine (§17, §18)", () => {
  const sampleExcerpt =
    "We introduce speculative decoding, an algorithm allowing sampling multiple tokens per transformer call from a target model by running a small draft model.";
  const sampleLocator = "Page 2, Abstract Section, lines 14-22";

  test("calculates deterministic SHA-256 hex digest using Web Crypto", async () => {
    const hash = await sha256Hex("Autonomous AI Research Platform");
    assert.equal(typeof hash, "string");
    assert.equal(hash.length, 64);
    // SHA-256 of "Autonomous AI Research Platform"
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  test("verifies untampered evidence excerpt + locator against expected hash", async () => {
    // Canonical payload: excerpt|locator
    const canonicalPayload = `${sampleExcerpt}|${sampleLocator}`;
    const expectedHash = await sha256Hex(canonicalPayload);

    const result = await verifyEvidenceHash(
      sampleExcerpt,
      sampleLocator,
      expectedHash
    );

    assert.equal(result.match, true);
    assert.equal(result.computedHash, expectedHash);
  });

  test("strictly detects tampering if excerpt or locator is altered", async () => {
    const canonicalPayload = `${sampleExcerpt}|${sampleLocator}`;
    const authenticHash = await sha256Hex(canonicalPayload);

    // Tampered excerpt (single character changed)
    const tamperedExcerpt = sampleExcerpt.replace("speculative", "speculat1ve");
    const tamperedResult = await verifyEvidenceHash(
      tamperedExcerpt,
      sampleLocator,
      authenticHash
    );

    assert.equal(tamperedResult.match, false);
    assert.notEqual(tamperedResult.computedHash, authenticHash);

    // Tampered locator
    const tamperedLocatorResult = await verifyEvidenceHash(
      sampleExcerpt,
      "Page 3, Abstract Section, lines 14-22",
      authenticHash
    );

    assert.equal(tamperedLocatorResult.match, false);
  });

  test("computes order-independent Merkle root hash for evidence set", async () => {
    const hash1 = "3d7c66f153ad4ecdb96f4c1cb027d9d6f6733b9754409aec77710773bf244573";
    const hash2 = "2096d0512952ddff93de428cefddb3c45393b3517a7cc0b48b66f853b48e4509";
    const hash3 = "2738a35bf63a71627f991919ebde8d3c3ff04ca1d0d87e32e528fe973b225f02";

    // Regardless of array order, sorted canonical hash must match
    const setHashA = await computeEvidenceSetHash([hash1, hash2, hash3]);
    const setHashB = await computeEvidenceSetHash([hash3, hash1, hash2]);

    assert.equal(setHashA, setHashB);
    assert.equal(setHashA.length, 64);
  });
});
