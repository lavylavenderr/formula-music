import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { constructEmbed } from '../../lib/embedbuilder';

@ApplyOptions<Command.Options>({
	description: 'Make the bot leave your current voice channel.',
	preconditions: ['InVoiceChannel', 'GuildOnly']
})
export class LeaveCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder.setName('leave').setDescription(this.description);
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

		dispatcher.destroy();
		return interaction.reply({
			embeds: [
				constructEmbed({
					description: "Thanks for using the bot! I'm now disconnected."
				})
			]
		});
	}
}
