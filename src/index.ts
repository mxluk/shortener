import shortenUrl from './utils.ts';

async function handlePlusUrl(path: string, request: Request, env: Env): Promise<Response> {
	const [hash, url] = path.split('+');

	if (!URL.canParse(url)) {
		return new Response('Error: Invalid URL', { status: 400 });
	}

	if (new URL(url).hostname === new URL(request.url).hostname) {
		return new Response('Error: Cannot shorten URLs from the same domain', { status: 400 });
	}

	const value = await env.KV.get(hash);

	if (value === null) {
		console.log(`Storing ${hash} -> ${url}`);
		await env.KV.put(hash, url);
		return new Response(hash);
	} else {
		if (value === url) {
			return new Response(hash);
		} else {
			return new Response(`URL ${value} already exists for hash ${hash}`);
		}
	}
}

async function handleHashing(path: string, request: Request, env: Env): Promise<Response> {
	if (new URL(path, request.url).hostname === new URL(request.url).hostname) {
		return new Response('Error: Cannot shorten URLs from the same domain', { status: 400 });
	}

	for (let offset = 0; offset < 10; offset++) {
		const hash = shortenUrl(path, offset);
		const value = await env.KV.get(hash);
		if (value === null) {
			console.log(`Storing ${hash} -> ${path}`);
			await env.KV.put(hash, path);
			return new Response(hash);
		} else {
			if (value === path) {
				return new Response(hash);
			}
		}
	}
	return new Response('Error: Collision');
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
		const path = fullURL.pathname.slice(1);

		if (!URL.canParse(path)) {
			return handleRedirect(path, env);
		}

		if (path.includes('+http://') || path.includes('+https://')) {
			return handlePlusUrl(path, request, env);
		} else {
			return handleHashing(path, request, env);
		}
	},
} satisfies ExportedHandler<Env>;
