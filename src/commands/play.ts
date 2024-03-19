import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { GuildMember, TextChannel } from 'discord.js';
@ApplyOptions<Command.Options>({
	description: 'Play music!'
})
export class PlayCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand({
			name: 'play',
			description: this.description
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const shoukaku = this.container.shoukaku;
		const node = shoukaku.options.nodeResolver(shoukaku.nodes);

		const result = await node?.rest.resolve('https://soundcloud.com/impactist/glazer-cartoon-network?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing');
		console.log(result);
		// @ts-expect-error
		const metadata = result!.track ?? result?.data;
		const dispatcher = await this.container.queue.handle(
			interaction.guild!,
			interaction.member as GuildMember,
			interaction.channel as TextChannel,
			metadata
		);

		if (dispatcher === 1) return interaction.reply('dispatcher is busy bruh');
		if (!dispatcher?.current) dispatcher?.play();
		return interaction.reply({ content: dispatcher?.current?.encoded ?? 'something', ephemeral: true });
	}
}
