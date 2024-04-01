import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { constructEmbed } from '../../lib/embedbuilder';

@ApplyOptions<Command.Options>({
	description: 'Clear the queue.',
	preconditions: ['InVoiceChannel', 'GuildOnly']
})
export class ClearCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder.setName('clear').setDescription(this.description);
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const dispatcher = this.container.queue.get(interaction.guild!.id);

		if (!dispatcher)
			return interaction.reply({
				embeds: [
					constructEmbed({
						description: "The bot currently isn't in a voice channel."
					})
				]
			});

		if (dispatcher.queue.length === 0)
			return interaction.reply({
				embeds: [
					constructEmbed({
						description: 'The queue is currently empty.'
					})
				]
			});

		const queueLength = dispatcher.queue.length;
		dispatcher.queue = [];

		return interaction.reply({
			embeds: [
				constructEmbed({
					description: `I have successfully cleared \`${queueLength}\` tracks from the queue!`
				})
			]
		});
	}
}
