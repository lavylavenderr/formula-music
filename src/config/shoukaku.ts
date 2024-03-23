import spotifyWebApi from 'spotify-web-api-node';
import { Player, PlayOptions, Rest, Track } from 'shoukaku';
// import { parse, formatOpenURL } from 'spotify-uri';
import { FormulaDispatcher } from '../lib/dispatcher';
import { constructEmbed } from '../lib/embedbuilder';

const REGEX = /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?(track|playlist|album|artist)[\/:]([A-Za-z0-9]+)/;

let spotifyAccessToken: string | any;
const spotifyApi = new spotifyWebApi({
	clientId: process.env.SPOTIFY_CLIENT_ID,
	clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

async function refreshSpotifyToken() {
	spotifyAccessToken = await spotifyApi.clientCredentialsGrant();
	spotifyApi.setAccessToken(spotifyAccessToken.body['access_token']);
	setTimeout(() => {
		refreshSpotifyToken();
	}, spotifyAccessToken.body['expires_in'] * 1000);
}

class SpotifyPlayer extends Player {
	async playTrackNew(playable: PlayOptions, dispatcher: FormulaDispatcher) {
		// Check if the source is YouTube
		if (playable.metadata.sourceName === 'youtube') {
			let data;
			const meta = playable.metadata;

			if (playable.track) {
				playable.track = playable.track;
				return super.playTrack(playable);
			}

			const res = await dispatcher.player.node.rest.resolve(`${meta.author} - ${meta.title}`);

			if (!res?.data) {
				return dispatcher.play();
			}

			data = res!.data as Track;
			playable.track = data.encoded;
		}

		if (playable.metadata.sourceName === 'soundcloud') {
			let data;
			const meta = playable.metadata;
			const res = await dispatcher.player.node.rest.resolve(meta.uri!);

			if (res?.loadType === 'empty') {
				return dispatcher.channel.send({
					embeds: [
						constructEmbed({
							description: 'We were unable to locate a track with that provided query.'
						})
					]
				});
			}

			data = res!.data as Track;
			playable.track = data.encoded;
		}

		// If the source is Spotify
		if (playable.metadata.sourceName === 'spotify') {
			let m;
			let data;
			let res;

			m = await dispatcher.channel
				.send({
					embeds: [
						constructEmbed({
							description: '<:spotify:1219522954174529578> Attempting to download track from Spotify...'
						})
					]
				})
				.catch(() => null);

			try {
				res = await dispatcher.player.node.rest.resolve(`http://5.78.115.239:8001/track/${encodeURIComponent(playable.metadata.isrc!)}`);
			} catch {}

			if (res?.loadType === 'error') {
				// Give the SongDB 4 seconds to get it's shit together, 4 seems to be the sweet spot to prevent random skipping due to being sent an imcomplete track?
				await new Promise((resolve) => setTimeout(resolve, 4000));

				res = await dispatcher.player.node.rest.resolve(`http://5.78.115.239:8001/track/${encodeURIComponent(playable.metadata.isrc!)}`);

				if (!res?.data) {
					if (m) await m.edit('searching SoundCloud instead..').catch(() => null);
					const soundCloudRes = await dispatcher.player.node.rest.resolve(
						`scsearch: ${playable.metadata.author} - ${playable.metadata.title}`
					);

					if (!soundCloudRes || soundCloudRes.loadType === 'error') {
						if (m) m.delete().catch(() => null);
						return dispatcher.destroy('Lavalink Error');
					}
				} else if (res?.loadType === 'error') {
					if (m)
						return m.edit({
							embeds: [constructEmbed({ description: 'There was an error attempting to play your requested track, please try again.' })]
						});
					else
						return dispatcher.channel.send({
							embeds: [constructEmbed({ description: 'There was an error attempting to play your requested track, please try again.' })]
						});
				}
			}

			// Assign misc data to the object so it's accessible outside of this function.
			data = res!.data as Track;
			playable.metadata = data.info;
			playable.track = data.encoded;
			if (m) m.delete().catch(() => null);
		}

		// Http source
		if (playable.metadata.sourceName === 'http') {
			const res = await dispatcher.player.node.rest.resolve(playable.metadata.uri!);
			const data = res?.data as Track;

			playable.metadata = data.info;
			playable.track = data.encoded;
		}

		if (!playable.track) playable.track = playable.track;
		return super.playTrack(playable);
	}
}

class SpotifyRest extends Rest {
	// @ts-expect-error
	// TODO: I cba to try to find a proper solution at the moment, I'll come back to this.
	override async resolve(identifier: string) {
		if (!spotifyAccessToken) await refreshSpotifyToken();

		if (identifier.match(REGEX)) {
			const [, type, id] = identifier.match(REGEX) ?? [];

			switch (type) {
				case 'playlist':
					const playlistData = await spotifyApi.getPlaylist(id);
					const playlistTracks = await spotifyApi.getPlaylistTracks(id);
					const trackArray = [];

					if (playlistTracks.statusCode === 404)
						return {
							loadType: 'error',
							message: 'This playlist does not exist.'
						};

					for (const result of playlistTracks.body.items) {
						if (!result.track) return;

						trackArray.push({
							info: {
								artworkUrl: result.track.album.images[0].url,
								author: result.track.artists.map((k) => k.name).join(', '),
								identifier: result.track.id,
								isSeekable: false,
								isStream: false,
								isrc: result.track.external_ids.isrc,
								length: result.track.duration_ms,
								position: -1,
								sourceName: 'spotify',
								title: result.track.name,
								uri: `https://open.spotify.com/track/${result.track.id}`
							}
						});
					}

					while (trackArray.length !== playlistData.body.tracks.total) {
						const playlistTracksOnceAgain = await spotifyApi.getPlaylistTracks(id, {
							offset: trackArray.length,
						});

						playlistTracksOnceAgain.body.items.forEach((result) => {
							if (!result.track) return;

							trackArray.push({
								info: {
									artworkUrl: result.track.album.images[0].url,
									author: result.track.artists.map((k) => k.name).join(', '),
									identifier: result.track.id,
									isSeekable: false,
									isStream: false,
									isrc: result.track.external_ids.isrc,
									length: result.track.duration_ms,
									position: -1,
									sourceName: 'spotify',
									title: result.track.name,
									uri: `https://open.spotify.com/track/${result.track.id}`
								}
							});
						});
					}

					return {
						loadType: 'playlist',
						playlistInfo: { selectedTrack: -1, length: playlistData.body.tracks.total,  name: playlistData.body.name, coverImg: playlistData.body.images[0].url },
						data: { tracks: trackArray }
					};
				case 'track':
					const trackData = await spotifyApi.getTrack(id);

					if (!trackData)
						return {
							loadType: 'error',
							message: 'Unable to locate song'
						};

					return {
						loadType: 'track',
						playlistInfo: {},
						data: {
							info: {
								artworkUrl: trackData.body.album.images[0].url,
								author: trackData.body.artists.map((k) => k.name).join(', '),
								identifier: trackData.body.id,
								isSeekable: false,
								isStream: false,
								isrc: trackData.body.external_ids.isrc,
								length: trackData.body.duration_ms,
								position: -1,
								sourceName: 'spotify',
								title: trackData.body.name,
								uri: `https://open.spotify.com/track/${trackData.body.id}`
							}
						}
					};
				default:
					return {
						loadType: 'error',
						message: 'This type of link is not supported just yet.'
					};
			}
		}

		try {
			new URL(identifier);
			let data = await super.resolve(identifier);

			return data;
		} catch (e) {
			let searchData;

			searchData = await spotifyApi.searchTracks(identifier, { limit: 1 });
			if (!searchData?.body.tracks) return super.resolve(`scsearch:${identifier}`);

			return {
				loadType: 'track',
				playlistInfo: {},
				data: {
					info: {
						title: searchData.body.tracks.items[0].name,
						author: searchData.body.tracks.items[0].artists.map((k) => k.name).join(', '),
						identifier: searchData.body.tracks.items[0].id,
						isrc: searchData.body.tracks.items[0].external_ids.isrc,
						isSeekable: true,
						isStream: true,
						sourceName: 'spotify',
						artworkUrl: searchData.body.tracks.items[0].album.images[searchData.body.tracks.items[0].album.images.length - 1].url,
						length: searchData.body.tracks.items[0].duration_ms,
						uri: `https://open.spotify.com/track/${searchData.body.tracks.items[0].id}`
					}
				}
			};
		}
	}
}

declare module 'shoukaku' {
	interface PlayOptions {
		metadata: {
			identifier: string;
			isSeekable: boolean;
			author: string;
			length: number;
			isStream: boolean;
			position: number;
			title: string;
			uri?: string;
			artworkUrl?: string;
			isrc?: string;
			sourceName: string;
		};
	}

	interface PlaylistResult {
		playlistInfo: {
			selectedTrack: number;
			name: string;
			coverImg: string;
		};
	}
}

export default {
	structures: { rest: SpotifyRest, player: SpotifyPlayer },
	restTimeout: 500000,
	userAgent: 'FormulaMusic/1.0',
	moveOnDisconnect: true,
	resumable: true,
	reconnectTries: 100,
	resumableTimeout: 30
};
