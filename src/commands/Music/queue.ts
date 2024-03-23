import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { getRandomHexColor, humanizeMs, splitIntoGroups } from '../../lib/utils';
import { PaginatedMessage } from '@sapphire/discord.js-utilities';
import { EmbedBuilder } from 'discord.js';
import { constructEmbed } from '../../lib/embedbuilder';

@ApplyOptions<Command.Options>({
	description: 'View all the songs in the queue.',
	preconditions: ['GuildOnly', 'InVoiceChannel']
})
export class QueueCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(builder =>
			builder.setName('queue').setDescription(this.description)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply();

		const dispatcher = this.container.queue.get(interaction.guild!.id);

		if (!dispatcher)
			return this.sendBotNotInVoiceChannelReply(interaction);

		if (dispatcher.queue.length <= 1)
			return this.sendNoTracksInQueueReply(interaction);

		const sortedGroups = splitIntoGroups(dispatcher.queue, 10);
		const paginatedEmbed = this.buildPaginatedEmbed(interaction.user.username, sortedGroups);

		return paginatedEmbed.run(interaction);
	}

	private sendBotNotInVoiceChannelReply(interaction: Command.ChatInputCommandInteraction) {
		return interaction.editReply({
			embeds: [
				constructEmbed({
					description: "The bot currently isn't in a voice channel."
				})
			]
		});
	}

	private sendNoTracksInQueueReply(interaction: Command.ChatInputCommandInteraction) {
		return interaction.editReply({
			embeds: [
				constructEmbed({
					description: "There aren't any tracks in the queue."
				})
			]
		});
	}

	private buildPaginatedEmbed(username: string, sortedGroups: any[]) {
		const paginatedEmbed = new PaginatedMessage({
			template: new EmbedBuilder()
				.setColor(getRandomHexColor())
				.setTimestamp()
				.setFooter({ text: `Requested by: ${username}` })
		});

		sortedGroups.forEach(trackGroup => {
			let description = `**Below are the upcoming tracks.**\n\n`;

			// @ts-expect-error
			trackGroup.forEach(({ index, content }) => {
				description += `${index + 1} - \`[${humanizeMs(content.length)}]\` [**${content.title} by ${content.author}**](${content.uri})\n`;
			});

			paginatedEmbed.addPageEmbed(embed => embed.setDescription(description));
		});

		return paginatedEmbed;
	}
}
