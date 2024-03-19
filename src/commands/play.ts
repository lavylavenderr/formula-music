import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { GuildMember, TextChannel } from 'discord.js';
import { Track } from 'shoukaku';

@ApplyOptions<Command.Options>({
	description: 'Play music!'
})
export class PlayCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand({
			name: "play",
			description: this.description
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const shoukaku = this.container.shoukaku;
		const node = shoukaku.options.nodeResolver(shoukaku.nodes);

		const result = await node?.rest.resolve('scsearch:die right here david hugo');
		// @ts-expect-error
		const metadata = result.data[0]
		const dispatcher = await this.container.queue.handle(
			interaction.guild!,
			interaction.member as GuildMember,
			interaction.channel as TextChannel,
			metadata as Track
		);

        if (dispatcher === 1)
            return interaction.reply("dispatcher is busy bruh")

			dispatcher?.play()
        if (!dispatcher?.current) dispatcher?.play();
        return interaction.reply({ content: dispatcher?.current?.encoded ?? "nothing" })
	}
}
