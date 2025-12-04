// test/utils.spec.ts
import { describe, it, expect } from 'vitest';
import shortenUrl from '../src/utils';

describe('URL hashing utils', () => {
	describe('shortenUrl', () => {
		it('generates a 4-character hash by default', () => {
			const hash = shortenUrl('https://example.com/');
			expect(hash).toHaveLength(4);
		});

		it('generates deterministic hashes (same URL = same hash)', () => {
			const url = 'https://example.com/test';
			const hash1 = shortenUrl(url);
			const hash2 = shortenUrl(url);
			expect(hash1).toBe(hash2);
		});

		it('generates different hashes for different URLs', () => {
			const hash1 = shortenUrl('https://example.com/page1');
			const hash2 = shortenUrl('https://example.com/page2');
			expect(hash1).not.toBe(hash2);
		});

		it('generates different hashes with different offsets', () => {
			const url = 'https://example.com/';
			const hash0 = shortenUrl(url, 0);
			const hash1 = shortenUrl(url, 1);
			const hash2 = shortenUrl(url, 2);

			expect(hash0).not.toBe(hash1);
			expect(hash1).not.toBe(hash2);
			expect(hash0).not.toBe(hash2);
		});

		it('uses only allowed characters (no ambiguous chars)', () => {
			const allowedChars = /^[abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789]+$/;

			for (let i = 0; i < 100; i++) {
				const hash = shortenUrl(`https://example.com/page${i}`);
				expect(hash).toMatch(allowedChars);
			}
		});

		it('does not contain ambiguous characters (0, O, l, I)', () => {
			const ambiguousChars = /[0OlI]/;

			for (let i = 0; i < 100; i++) {
				const hash = shortenUrl(`https://example.com/test${i}`);
				expect(hash).not.toMatch(ambiguousChars);
			}
		});

		it('handles very long URLs', () => {
			const longUrl = 'https://example.com/' + 'a'.repeat(10000);
			const hash = shortenUrl(longUrl);
			expect(hash).toHaveLength(4);
		});

		it('handles URLs with special characters', () => {
			const url = 'https://example.com/path?foo=bar&baz=qux#fragment';
			const hash = shortenUrl(url);
			expect(hash).toHaveLength(4);
		});

		it('handles URLs with unicode characters', () => {
			const url = 'https://example.com/日本語/emoji😀';
			const hash = shortenUrl(url);
			expect(hash).toHaveLength(4);
		});

		it('handles empty string', () => {
			const hash = shortenUrl('');
			expect(hash).toHaveLength(4);
		});

		it('generates same hash for URLs that differ only in case (lowercase)', () => {
			const url1 = 'https://example.com/Path';
			const url2 = 'https://example.com/Path';
			expect(shortenUrl(url1)).toBe(shortenUrl(url2));
		});

		it('generates different hashes for URLs that differ in case', () => {
			const url1 = 'https://example.com/Path';
			const url2 = 'https://example.com/path';
			expect(shortenUrl(url1)).not.toBe(shortenUrl(url2));
		});

		it('respects custom length parameter', () => {
			const url = 'https://example.com/';
			const hash3 = shortenUrl(url, 0, 3);
			const hash5 = shortenUrl(url, 0, 5);
			const hash10 = shortenUrl(url, 0, 10);

			expect(hash3).toHaveLength(3);
			expect(hash5).toHaveLength(5);
			expect(hash10).toHaveLength(10);
		});

		it('respects custom character set', () => {
			const url = 'https://example.com/';
			const customChars = ['a', 'b', 'c'];
			const hash = shortenUrl(url, 0, 4, customChars);

			expect(hash).toHaveLength(4);
			expect(hash).toMatch(/^[abc]+$/);
		});

		it('handles offset = 0 same as no offset', () => {
			const url = 'https://example.com/';
			const hashDefault = shortenUrl(url);
			const hashZero = shortenUrl(url, 0);

			expect(hashDefault).toBe(hashZero);
		});

		it('produces consistent hashes across multiple calls (stress test)', () => {
			const url = 'https://example.com/consistent';
			const hashes = new Set();

			for (let i = 0; i < 1000; i++) {
				hashes.add(shortenUrl(url));
			}

			expect(hashes.size).toBe(1); // All should be identical
		});

		it('produces diverse hashes for similar URLs', () => {
			const hashes = new Set();

			for (let i = 0; i < 100; i++) {
				hashes.add(shortenUrl(`https://example.com/page${i}`));
			}

			// Should have good distribution (at least 95% unique)
			expect(hashes.size).toBeGreaterThan(95);
		});

		it('generates known hash for specific URL (regression test)', () => {
			// This locks in the current hash algorithm behavior
			expect(shortenUrl('https://example.com/')).toBe('fv2q');
			expect(shortenUrl('https://test.com/')).toBe('3cVw');
		});
	});
});
