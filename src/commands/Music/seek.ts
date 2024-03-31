import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { constructEmbed } from '../../lib/embedbuilder';
import { secondsToMilliseconds } from 'date-fns';
import { timeToSeconds } from '../../lib/utils';

@ApplyOptions<Command.Options>({
	description: 'Seek the current track forward or backwards.',
	preconditions: ['GuildOnly', 'InVoiceChannel']
})
export class SeekCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.addStringOption((option) =>
					option.setName('time').setDescription('What time would you like to seek to? (Ex: 00:10)').setRequired(true)
				)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply();

		const dispatcher = this.container.queue.get(interaction.guild!.id);

		if (!dispatcher)
			return interaction.editReply({
				embeds: [
					constructEmbed({
						description: "The bot currently isn't in a voice channel."
					})
				]
			});

		const position = interaction.options.getString('time')!;
		const timeRegex = /^(\d{1,2}):(\d{2})$/;

		if (!position.match(timeRegex))
			return interaction.editReply({
				embeds: [
					constructEmbed({
						description: "That isn't a properly formatted timestamp."
					})
				]
			});

		const seconds = timeToSeconds(position)!;
		const parsedTime = secondsToMilliseconds(seconds);
		const trackLength = dispatcher.current.length;

		if (parsedTime > trackLength || parsedTime < 0)
			return interaction.editReply({
				embeds: [
					constructEmbed({
						description: 'You provided a invalid timestamp, please double check your entry.'
					})
				]
			});

		dispatcher.player.seekTo(parsedTime);

		return interaction.editReply({
			embeds: [
				constructEmbed({
					description: `✅ The track has successfully been seeked to: \`${position}\``
				})
			]
		});
	}
}
