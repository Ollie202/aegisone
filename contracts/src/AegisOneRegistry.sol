// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title AegisOneRegistry
/// @notice Immutable registry of compact software reproduction evidence commitments.
/// @dev Registration proves only that these commitments were anchored by `submitter`.
///      It does not prove source ownership, software safety, or that two artifact digests match.
contract AegisOneRegistry {
    enum CommitmentField {
        ManifestDigest,
        SourceClaimDigest,
        PublisherArtifactDigest,
        ReproducedArtifactDigest,
        ProvenanceRoot
    }

    struct EvidenceRecord {
        bytes32 manifestDigest;
        bytes32 sourceClaimDigest;
        bytes32 publisherArtifactDigest;
        bytes32 reproducedArtifactDigest;
        bytes32 provenanceRoot;
        address submitter;
        uint64 registeredAt;
    }

    mapping(bytes32 recordId => EvidenceRecord) private records;

    error EmptyCommitment(CommitmentField field);
    error EvidenceAlreadyRegistered(bytes32 recordId);
    error EvidenceNotFound(bytes32 recordId);

    event EvidenceRegistered(
        bytes32 indexed recordId,
        bytes32 indexed sourceClaimDigest,
        bytes32 indexed provenanceRoot,
        bytes32 manifestDigest,
        bytes32 publisherArtifactDigest,
        bytes32 reproducedArtifactDigest,
        address submitter,
        uint64 registeredAt
    );

    function registerEvidence(
        bytes32 manifestDigest,
        bytes32 sourceClaimDigest,
        bytes32 publisherArtifactDigest,
        bytes32 reproducedArtifactDigest,
        bytes32 provenanceRoot
    ) external returns (bytes32 recordId) {
        _requireCommitment(manifestDigest, CommitmentField.ManifestDigest);
        _requireCommitment(sourceClaimDigest, CommitmentField.SourceClaimDigest);
        _requireCommitment(publisherArtifactDigest, CommitmentField.PublisherArtifactDigest);
        _requireCommitment(reproducedArtifactDigest, CommitmentField.ReproducedArtifactDigest);
        _requireCommitment(provenanceRoot, CommitmentField.ProvenanceRoot);

        recordId = computeRecordId(
            manifestDigest,
            sourceClaimDigest,
            publisherArtifactDigest,
            reproducedArtifactDigest,
            provenanceRoot
        );

        if (records[recordId].submitter != address(0)) {
            revert EvidenceAlreadyRegistered(recordId);
        }

        uint64 registeredAt = uint64(block.timestamp);
        records[recordId] = EvidenceRecord({
            manifestDigest: manifestDigest,
            sourceClaimDigest: sourceClaimDigest,
            publisherArtifactDigest: publisherArtifactDigest,
            reproducedArtifactDigest: reproducedArtifactDigest,
            provenanceRoot: provenanceRoot,
            submitter: msg.sender,
            registeredAt: registeredAt
        });

        emit EvidenceRegistered(
            recordId,
            sourceClaimDigest,
            provenanceRoot,
            manifestDigest,
            publisherArtifactDigest,
            reproducedArtifactDigest,
            msg.sender,
            registeredAt
        );
    }

    function computeRecordId(
        bytes32 manifestDigest,
        bytes32 sourceClaimDigest,
        bytes32 publisherArtifactDigest,
        bytes32 reproducedArtifactDigest,
        bytes32 provenanceRoot
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                manifestDigest,
                sourceClaimDigest,
                publisherArtifactDigest,
                reproducedArtifactDigest,
                provenanceRoot
            )
        );
    }

    function exists(bytes32 recordId) external view returns (bool) {
        return records[recordId].submitter != address(0);
    }

    function getEvidence(bytes32 recordId)
        external
        view
        returns (
            bytes32 manifestDigest,
            bytes32 sourceClaimDigest,
            bytes32 publisherArtifactDigest,
            bytes32 reproducedArtifactDigest,
            bytes32 provenanceRoot,
            address submitter,
            uint64 registeredAt
        )
    {
        EvidenceRecord storage record = records[recordId];
        if (record.submitter == address(0)) revert EvidenceNotFound(recordId);

        return (
            record.manifestDigest,
            record.sourceClaimDigest,
            record.publisherArtifactDigest,
            record.reproducedArtifactDigest,
            record.provenanceRoot,
            record.submitter,
            record.registeredAt
        );
    }

    function _requireCommitment(bytes32 value, CommitmentField field) private pure {
        if (value == bytes32(0)) revert EmptyCommitment(field);
    }
}
