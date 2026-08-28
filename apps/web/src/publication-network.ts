/**
 * The 0G network AegisOne publishes evidence to, and therefore the network every stored
 * publication is re-checked against.
 *
 * Recorded as an explicit constant rather than assumed, because the canonical evidence manifest
 * commits to the network alongside the storage root: a publication made against Galileo cannot
 * re-validate as a mainnet one, and vice versa. Changing this value would (correctly) invalidate
 * every existing publication's integrity check rather than silently relabelling old evidence as
 * belonging to a different chain.
 *
 * Galileo (testnet, chain 16602) is where AegisOne's evidence storage and compact registry
 * commitments live. The Aristotle mainnet registry proven in M5 is a separate, deliberately
 * one-off historical anchor and is not a publication target for this path.
 */
export const PUBLICATION_NETWORK = Object.freeze({
  network: "0G Galileo Testnet",
  chainId: 16602,
});
