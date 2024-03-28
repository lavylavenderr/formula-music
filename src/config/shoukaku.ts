import spotifyWebApi from 'spotify-web-api-node';
import { Player, PlayOptions, Rest, Track } from 'shoukaku';
import { FormulaDispatcher } from '../lib/dispatcher';
import { constructEmbed } from '../lib/embedbuilder';
import { container } from '@sapphire/pieces';

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
				res = await dispatcher.player.node.rest.resolve(`http://88.99.137.157:8001/track/${encodeURIComponent(playable.metadata.isrc!)}`);
			} catch {}

			if (res?.loadType === 'error') {
				// Give the SongDB 6 and a half seconds to get it's shit together, 6.5 seems to be the sweet spot to prevent random skipping due to being sent an imcomplete track?
				await new Promise((resolve) => setTimeout(resolve, 6500));

				res = await dispatcher.player.node.rest.resolve(`http://88.99.137.157:8001/track/${encodeURIComponent(playable.metadata.isrc!)}`);

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
					if (m) {
						dispatcher.destroy('Lavalink Error');
						return m.edit({
							embeds: [constructEmbed({ description: 'There was an error attempting to play your requested track, please try again.' })]
						});
					} else {
						dispatcher.destroy('Lavalink Error');
						return dispatcher.channel.send({
							embeds: [constructEmbed({ description: 'There was an error attempting to play your requested track, please try again.' })]
						});
					}
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
	override async resolve(identifier: string): Promise<any> {
		try {
			const { prisma } = container;
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

						const artistIds: { id: string; name: string }[] = [];

						// Extract unique artist IDs from all tracks in the playlist
						for (const result of playlistTracks.body.items) {
							if (!result.track) continue;

							for (const artist of result.track.artists) {
								artistIds.push({ id: artist.id, name: artist.name });
							}

							trackArray.push(result.track);
						}

						while (trackArray.length !== playlistData.body.tracks.total) {
							// @ts-expect-error
							const playlistTracks = await spotifyApi.getPlaylistTracks(id, {
								offset: trackArray.length
							});

							// @ts-expect-error
							for (const result of playlistTracks.body.items) {
								if (!result.track) continue;

								for (const artist of result.track.artists) {
									artistIds.push({ id: artist.id, name: artist.name });
								}

								trackArray.push(result.track);
							}
						}

						// Process artist info and insert/update into the database
						artistIds.forEach(async (artist) => {
							await prisma.artist.upsert({
								create: {
									name: artist.name,
									spotifyId: artist.id
								},
								update: {
									streams: {
										increment: 1
									}
								},
								where: {
									spotifyId: artist.id
								}
							});
						});

						// Process tracks and insert/update into the database
						trackArray.forEach(async (track) => {
							// Construct artist connection objects for the current track
							// @ts-expect-error
							const artistConnectQueries = track.artists.forEach((artist) => ({
								spotifyId: artist.id
							}));

							// Upsert the song into the database
							await prisma.song.upsert({
								create: {
									title: track.name,
									spotifyId: track.id,
									isrc: track.external_ids.isrc!,
									artists: {
										connect: artistConnectQueries
									}
								},
								update: {
									artists: {
										connect: artistConnectQueries
									}
								},
								where: {
									spotifyId: track.id
								}
							});
						});

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
						const artists: { id: string; name: string }[] = [];

						if (!trackData)
							return {
								loadType: 'error',
								message: 'Unable to locate song'
							};

						trackData.body.artists.forEach((artist) => {
							artists.push({ id: artist.id, name: artist.name });
						});

						artists.forEach(async (artist) => {
							await prisma.artist.upsert({
								create: {
									name: artist.name,
									spotifyId: artist.id
								},
								update: {
									streams: {
										increment: 1
									}
								},
								where: {
									spotifyId: artist.id
								}
							});
						});

						const artistConnectQueries = trackData.body.artists.forEach((artist) => ({
							spotifyId: artist.id
						}));

						// Upsert the song into the database
						await prisma.song.upsert({
							create: {
								title: trackData.body.name,
								spotifyId: trackData.body.id,
								isrc: trackData.body.external_ids.isrc!,
								artists: {
									// @ts-expect-error
									connect: artistConnectQueries
								}
							},
							update: {
								artists: {
									// @ts-expect-error
									connect: artistConnectQueries
								}
							},
							where: {
								spotifyId: trackData.body.id
							}
						});

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

				for (const artist of searchData.body.tracks.items[0].artists) {
					const query = await prisma.artist.upsert({
						create: {
							name: artist.name,
							spotifyId: artist.id
						},
						update: {
							streams: {
								increment: 1
							}
						},
						where: {
							spotifyId: artist.id
						}
					});

					await prisma.song.upsert({
						create: {
							title: searchData.body.tracks.items[0].name,
							spotifyId: searchData.body.tracks.items[0].id,
							isrc: searchData.body.tracks.items[0].external_ids.isrc!,
							artists: {
								connect: {
									id: query.id
								}
							}
						},
						update: {
							artists: {
								connect: {
									id: query.id
								}
							}
						},
						where: {
							spotifyId: searchData.body.tracks.items[0].id
						}
					});
				}

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
