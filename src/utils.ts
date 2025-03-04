/**
 * Hashes a URL string into a large, deterministic number.
 * This function is designed to produce a relatively random-looking number
 * based on the input URL.  It's deterministic, meaning the same URL
 * will always produce the same hash.  Different URLs are likely to produce
 * different hashes, but collisions are still possible.
 *
 * @param url The URL string to hash.
 * @returns A large number representing the hash of the URL.
 */
function hashUrl(url: string): number {
	let hash = 5381; // Prime number, common starting point for hash functions
	for (let i = 0; i < url.length; i++) {
		const char = url.charCodeAt(i);
		hash = (hash * 33) ^ char; // DJB2 hash algorithm (modified)
	}
	return Math.abs(hash); // Ensure a positive number
}

/**
 * Encodes a number into a string of specified length using the provided character set.
 * This function takes a number and a character set and converts the number into
 * a string representation using the provided characters as digits.
 *
 * @param hashNumber The number to encode.
 * @param length The desired length of the encoded string.
 * @param characters An array of characters to use for encoding.
 * @returns A string of the specified length, encoded from the number using the character set.
 */
function encode(hashNumber: number, length: number, characters: string[]): string {
	const base = characters.length;
	let encodedString = "";
	let num = hashNumber;

	for (let i = 0; i < length; i++) {
		const remainder = num % base;
		encodedString = characters[remainder] + encodedString;
		num = Math.floor(num / base);
	}

	// Pad with the first character if the number is too small to fill the length
	while (encodedString.length < length) {
		encodedString = characters[0] + encodedString;
	}

	return encodedString;
}

const DEFAULT_CHARACTERS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789".split("");
const DEFAULT_LENGTH = 4;

/**
 * Shortens a URL by hashing it and encoding the hash into a short string.
 * This function combines the `hashUrl` and `encode` functions to generate
 * a short, deterministic string representation of a URL.
 *
 * @param url The URL to shorten.
 * @param offset Offset number in case of collision.
 * @param length The desired length of the short string.
 * @param characters An array of characters to use for encoding.
 * @returns A short string representing the shortened URL.
 */
function shortenUrl(url: string, offset: number = 0, length: number = DEFAULT_LENGTH, characters: string[] = DEFAULT_CHARACTERS): string {
	const hash = hashUrl(url) + offset;
	return encode(hash, length, characters);
}

export default shortenUrl;
