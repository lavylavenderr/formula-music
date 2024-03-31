import spotifyWebApi from 'spotify-web-api-node';
import { Player, PlayOptions, Rest, Track } from 'shoukaku';
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
		// Lovely Youtube
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

		// Deezer or Spotify or Apple Music (All streamed from Deezer)
		console.log(playable.metadata.sourceName)
		if (
			playable.metadata.sourceName === 'deezer' ||
			playable.metadata.sourceName === 'spotify' ||
			playable.metadata.sourceName === 'applemusic'
		) {
			let m;
			let data;

			m = await dispatcher.channel
				.send({
					embeds: [
						constructEmbed({
							description: '<:deezer:1223917076293357619> Attempting to stream track..'
						})
					]
				})
				.catch(() => null);

			const res = await dispatcher.player.node.rest.resolve(`dzisrc:${playable.metadata.isrc}`);

			if (res?.loadType === 'error') {
				if (m)
					await m
						.edit({
							embeds: [
								constructEmbed({
									description: '<:soundcloud:1220152120624545864> Searching SoundCloud instead...'
								})
							]
						})
						.catch(() => null);
				const soundCloudRes = await dispatcher.player.node.rest.resolve(`scsearch: ${playable.metadata.author} - ${playable.metadata.title}`);

				if (!soundCloudRes || soundCloudRes.loadType === 'error') {
					if (m) {
						dispatcher.destroy('Lavalink Error');
						m.edit({
							embeds: [constructEmbed({ description: 'There was an error attempting to play your requested track, please try again.' })]
						});
					} else {
						dispatcher.destroy('Lavalink Error');
						dispatcher.channel.send({
							embeds: [constructEmbed({ description: 'There was an error attempting to play your requested track, please try again.' })]
						});
					}

					return dispatcher.destroy('Lavalink Error');
				}
			}

			if (!res?.data) {
				return dispatcher.play();
			}

			data = res!.data as Track;
			playable.track = data.encoded;
			if (m) await m.delete().catch(() => null);
		}

		// Soundcloud!
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

		// If a URL is provided.
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
	override async resolve(identifier: string): Promise<any> {
		try {
			if (!spotifyAccessToken) await refreshSpotifyToken();

			// Independent Spotify Resolver because yes.
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

						// Filter through stuff
						for (const result of playlistTracks.body.items) {
							if (!result.track) continue;
							trackArray.push(result.track);
						}

						while (trackArray.length !== playlistData.body.tracks.total) {
							// TODO: fix types here	
							const playlistTracks = await spotifyApi.getPlaylistTracks(id, {
								offset: trackArray.length
							}) as any;

							for (const result of playlistTracks.body.items) {
								if (!result.track) continue;
								trackArray.push(result.track);
							}
						}

						return {
							loadType: 'playlist',
							playlistInfo: {
								selectedTrack: -1,
								length: playlistData.body.tracks.total,
								name: playlistData.body.name,
								coverImg: playlistData.body.images[0].url
							},
							data: {
								tracks: trackArray.map((track) => ({
									info: {
										artworkUrl: track.album.images[0].url,
										author: track.artists.map((artist: any) => artist.name).join(', '),
										identifier: track.id,
										isSeekable: false,
										isStream: false,
										isrc: track.external_ids.isrc,
										length: track.duration_ms,
										position: -1,
										sourceName: 'spotify',
										title: track.name,
										uri: `https://open.spotify.com/track/${track.id}`
									}
								}))
							}
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
		} catch (e) {
			console.log(e);

			return {
				loadType: 'error',
				message: 'A unknown error has occured, try again later.'
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
			requestedBy?: string;
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
	restTimeout: 20000,
	userAgent: 'FormulaMusic/1.0',
	moveOnDisconnect: true,
	resumable: true,
	reconnectTries: 10,
	resumableTimeout: 30,
	resumeByLibrary: true,
	voiceConnectionTimeout: 30000
};
