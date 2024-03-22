import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { constructEmbed } from '../../lib/embedbuilder';

@ApplyOptions<Command.Options>({
	description: 'Skip the current song.',
	preconditions: ['GuildOnly', 'InVoiceChannel']
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply();

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
						description: "There aren't enough tracks in the queue to skip to."
					})
				]
			});

		dispatcher.skip();
		return interaction.editReply({
			embeds: [
				constructEmbed({
					description: "I've successfully skipped the requested track."
				})
			]
		});
	}
}
