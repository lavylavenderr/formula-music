import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { constructEmbed } from '../../lib/embedbuilder';

@ApplyOptions<Command.Options>({
	description: 'Skip the current song.',
	preconditions: ['GuildOnly', 'InVoiceChannel']
})
export class SkipCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder.setName('skip').setDescription(this.description));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply();

		const dispatcher = this.container.queue.get(interaction.guild!.id);

		if (!dispatcher) return this.sendBotNotInVoiceChannelReply(interaction);

		if (dispatcher.queue.length === 0) return this.sendNotEnoughTracksToSkipReply(interaction);

		dispatcher.skip();
		return this.sendSkipSuccessReply(interaction);
	}

	private sendBotNotInVoiceChannelReply(interaction: Command.ChatInputCommandInteraction) {
		return interaction.reply({
			embeds: [
				constructEmbed({
					description: "The bot currently isn't in a voice channel."
				})
			]
		});
	}

	private sendNotEnoughTracksToSkipReply(interaction: Command.ChatInputCommandInteraction) {
		return interaction.reply({
			embeds: [
				constructEmbed({
					description: "There aren't enough tracks in the queue to skip to."
				})
			]
		});
	}

	private sendSkipSuccessReply(interaction: Command.ChatInputCommandInteraction) {
		return interaction.editReply({
			embeds: [
				constructEmbed({
					description: "I've successfully skipped the requested track."
				})
			]
		});
	}
}
