import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CounterModule", (m) => {
	const counter = m.contract("Counter");

	m.call(counter, "incBy", [5n]);

	// Deployed from contracts/mocks/ so the explorer is exercised against
	// contracts sitting in more than one subdirectory.
	const testToken = m.contract("TestToken", [1_000_000n * 10n ** 18n]);

	return { counter, testToken };
});
