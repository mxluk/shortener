import shortenUrl from './utils.ts';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const path = request.url.split('/').slice(3).join('/');

		// path is empty
		if(path === '') {
			return new Response('Error: Not Found', { status: 404 });
		}

		// if the requests url has http after the slash
		if(path.startsWith('http://') || path.startsWith('https://')) {
			// hash the url
			for(let offset = 0; offset < 10; offset++) {
				const hash = shortenUrl(path, offset);
				const value = await env.KV.get(hash)
				if(value === null) {
					console.log(`Storing ${hash} -> ${path}`);
					await env.KV.put(hash, path);
					return new Response(hash);
				} else {
					if(value === path) {
						return new Response(hash);
					}
				}
			}

			return new Response('Error: Collision')
		} else {
			const value = await env.KV.get(path);
			if(value === null) {
				return new Response('Error: Not Found', { status: 404 });
			} else {
				return Response.redirect(value, 301);
			}
		}
	},
} satisfies ExportedHandler<Env>;
