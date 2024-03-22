import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { GuildMember, TextChannel } from 'discord.js';
import { constructEmbed } from '../../lib/embedbuilder';
import { capitalizeFirstLetter, humanizeMs } from '../../lib/utils';

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
					);
			},
			{ idHints: ['1219431349774192690'] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply({ ephemeral: true });

		const shoukaku = this.container.shoukaku;
		const node = shoukaku.options.nodeResolver(shoukaku.nodes);
		const query = interaction.options.getString('query');

		if (!query) {
			return interaction.editReply({
				embeds: [
					constructEmbed({
						description: 'Please provide a valid query.'
					})
				]
			});
		}

		const result = await node?.rest.resolve(query);

		if (!result || !result.loadType || (result.loadType === 'search' && result.data.length === 0)) {
			return interaction.editReply({
				embeds: [
					constructEmbed({
						description: 'Sorry, we were unable to find any tracks with that query.'
					})
				]
			});
		}

		let songInfo;
		let playlistInfo;
		let dispatcher;
		const trackArray: any[] = [];

		switch (result.loadType) {
			case 'search':
				songInfo = result.data[0].info;
				break;
			case 'empty':
				return interaction.editReply({
					embeds: [
						constructEmbed({
							description: 'Sorry, we were unable to find any tracks with that query.'
						})
					]
				});
			case 'playlist':
				songInfo = result.data.tracks.shift()!.info;
				playlistInfo = result.playlistInfo;

				for (const track of result.data.tracks) {
					trackArray.push(track.info);
				}
				break;
			case 'track':
				songInfo = result.data.info;
				break;
			default:
				return interaction.editReply({
					embeds: [
						constructEmbed({
							description: 'Sorry, we were unable to find any tracks with that query.'
						})
					]
				});
		}

		dispatcher = this.container.queue.get(interaction.guildId);

		if (dispatcher) {
			const interactionGuild = this.container.client.guilds.cache.get(interaction.guildId!);
			const botMember = interactionGuild?.members.cache.get(this.container.client.id!);
			const interactionMember = interactionGuild?.members.cache.get(interaction.user.id);

			if (
				!botMember?.voice.channelId ||
				!interactionMember?.voice.channelId ||
				botMember.voice.channelId !== interactionMember.voice.channelId
			) {
				return interaction.editReply({
					embeds: [
						constructEmbed({
							description: 'Sorry, you must be in the same channel as the discord bot.'
						})
					]
				});
			}

			dispatcher.queue.push(songInfo);

			if (trackArray.length !== 0) {
				for (const track of trackArray) {
					dispatcher.queue.push(track);
				}
			}

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
								name: 'Track Length',
								// @ts-expect-error
								value: humanizeMs(result.loadType === 'playlist' ? playlistInfo.length ?? 0 : songInfo.length),
								inline: true
							},
							{
								name: 'Source',
								value: capitalizeFirstLetter(songInfo.sourceName ?? 'Unknown'),
								inline: true
							}
						]
					})
				]
			});
		} else {
			dispatcher = (await this.container.queue.handle(
				interaction.guild!,
				interaction.member as GuildMember,
				interaction.channel as TextChannel,
				songInfo
			)) ;

			if (!dispatcher) {
				return interaction.editReply({
					embeds: [
						constructEmbed({
							description: "Oops! I'm already in another voice channel at the moment."
						})
					]
				});
			}

			if (trackArray.length !== 0) {
				for (const track of trackArray) {
					dispatcher.queue.push(track);
				}
			}

			dispatcher.play();
			if (!dispatcher.current) dispatcher.play();

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
										? playlistInfo!.name
										: `[**${songInfo.title} by ${songInfo.author}**](${songInfo.uri})`,
								inline: false
							},
							{
								name: `${result.loadType === "playlist" ? "Playlist Length" : "Track Length"}`,
								value: String(result.loadType === "playlist" ? dispatcher.queue.length + 1 : humanizeMs(songInfo.length)),
								inline: true
							},
							{
								name: 'Source',
								value: capitalizeFirstLetter(songInfo.sourceName ?? 'Unknown'),
								inline: true
							}
						]
					})
				]
			});
		}
	}
}
