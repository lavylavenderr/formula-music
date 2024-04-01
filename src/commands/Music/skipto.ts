import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { constructEmbed } from '../../lib/embedbuilder';

@ApplyOptions<Command.Options>({
	description: 'Skip to a specific track in the queue, this will remove all tracks before this track.',
	preconditions: ['GuildOnly', 'InVoiceChannel']
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.addNumberOption((option) => option.setName('position').setDescription('What position is the track at?').setRequired(true))
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply();

		const dispatcher = this.container.queue.get(interaction.guild!.id);
		const position = interaction.options.getNumber('position')!;

		if (!dispatcher)
			return interaction.editReply({
				embeds: [
					constructEmbed({
						description: "The bot currently isn't in a voice channel."
					})
				]
			});

		if (dispatcher.queue.length <= 1)
			return interaction.editReply({
				embeds: [
					constructEmbed({
						description: "There aren't enough tracks in the queue to skip ahead."
					})
				]
			});

		const selectedTrack = dispatcher.queue[position - 1];

		if (!selectedTrack)
			return interaction.editReply({
				embeds: [
					constructEmbed({
						description: "This track doesn't exist."
					})
				]
			});

		dispatcher.queue = dispatcher.queue.slice(position - 1);

		interaction.editReply({
			embeds: [
				constructEmbed({
					description: `✅ I've successfully skipped to: [**${dispatcher.queue[0].title} by ${dispatcher.queue[0].author}**](${dispatcher.queue[0].uri})`
				})
			]
		});

		return await dispatcher.player.stopTrack();
	}
}
