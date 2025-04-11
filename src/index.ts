import shortenUrl from './utils.ts';

async function handlePlusUrl(path: string, request: Request, env: Env): Promise<Response> {
	const [hash, url] = path.split('+');

	// Use full URL with query params and fragment
	const fullUrl = new URL(url, request.url).href;

	if (!URL.canParse(fullUrl)) {
		return new Response('Error: Invalid URL', { status: 400 });
	}

	if (new URL(fullUrl).hostname === new URL(request.url).hostname) {
		return new Response('Error: Cannot shorten URLs from the same domain', { status: 400 });
	}

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
	const fullUrl = new URL(path, request.url).href;

	if (new URL(fullUrl).hostname === new URL(request.url).hostname) {
		return new Response('Error: Cannot shorten URLs from the same domain', { status: 400 });
	}

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
		const fullPath = fullURL.href.split(fullURL.origin)[1].slice(1); // Get path + query + fragment

		if (!URL.canParse(fullPath)) {
			return handleRedirect(fullPath, env);
		}

		if (fullPath.includes('+http://') || fullPath.includes('+https://')) {
			return handlePlusUrl(fullPath, request, env);
		} else {
			return handleHashing(fullPath, request, env);
		}
	},
} satisfies ExportedHandler<Env>;
