import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { CommandInteraction, GuildMember, TextChannel } from 'discord.js';
import { constructEmbed } from '../../lib/embedbuilder';
import { capitalizeFirstLetter, humanizeMs } from '../../lib/utils';
import { FormulaDispatcher } from '../../lib/dispatcher';

interface ModifiedTrackData {
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
}

@ApplyOptions<Command.Options>({
	description: 'Play music!',
	preconditions: ['GuildOnly', 'InVoiceChannel']
})
export class PlayCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) => {
				builder
					.setName('play')
					.setDescription(this.description)
					.addStringOption((option) =>
						option.setName('query').setDescription('What would you like to play?').setAutocomplete(true).setRequired(true)
					)
					.addStringOption((option) =>
						option
							.setName('source')
							.setDescription('Where would this query be searched for?')
							.addChoices(
								{ name: 'Soundcloud', value: 'soundcloud' },
								{ name: 'Apple Music', value: 'apple' },
								{ name: 'Deezer', value: 'deezer' }
							)
					);
			},
			{ idHints: ['1219431349774192690'] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply({ ephemeral: true });

		let query = interaction.options.getString('query');
		const shoukaku = this.container.shoukaku;
		const node = shoukaku.options.nodeResolver(shoukaku.nodes);
		const source = interaction.options.getString('source') ?? 'spotify';

		if (!query) {
			return this.sendInvalidQueryReply(interaction);
		}

		if (source == 'soundcloud') query = 'scsearch:' + query;
		else if (source == 'deezer') query = 'dzsearch:' + query;
		else if (source == 'apple') query = 'amsearch:' + query;

		const result = await node?.rest.resolve(query);

		if (!result || !result.loadType || (result.loadType === 'search' && result.data.length === 0)) {
			return this.sendNoTracksFoundReply(interaction);
		}

		let songInfo;
		let playlistInfo;
		let dispatcher: FormulaDispatcher | null;
		let trackArray: any[] = [];

		switch (result.loadType) {
			case 'search':
				songInfo = result.data[0].info as ModifiedTrackData;
				songInfo.requestedBy = interaction.user.id;
				break;
			case 'empty':
				return this.sendNoTracksFoundReply(interaction);
			case 'playlist':
				({ songInfo, playlistInfo, trackArray } = this.processPlaylist(result, interaction));
				break;
			case 'track':
				songInfo = result.data.info as ModifiedTrackData;
				songInfo.requestedBy = interaction.user.id;
				break;
			case 'error':
				return this.sendNoTracksFoundReply(interaction);
			default:
				return this.sendNoTracksFoundReply(interaction);
		}

		dispatcher = this.container.queue.get(interaction.guildId);

		if (!dispatcher) {
			dispatcher = await this.container.queue.handle(
				interaction.guild!,
				interaction.member as GuildMember,
				interaction.channel as TextChannel,
				songInfo
			);

			if (!dispatcher) {
				return this.sendAlreadyInVoiceChannelReply(interaction);
			}

			if (trackArray.length !== 0) {
				trackArray.forEach((track) => dispatcher!.queue.push(track));
			}

			dispatcher.play();
			if (!dispatcher.current) dispatcher.play();
		} else {
			this.addToQueue(dispatcher, songInfo, trackArray);
			if (!dispatcher.current) dispatcher.play();
		}

		return interaction.editReply({
			embeds: [constructEmbed(this.generateEmbedData(result, songInfo, playlistInfo))]
		});
	}

	private processPlaylist(result: any, interaction: CommandInteraction) {
		const songInfo = result.data.tracks.shift()!.info;
		const playlistInfo = result.playlistInfo;
		const trackArray: any[] = [];

		for (const track of result.data.tracks) {
			const modifiedData = {
				...track.info,
				requestedBy: interaction.user.id
			};
			trackArray.push(modifiedData);
		}

		return { songInfo, playlistInfo, trackArray };
	}

	private addToQueue(dispatcher: any, songInfo: any, trackArray: any[]) {
		dispatcher.queue.push(songInfo);

		if (trackArray.length !== 0) {
			trackArray.forEach((track) => {
				dispatcher.queue.push(track);
			});
		}
	}

	private sendInvalidQueryReply(interaction: Command.ChatInputCommandInteraction) {
		return interaction.editReply({
			embeds: [
				constructEmbed({
					description: 'Please provide a valid query.'
				})
			]
		});
	}

	private sendNoTracksFoundReply(interaction: Command.ChatInputCommandInteraction) {
		return interaction.editReply({
			embeds: [
				constructEmbed({
					description: 'Sorry, we were unable to find any tracks with that query.'
				})
			]
		});
	}

	private sendAlreadyInVoiceChannelReply(interaction: Command.ChatInputCommandInteraction) {
		return interaction.editReply({
			embeds: [
				constructEmbed({
					description: "Oops! I'm already in another voice channel at the moment."
				})
			]
		});
	}

	private generateEmbedData(result: any, songInfo: any, playlistInfo: any) {
		return {
			title: `Added ${result.loadType === 'playlist' ? 'Playlist' : 'Track'}`,
			thumbnail: result.loadType === 'playlist' ? playlistInfo?.coverImg : songInfo.artworkUrl,
			fields: [
				{
					name: `${result.loadType === 'playlist' ? 'Playlist Name' : 'Track'}`,
					value: result.loadType === 'playlist' ? playlistInfo!.name : `[**${songInfo.title} by ${songInfo.author}**](${songInfo.uri})`,
					inline: false
				},
				{
					name: `${result.loadType === 'playlist' ? 'Playlist Length' : 'Track Length'}`,
					value: String(result.loadType === 'playlist' ? playlistInfo!.length : humanizeMs(songInfo.length)),
					inline: true
				},
				{
					name: `${result.loadType === 'playlist' ? 'Estimated Playlist Time' : 'Source'}`,
					value:
						result.loadType === 'playlist'
							? String(humanizeMs(result.data.tracks.reduce((acc: any, obj: any) => acc + obj.info.length, 0)))
							: capitalizeFirstLetter(songInfo.sourceName ?? 'Unknown').replace('Applemusic', 'Apple Music'),
					inline: true
				}
			]
		};
	}
}
