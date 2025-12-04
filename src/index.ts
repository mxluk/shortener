import shortenUrl from './utils.ts';

async function handlePlusUrl(path: string, request: Request, env: Env): Promise<Response> {
	const [hash, url] = path.split('+');

	// Try to parse the URL (only accept absolute URLs)
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url);
	} catch (e) {
		return new Response('Error: Invalid URL', { status: 400 });
	}

	// Only allow http: and https: schemes (check BEFORE same-domain check)
	if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
		return new Response('Error: Invalid URL', { status: 400 });
	}

	// Check hostname validity before comparing
	if (!parsedUrl.hostname || parsedUrl.hostname.length === 0) {
		return new Response('Error: Invalid URL', { status: 400 });
	}

	if (parsedUrl.hostname === new URL(request.url).hostname) {
		return new Response('Error: Cannot shorten URLs from the same domain', { status: 400 });
	}

	const fullUrl = parsedUrl.href;
	const value = await env.KV.get(hash);

	if (value === null) {
		console.log(`Storing ${hash} -> ${fullUrl}`);
		await env.KV.put(hash, fullUrl);
		return new Response(hash);
	} else {
		if (value === fullUrl) {
			return new Response(hash);
		} else {
			return new Response(`URL ${value} already exists for hash ${hash}`);
		}
	}
}

async function handleHashing(path: string, request: Request, env: Env): Promise<Response> {
	let parsedUrl: URL;
	try {
		// Try to parse as absolute URL first (without base)
		parsedUrl = new URL(path);
	} catch (e) {
		// If that fails, it's not a valid absolute URL
		return new Response('Error: Invalid URL', { status: 400 });
	}

	// Only allow http: and https: schemes (check BEFORE same-domain check)
	if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
		return new Response('Error: Invalid URL', { status: 400 });
	}

	// Check hostname validity before comparing
	if (!parsedUrl.hostname || parsedUrl.hostname.length === 0) {
		return new Response('Error: Invalid URL', { status: 400 });
	}

	if (parsedUrl.hostname === new URL(request.url).hostname) {
		return new Response('Error: Cannot shorten URLs from the same domain', { status: 400 });
	}

	const fullUrl = parsedUrl.href;
	for (let offset = 0; offset < 10; offset++) {
		const hash = shortenUrl(fullUrl, offset);
		const value = await env.KV.get(hash);
		if (value === null) {
			console.log(`Storing ${hash} -> ${fullUrl}`);
			await env.KV.put(hash, fullUrl);
			return new Response(hash);
		} else {
			if (value === fullUrl) {
				return new Response(hash);
			}
		}
	}
	return new Response('Error: Collision', { status: 500 });
}

async function handleRedirect(path: string, env: Env): Promise<Response> {
	const value = await env.KV.get(path);
	if (value === null) {
		return new Response('Error: Not Found', { status: 404 });
	} else {
		return Response.redirect(value, 301);
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const fullURL = new URL(request.url);
		// Extract path without leading slash: pathname + search + hash
		const fullPath = (fullURL.pathname + fullURL.search + fullURL.hash).slice(1);

		// Check for custom slug pattern first (slug+url format)
		if (fullPath.includes('+')) {
			return handlePlusUrl(fullPath, request, env);
		}

		// Check if path looks like a URL (contains :// or : followed by alphanumeric)
		if (fullPath.includes('://') || /^[a-z]+:/i.test(fullPath)) {
			return handleHashing(fullPath, request, env);
		}

		// Otherwise, treat as a redirect slug
		return handleRedirect(fullPath, env);
	},
} satisfies ExportedHandler<Env>;
