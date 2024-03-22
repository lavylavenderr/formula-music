import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { constructEmbed } from '../../lib/embedbuilder';
import { prefetchSong } from '../../lib/music';

@ApplyOptions<Command.Options>({
	description: 'Shuffle all the songs in the queue.',
	preconditions: ['GuildOnly', 'InVoiceChannel']
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder.setName(this.name).setDescription(this.description));
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

		if (dispatcher.queue.length <= 2)
			return interaction.reply({
				embeds: [
					constructEmbed({
						description: "There aren't enough tracks in the queue to shuffle them."
					})
				]
			});

		dispatcher.queue = dispatcher.queue.sort(() => Math.random() - 0.5);
		await prefetchSong(dispatcher);

		return interaction.editReply({
			embeds: [
				constructEmbed({
					description: "I've successfully shuffled the queue!"
				})
			]
		});
	}
}
