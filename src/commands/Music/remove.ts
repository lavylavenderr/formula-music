import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { constructEmbed } from '../../lib/embedbuilder';

@ApplyOptions<Command.Options>({
	description: 'Remove a track from the queue.',
	preconditions: ['GuildOnly', 'InVoiceChannel']
})
export class RemoveCommand extends Command {
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
			return interaction.reply({
				embeds: [
					constructEmbed({
						description: "The bot currently isn't in a voice channel."
					})
				]
			});

		if (dispatcher.queue.length <= 1)
			return interaction.reply({
				embeds: [
					constructEmbed({
						description: 'Unable to remove tracks from an empty queue.'
					})
				]
			});

		const selectedTrack = dispatcher.queue[position - 1];

		if (!selectedTrack)
			return interaction.reply({
				embeds: [
					constructEmbed({
						description: "This track doesn't exist."
					})
				]
			});

		dispatcher.queue = [...dispatcher.queue.slice(0, position - 1), ...dispatcher.queue.slice(position - 1 + 1)];

		return interaction.editReply({
			embeds: [
				constructEmbed({
					description: `I've removed: [**${selectedTrack.title} by ${selectedTrack.author}**](${selectedTrack.uri}) from the queue.`
				})
			]
		});
	}
}
