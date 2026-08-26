const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AegisOneRegistry", function () {
  let registry;
  let submitter;

  const digest = (label) => ethers.sha256(ethers.toUtf8Bytes(label));

  const commitments = () => ({
    manifestDigest: digest("manifest"),
    sourceClaimDigest: digest("source-claim"),
    publisherArtifactDigest: digest("publisher-artifact"),
    reproducedArtifactDigest: digest("reproduced-artifact"),
    provenanceRoot: digest("0g-storage-root"),
  });

  beforeEach(async function () {
    [submitter] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("AegisOneRegistry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();
  });

  it("registers and reads an immutable evidence record", async function () {
    const value = commitments();
    const recordId = await registry.computeRecordId(
      value.manifestDigest,
      value.sourceClaimDigest,
      value.publisherArtifactDigest,
      value.reproducedArtifactDigest,
      value.provenanceRoot,
    );

    const tx = await registry.registerEvidence(
      value.manifestDigest,
      value.sourceClaimDigest,
      value.publisherArtifactDigest,
      value.reproducedArtifactDigest,
      value.provenanceRoot,
    );
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt.blockNumber);

    await expect(tx)
      .to.emit(registry, "EvidenceRegistered")
      .withArgs(
        recordId,
        value.sourceClaimDigest,
        value.provenanceRoot,
        value.manifestDigest,
        value.publisherArtifactDigest,
        value.reproducedArtifactDigest,
        submitter.address,
        block.timestamp,
      );

    expect(await registry.exists(recordId)).to.equal(true);
    const record = await registry.getEvidence(recordId);
    expect(record.manifestDigest).to.equal(value.manifestDigest);
    expect(record.sourceClaimDigest).to.equal(value.sourceClaimDigest);
    expect(record.publisherArtifactDigest).to.equal(value.publisherArtifactDigest);
    expect(record.reproducedArtifactDigest).to.equal(value.reproducedArtifactDigest);
    expect(record.provenanceRoot).to.equal(value.provenanceRoot);
    expect(record.submitter).to.equal(submitter.address);
    expect(record.registeredAt).to.equal(BigInt(block.timestamp));
  });

  it("allows divergent artifact digests without relabeling them as a pass", async function () {
    const value = commitments();
    expect(value.publisherArtifactDigest).not.to.equal(value.reproducedArtifactDigest);

    await expect(
      registry.registerEvidence(
        value.manifestDigest,
        value.sourceClaimDigest,
        value.publisherArtifactDigest,
        value.reproducedArtifactDigest,
        value.provenanceRoot,
      ),
    ).not.to.be.reverted;
  });

  it("rejects every empty required commitment deterministically", async function () {
    const fields = [
      "manifestDigest",
      "sourceClaimDigest",
      "publisherArtifactDigest",
      "reproducedArtifactDigest",
      "provenanceRoot",
    ];

    for (let index = 0; index < fields.length; index += 1) {
      const value = commitments();
      value[fields[index]] = ethers.ZeroHash;
      await expect(
        registry.registerEvidence(
          value.manifestDigest,
          value.sourceClaimDigest,
          value.publisherArtifactDigest,
          value.reproducedArtifactDigest,
          value.provenanceRoot,
        ),
      )
        .to.be.revertedWithCustomError(registry, "EmptyCommitment")
        .withArgs(index);
    }
  });

  it("rejects duplicate evidence", async function () {
    const value = commitments();
    const args = [
      value.manifestDigest,
      value.sourceClaimDigest,
      value.publisherArtifactDigest,
      value.reproducedArtifactDigest,
      value.provenanceRoot,
    ];
    const recordId = await registry.computeRecordId(...args);

    await registry.registerEvidence(...args);
    await expect(registry.registerEvidence(...args))
      .to.be.revertedWithCustomError(registry, "EvidenceAlreadyRegistered")
      .withArgs(recordId);
  });

  it("rejects reads for unknown evidence", async function () {
    const missing = digest("missing-record");
    expect(await registry.exists(missing)).to.equal(false);
    await expect(registry.getEvidence(missing))
      .to.be.revertedWithCustomError(registry, "EvidenceNotFound")
      .withArgs(missing);
  });
});
