// test/index.spec.ts
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '../src/index';
import { createMockKV } from './utils/mockKV';

function makeRequest(path: string) {
	return new Request(`http://localhost:3000/${path}`);
}

describe('fuc.moe shortener with in-memory KV', () => {
	let mockKV: ReturnType<typeof createMockKV>;

	beforeEach(() => {
		mockKV = createMockKV();
		env.KV = mockKV;
	});

	it('shortens a URL with auto-generated hash', async () => {
		const url = 'https://example.com/';
		const expectedHash = 'fv2q';

		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest(url), env, ctx);
		await waitOnExecutionContext(ctx);

		expect(await response.text()).toBe(expectedHash);
		expect(await mockKV.get(expectedHash)).toBe(url);
	});

	it('shortens with custom slug', async () => {
		const slug = 'customslug';
		const url = 'https://test.com/';

		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest(`${slug}+${url}`), env, ctx);
		await waitOnExecutionContext(ctx);

		expect(await response.text()).toBe(slug);
		expect(await mockKV.get(slug)).toBe(url);
	});

	it('redirects existing slug', async () => {
		const slug = 'go';
		const url = 'https://duckduckgo.com/';
		await mockKV.put(slug, url);

		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest(slug), env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(301);
		expect(response.headers.get('Location')).toBe(url);
	});

	it('returns 404 for unknown slug', async () => {
		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest('notfound'), env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe('Error: Not Found');
	});

	it('rejects garbage as URL', async () => {
		const input = 'ht!tp://💩';

		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest(input), env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(404); // It should fall through to redirect logic, which 404s
	});

        it('preserves query params and fragments in URL', async () => {
                const url = 'https://example.com/page?foo=1#bar';
                const expectedHash = 'rhFG'; // Deterministic hash from modified DJB2 algorithm (hashUrl)

                const ctx = createExecutionContext();
                const response = await worker.fetch(makeRequest(url), env, ctx);
                await waitOnExecutionContext(ctx);

		expect(await response.text()).toBe(expectedHash);
	});

	it('fails to shorten when all hash space is occupied', async () => {
		const mockKV = createMockKV();
		env.KV = mockKV;

		// Populate all possible 4-char hashes
		const hashes = generateAllHashes();
		for (const hash of hashes) {
			await mockKV.put(hash, 'https://some-url.com/');
		}

		const newUrl = 'https://new-unique-url.com/';

		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest(newUrl), env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(500);
		expect(await response.text()).toBe('Error: Collision');
	});

});

function generateAllHashes(length = 4, chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789"): string[] {
	const results: string[] = [];

	const recurse = (prefix: string, depth: number) => {
		if (depth === 0) {
			results.push(prefix);
			return;
		}
		for (const c of chars) {
			recurse(prefix + c, depth - 1);
		}
	};

	recurse('', length);
	return results;
}
