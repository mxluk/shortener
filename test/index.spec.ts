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

		// Should return 400 for invalid URL format
		expect(response.status).toBe(400);
		expect(await response.text()).toBe('Error: Invalid URL');
	});

	it('preserves query params and fragments in URL', async () => {
		const url = 'https://example.com/page?foo=1#bar';
		const expectedHash = 'rhFG'; // Whatever it hashes to

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

	// Same-domain protection tests
	it('rejects shortening URLs from the same domain (auto-hash)', async () => {
		const url = 'http://localhost:3000/some-path';

		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest(url), env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
		expect(await response.text()).toBe('Error: Cannot shorten URLs from the same domain');
	});

	it('rejects shortening URLs from the same domain (custom slug)', async () => {
		const slug = 'myslug';
		const url = 'http://localhost:3000/another-path';

		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest(`${slug}+${url}`), env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
		expect(await response.text()).toBe('Error: Cannot shorten URLs from the same domain');
	});

	// Custom slug collision tests
	it('returns error message when custom slug exists with different URL', async () => {
		const slug = 'taken';
		const existingUrl = 'https://existing.com/';
		const newUrl = 'https://different.com/';

		await mockKV.put(slug, existingUrl);

		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest(`${slug}+${newUrl}`), env, ctx);
		await waitOnExecutionContext(ctx);

		expect(await response.text()).toBe(`URL ${existingUrl} already exists for hash ${slug}`);
	});

	it('returns same slug when custom slug exists with same URL', async () => {
		const slug = 'duplicate';
		const url = 'https://same.com/';

		await mockKV.put(slug, url);

		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest(`${slug}+${url}`), env, ctx);
		await waitOnExecutionContext(ctx);

		expect(await response.text()).toBe(slug);
	});

	// Deterministic hashing tests
	it('returns same hash for identical URL (deterministic)', async () => {
		const url = 'https://deterministic.com/';

		const ctx1 = createExecutionContext();
		const response1 = await worker.fetch(makeRequest(url), env, ctx1);
		await waitOnExecutionContext(ctx1);
		const hash1 = await response1.text();

		const ctx2 = createExecutionContext();
		const response2 = await worker.fetch(makeRequest(url), env, ctx2);
		await waitOnExecutionContext(ctx2);
		const hash2 = await response2.text();

		expect(hash1).toBe(hash2);
	});

	it('returns same hash when URL already exists in KV (idempotent)', async () => {
		const url = 'https://idempotent.com/';

		// First request
		const ctx1 = createExecutionContext();
		const response1 = await worker.fetch(makeRequest(url), env, ctx1);
		await waitOnExecutionContext(ctx1);
		const hash1 = await response1.text();

		// Second request should return same hash
		const ctx2 = createExecutionContext();
		const response2 = await worker.fetch(makeRequest(url), env, ctx2);
		await waitOnExecutionContext(ctx2);
		const hash2 = await response2.text();

		expect(hash1).toBe(hash2);
		expect(await mockKV.get(hash1)).toBe(url);
	});

	// Edge case tests
	it('handles empty path', async () => {
		const ctx = createExecutionContext();
		const response = await worker.fetch(new Request('http://localhost:3000/'), env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe('Error: Not Found');
	});

	it('handles root path explicitly', async () => {
		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest(''), env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(404);
	});

	it('handles very long URLs', async () => {
		const longPath = 'a'.repeat(2000);
		const url = `https://example.com/${longPath}`;

		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest(url), env, ctx);
		await waitOnExecutionContext(ctx);

		const hash = await response.text();
		expect(hash.length).toBe(4);
		expect(await mockKV.get(hash)).toBe(url);
	});

	it('rejects invalid URL in custom slug format', async () => {
		const slug = 'bad';
		const invalidUrl = 'not-a-url';

		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest(`${slug}+${invalidUrl}`), env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
		expect(await response.text()).toBe('Error: Invalid URL');
	});

	it('handles special characters in custom slugs', async () => {
		const slug = 'my-cool_slug123';
		const url = 'https://example.com/';

		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest(`${slug}+${url}`), env, ctx);
		await waitOnExecutionContext(ctx);

		expect(await response.text()).toBe(slug);
		expect(await mockKV.get(slug)).toBe(url);
	});

	it('handles URLs with multiple query parameters', async () => {
		const url = 'https://example.com/path?foo=1&bar=2&baz=3';

		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest(url), env, ctx);
		await waitOnExecutionContext(ctx);

		const hash = await response.text();
		expect(await mockKV.get(hash)).toBe(url);
	});

	it('handles URLs with encoded characters', async () => {
		const url = 'https://example.com/path?query=hello%20world&emoji=%F0%9F%98%80';

		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest(url), env, ctx);
		await waitOnExecutionContext(ctx);

		const hash = await response.text();
		expect(await mockKV.get(hash)).toBe(url);
	});

	it('rejects non-HTTP schemes', async () => {
		const ftpUrl = 'ftp://files.example.com/file.txt';

		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest(ftpUrl), env, ctx);
		await waitOnExecutionContext(ctx);

		// Should reject with 400 for invalid scheme
		expect(response.status).toBe(400);
		expect(await response.text()).toBe('Error: Invalid URL');
	});

	it('rejects javascript: URLs for security', async () => {
		const jsUrl = 'javascript:alert(1)';

		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest(jsUrl), env, ctx);
		await waitOnExecutionContext(ctx);

		// Should reject with 400 for security
		expect(response.status).toBe(400);
		expect(await response.text()).toBe('Error: Invalid URL');
	});

	it('handles URLs with unusual but valid characters', async () => {
		const url = 'https://example.com/path/with/~tilde_and-dashes.html';

		const ctx = createExecutionContext();
		const response = await worker.fetch(makeRequest(url), env, ctx);
		await waitOnExecutionContext(ctx);

		const hash = await response.text();
		expect(await mockKV.get(hash)).toBe(url);
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
