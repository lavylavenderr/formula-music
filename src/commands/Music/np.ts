import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { constructEmbed } from '../../lib/embedbuilder';
import { EmbedBuilder } from 'discord.js';
import { getRandomHexColor, millisecondsToMinutesSeconds } from '../../lib/utils';

@ApplyOptions<Command.Options>({
	description: 'Get the current track.',
	preconditions: ['GuildOnly', 'InVoiceChannel']
})
export class SeekCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder.setName('np').setDescription(this.description));
	}

	// TODO: Fix loading bar
	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply();

		const dispatcher = this.container.queue.get(interaction.guild!.id);
		const trackData = dispatcher.current;

		if (!dispatcher) {
			return interaction.editReply({
				embeds: [
					constructEmbed({
						description: "The bot currently isn't in a voice channel."
					})
				]
			});
		} else if (!trackData) {
			return interaction.editReply({
				embeds: [
					constructEmbed({
						description: "There currently isn't a track playing."
					})
				]
			});
		}

		const userInfo = this.container.client.users.cache.get(trackData.requestedBy);
		const nowPlayingEmbed = new EmbedBuilder()
			.addFields([
				{
					name: 'Name',
					value: `[**${trackData.title || 'Unknown'} by ${trackData.author || 'Unknown'}**](${trackData.uri})`,
					inline: false
				},
				{
					name: 'Length',
					value: millisecondsToMinutesSeconds(trackData.length),
					inline: true
				},
				{
					name: 'Track Position',
					value: millisecondsToMinutesSeconds(dispatcher.player.position),
					inline: true
				}
			])
			.setThumbnail(trackData.artworkUrl)
			.setColor(getRandomHexColor())
			.setFooter({ iconURL: userInfo?.avatarURL() || '', text: `Requested by ${userInfo?.username}` })
			.setTimestamp();

		return interaction.editReply({
			embeds: [nowPlayingEmbed]
		});
	}
}
