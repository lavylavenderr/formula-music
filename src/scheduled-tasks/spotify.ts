import { fetch, FetchMethods, FetchResultTypes } from '@sapphire/fetch';
import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';

interface TokenRequest {
	access_token: string;
}

export class SpotifyTask extends ScheduledTask {
	public constructor(context: ScheduledTask.LoaderContext, options: ScheduledTask.Options) {
		super(context, {
			...options,
			pattern: '*/5 * * * *',
			name: 'spotify'
		});
	}

	public override async run() {
		const clientId = process.env.SPOTIFY_CLIENT_ID;
		const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
		const allSpotCreds = await this.container.prisma.spotifyCreds.findMany();
		const encodedCredentials = Buffer.from(`${clientId}:${clientSecret}`, 'binary').toString('base64');

		for (const usrCred of allSpotCreds) {
			if (new Date().getTime() - new Date(usrCred.lastUpdated).getTime() >= 30 * 60 * 1000) {
				const params = new URLSearchParams();
				params.append('refresh_token', usrCred.refreshToken);
				params.append('grant_type', 'refresh_token');

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

				if (!response.access_token) return;

				await this.container.prisma.spotifyCreds.update({
					where: {
						discordId: usrCred.discordId
					},
					data: {
						accessToken: response.access_token,
						lastUpdated: new Date()
					}
				});

				return;
			} else {
				return;
			}
		}
	}
}

declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		spotify: never;
	}
}
