// test/utils/mockKV.ts
export function createMockKV() {
	const store = new Map<string, string>();

	return {
		get: async (key: string) => store.get(key) ?? null,
		put: async (key: string, value: string) => {
			store.set(key, value);
		},
		delete: async (key: string) => {
			store.delete(key);
		},
		reset: () => store.clear(),
		_dump: () => store, // for debug if needed
	};
}
