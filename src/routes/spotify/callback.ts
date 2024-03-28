import { fetch, FetchMethods, FetchResultTypes } from '@sapphire/fetch';
import { Route, methods, type ApiRequest, type ApiResponse } from '@sapphire/plugin-api';

interface TokenRequest {
	access_token: string;
	refresh_token: string;
}

export class CallbackRoute extends Route {
	public constructor(context: Route.LoaderContext, options: Route.Options) {
		super(context, {
			...options,
			route: 'spotify/callback'
		});
	}

	public async [methods.GET](req: ApiRequest, res: ApiResponse) {
		const callbackCode = req.query['code'] as string;
		const callbackState = req.query['state'] as string;
		const clientId = process.env.SPOTIFY_CLIENT_ID;
		const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
		const encodedCredentials = Buffer.from(`${clientId}:${clientSecret}`, 'binary').toString('base64');

		if (!callbackCode) return res.status(400).json({ message: 'Missing code', success: false });

		const params = new URLSearchParams();
		params.append('grant_type', 'authorization_code');
		params.append('redirect_uri', process.env.REDIRECT_URL!);
		params.append('code', callbackCode);

		const response = await fetch<TokenRequest>(
			'https://accounts.spotify.com/api/token?' + params,
			{
				method: FetchMethods.Post,
				headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
					Authorization: 'Basic ' + encodedCredentials
				}
			},
			FetchResultTypes.JSON
		);

		if (!response.access_token || !response.refresh_token)
			return res.status(400).json({
				message: 'Invalid response from token server',
				success: false
			});

		if (!this.container.client.users.cache.get(callbackState))
			return res.status(400).json({
				message: 'Invalid state',
				success: false
			});

		await this.container.prisma.spotifyCreds.create({
			data: {
				accessToken: response.access_token,
				refreshToken: response.refresh_token,
				discordId: callbackState
			}
		});

		return res.json({
			message: 'Success! You may now close this tab.',
			success: true
		});
	}
}
