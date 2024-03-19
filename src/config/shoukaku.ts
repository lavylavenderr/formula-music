import spotifyWebApi from 'spotify-web-api-node';
import { LoadType, Player, PlayOptions, Rest, Track } from 'shoukaku';
import { parse, formatOpenURL } from 'spotify-uri';
import { FormulaDispatcher } from '../lib/dispatcher';
import { constructEmbed } from '../lib/embedbuilder';
import { DataManager } from 'discord.js';

const REGEX = /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?(track|playlist|album|artist)[\/:]([A-Za-z0-9]+)/;

let spotifyAccessToken: string | any;
const spotifyApi = new spotifyWebApi({
	clientId: '7ca2d37584a141029b013337e4a8673d',
	clientSecret: 'e57dd7c03d3747daaea2723b9d3709f0'
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
		console.log(playable);
		// Check if the source is YouTube
		if (playable?.songData?.source === 'youtube' || playable.songData.info.sourceName == 'youtube') {
			let data;
			const meta = playable.songData.metadata ?? playable.songData.info;

			if (playable.songData.encoded) {
				playable.track = playable.songData.encoded;
				return super.playTrack(playable);
			}

			const res = await dispatcher.player.node.rest.resolve(`${meta.author} - ${meta.title}`);

			if (!res?.data) {
				return dispatcher.play();
			}

			data = res!.data as Track;
			playable.track = data.encoded;
		}

		// If the source is Spotify
		if (playable.songData.source === 'spotify') {
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
				res = await dispatcher.player.node.rest.resolve(
					`http://5.78.115.239:8001/track/${encodeURIComponent(playable.songData.metadata.isrc)}`
				);
			} catch {}

			if (res?.loadType === 'error') {
				m
					?.edit({
						embeds: [
							constructEmbed({ description: "<:spotify:1219522954174529578> Oops! Something went wrong... let's try that again!" })
						]
					})
					.catch(() => null);

				// Give the SongDB 5 seconds to get it's shit together
				await new Promise((resolve) => setTimeout(resolve, 5000));

				res = await dispatcher.player.node.rest.resolve(
					`http://5.78.115.239:8001/track/${encodeURIComponent(playable.songData.metadata.isrc)}`
				);

				if (!res?.data) {
					if (m) await m.edit('searching SoundCloud instead..').catch(() => null);
					const soundCloudRes = await dispatcher.player.node.rest.resolve(
						`scsearch: ${playable.songData.author} - ${playable.songData.title}`
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

			data = res!.data as Track;
			playable.track = data.encoded;
			if (m) m.delete().catch(() => null);
		}

		if (!playable.track) playable.track = playable.songData.encoded

		return super.playTrack(playable);
	}
}

// TODO: Convert tracks into custom format so it's global, not mix and match between Lavaplayer and my preferences ;)	
class SpotifyRest extends Rest {
	// @ts-expect-error
	// TODO: I cba to try to find a proper solution at the moment, I'll come back to this.
	override async resolve(identifier: string, source: string) {
		if (!spotifyAccessToken) await refreshSpotifyToken();

		if (identifier.match(REGEX)) {
			const [, type, id] = identifier.match(REGEX) ?? [];

			switch (type) {
				case 'album':
					const albumData = await spotifyApi.getAlbum(id);
					let albumNames = [];

					while (albumNames.length < albumData.body.total_tracks) {
						// @ts-expect-error
						let albumTrackRes = await spotifyApi.getAlbumTracks(id, {
							limit: 50,
							offset: albumNames.length
						});

						albumNames.push(
							...albumTrackRes.body.items.map((k: any) => {
								return {
									track: {
										spotify: true
									},
									info: {
										author: k.artists.map((k: any) => k.name).join(', '),
										identifier: k.id,
										isSeekable: false,
										isStream: false,
										length: k.duration_ms,
										position: -1,
										sourceName: 'Spotify',
										title: k.name,
										uri: formatOpenURL(parse(k.uri)),
										tn: albumData.body.images[0].url,
										isrc: k.external_ids?.isrc
									}
								};
							})
						);
					}

					return {
						loadType: 'PLAYLIST_LOADED',
						playlistInfo: { selectedTrack: -1, name: albumData.body.name },
						tracks: albumNames
					};
				case 'artist':
					const artistData = await spotifyApi.getArtist(id);

					return {
						loadType: 'PLAYLIST_LOADED',
						playlistInfo: { selectedTrack: -1, name: artistData.body.name },
						tracks: (await spotifyApi.getArtistTopTracks(id, 'US')).body.tracks.map((k) => {
							return {
								track: {
									spotify: true
								},
								info: {
									author: k.artists.map((k) => k.name).join(', '),
									identifier: k.id,
									isSeekable: false,
									isStream: false,
									length: k.duration_ms,
									position: -1,
									sourceName: 'Spotify',
									title: k.name,
									uri: formatOpenURL(parse(k.uri)),
									tn: k.album.images[0].url,
									isrc: k.external_ids?.isrc
								}
							};
						})
					};
				case 'playlist':
					const playlistData = await spotifyApi.getPlaylist(id);
					let playlistNames = [];

					let next = true;

					while (next) {
						// @ts-expect-error
						let playlistTrackRes = await spotifyApi.getPlaylistTracks(id, {
							limit: 50,
							offset: playlistNames.length
						});

						next = playlistTrackRes.body.next;

						playlistNames.push(
							// @ts-expect-error
							...playlistTrackRes.body.items.map((k) => {
								return k.track
									? {
											track: {
												spotify: true
											},
											info: {
												// @ts-expect-error
												author: k.track.artists.map((k) => k.name).join(', '),
												identifier: k.track.id,
												isSeekable: false,
												isStream: false,
												length: k.track.duration_ms,
												position: -1,
												sourceName: 'Spotify',
												title: k.track.name,
												uri: formatOpenURL(parse(k.track.uri)),
												tn: k.track.album.images[0].url,
												isrc: k.track.external_ids?.isrc
											}
										}
									: null;
							})
						);
					}

					return {
						loadType: 'PLAYLIST_LOADED',
						playlistInfo: { selectedTrack: -1, name: playlistData.body.name },
						tracks: playlistNames.filter((n) => n)
					};
				case 'track':
					const trackData = await spotifyApi.getTrack(id);

					if (!trackData)
						return {
							loadType: LoadType.ERROR,
							message: 'Unable to locate song'
						};

					return {
						loadType: 'TRACK_LOADED',
						playlistInfo: {},
						track: {
							source: 'spotify',
							metadata: {
								title: trackData.body.name,
								author: trackData.body.artists.map((k) => k.name).join(', '),
								identifier: trackData.body.id,
								isrc: trackData.body.external_ids.isrc,
								isSeekable: true,
								isStream: true,
								albumArt: trackData.body.album.images[0].url,
								length: trackData.body.duration_ms
							}
						}
					};
				default:
					break;
			}
		}

		try {
			new URL(identifier);
			let data = await super.resolve(identifier);
			console.log(DataManager);

			switch (data?.loadType) {
				case "track":
					
					break;
				case LoadType.PLAYLIST:
					data.data.tracks.forEach((_, i) => {
						data.data.tracks[i].source = source;
					});
					break;
			}

			return data;
		} catch (e) {
			let searchData;

			if (source == 'spotify') searchData = await spotifyApi.searchTracks(identifier, { limit: 1 });
			if (source !== 'spotify' || !searchData?.body.tracks) return super.resolve(`scsearch:${identifier}`);

			return {
				loadType: 'TRACK_LOADED',
				playlistInfo: {},
				track: {
					source: 'spotify',
					metadata: {
						title: searchData.body.tracks.items[0].name,
						author: searchData.body.tracks.items[0].artists.map((k) => k.name).join(', '),
						identifier: searchData.body.tracks.items[0].id,
						isrc: searchData.body.tracks.items[0].external_ids.isrc,
						isSeekable: true,
						isStream: true,
						albumArt: searchData.body.tracks.items[0].album.images[searchData.body.tracks.items[0].album.images.length - 1].url,
						length: searchData.body.tracks.items[0].duration_ms
					}
				}
			};
		}
	}
}

declare module 'shoukaku' {
	interface Track {
		source: string;
	}
	interface PlayOptions {
		[key: string]: any;
	}
}

export default {
	structures: { rest: SpotifyRest, player: SpotifyPlayer },
	restTimeout: 500000,
	moveOnDisconnect: true,
	resumable: true,
	reconnectTries: 100,
	resumableTimeout: 30
};
