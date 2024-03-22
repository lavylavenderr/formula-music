import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { AutocompleteInteraction } from 'discord.js';
import { fetch, FetchResultTypes } from '@sapphire/fetch';

interface AlbumCover {
	height: number;
	url: string;
	width: number;
}

interface TrackData {
	artist: string;
	track: string;
	album_covers: AlbumCover[];
	spotifyId: string;
}

interface QueryFetch {
	success: boolean;
	data: TrackData[];
}

export class AutocompleteHandler extends InteractionHandler {
	public constructor(ctx: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Autocomplete
		});
	}

	public override async run(interaction: AutocompleteInteraction, result: InteractionHandler.ParseResult<this>) {
		return interaction.respond(result);
	}

	public override async parse(interaction: AutocompleteInteraction) {
		if (interaction.commandId === '1219431349774192690') {
			try {
				const focusedOption = interaction.options.getFocused(true);
				if (focusedOption.name === 'query') {
					if (focusedOption.value === '') return this.none();

					const res = await fetch<QueryFetch>(
						`https://api.lavylavender.com/spotify/search?query=${encodeURIComponent(focusedOption.value)}`,
						FetchResultTypes.JSON
					);

					return this.some(
						res.data.map(({ track, artist, spotifyId }) => {
							let name = `${track.slice(0, 40)} by ${artist.slice(0, 39)}`;
							if (name.length > 100) {
								name = name.slice(0, 97) + '...';
							}
							return { name: name, value: `https://open.spotify.com/track/${spotifyId}` };
						})
					);
				}
			} catch {}

			return this.none();
		} else {
			return this.none();
		}
	}
}
