import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { constructEmbed } from '../../lib/embedbuilder';
import { capitalizeFirstLetter, humanizeMs } from '../../lib/utils';

@ApplyOptions<Command.Options>({
	description: 'Insert a track to be played next.',
	preconditions: ['GuildOnly', 'InVoiceChannel']
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.addStringOption((option) =>
					option.setName('query').setDescription('What would you like to play?').setAutocomplete(true).setRequired(true)
				)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply({ ephemeral: true });

		const shoukaku = this.container.shoukaku;
		const node = shoukaku.options.nodeResolver(shoukaku.nodes);
		const dispatcher = this.container.queue.get(interaction.guild!.id);
		const query = interaction.options.getString('query');

		if (!dispatcher) {
			return this.sendErrorMessage(interaction, "The bot currently isn't in a voice channel.");
		}

		if (!query) {
			return this.sendErrorMessage(interaction, 'Please provide a valid query.');
		}

		const result = await node?.rest.resolve(query);

		if (!result || !result.loadType || (result.loadType === 'search' && result.data.length === 0)) {
			return this.sendErrorMessage(interaction, 'Sorry, we were unable to find any tracks with that query.');
		}

		let songInfo;
		let playlistInfo;
		const trackArray: any[] = [];

		switch (result.loadType) {
			case 'search':
				songInfo = result.data[0].info;
				break;
			case 'empty':
				return this.sendErrorMessage(interaction, 'Sorry, we were unable to find any tracks with that query.');
			case 'playlist':
				songInfo = result.data.tracks.shift()!.info;
				playlistInfo = result.playlistInfo;

				result.data.tracks.forEach((track: any) => {
					trackArray.push(track.info);
				});
				break;
			case 'track':
				songInfo = result.data.info;
				break;
			default:
				return this.sendErrorMessage(interaction, 'Sorry, we were unable to find any tracks with that query.');
		}

		if (trackArray.length !== 0) {
			dispatcher.queue.unshift(...trackArray);
		}

		dispatcher.queue.unshift(songInfo);

		return interaction.editReply({
			embeds: [
				constructEmbed({
					title: `Added ${result.loadType === 'playlist' ? 'Playlist' : 'Track'}`,
					thumbnail: result.loadType === 'playlist' ? playlistInfo?.coverImg : songInfo.artworkUrl,
					fields: [
						{
							name: `${result.loadType === 'playlist' ? 'Playlist Name' : 'Track'}`,
							value:
								result.loadType === 'playlist'
									? playlistInfo?.name!
									: `[**${songInfo.title} by ${songInfo.author}**](${songInfo.uri})`,
							inline: false
						},
						{
							name: `${result.loadType === 'playlist' ? 'Playlist Length' : 'Track Length'}`,
							value: String(result.loadType === 'playlist' ? dispatcher.queue.length + 1 : humanizeMs(songInfo.length)),
							inline: true
						},
						{
							name: `${result.loadType === 'playlist' ? 'Estimated Playlist Time' : 'Source'}`,
							value:
								result.loadType === 'playlist'
									? String(humanizeMs(result.data.tracks.reduce((acc: any, obj: any) => acc + obj.info.length, 0)))
									: capitalizeFirstLetter(songInfo.sourceName ?? 'Unknown'),
							inline: true
						}
					]
				})
			]
		});
	}

	private sendErrorMessage(interaction: Command.ChatInputCommandInteraction, message: string) {
		return interaction.editReply({
			embeds: [
				constructEmbed({
					description: message
				})
			]
		});
	}
}
