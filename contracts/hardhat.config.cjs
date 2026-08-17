require("@nomicfoundation/hardhat-toolbox");

function registryAccounts() {
  const value = process.env.ZEROG_REGISTRY_PRIVATE_KEY?.trim();
  if (!value) return [];
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("ZEROG_REGISTRY_PRIVATE_KEY must be a 32-byte hexadecimal private key");
  }
  return [normalized];
}

/** @type {import("hardhat/config").HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    galileo: {
      url: "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: registryAccounts(),
    },
  },
};
