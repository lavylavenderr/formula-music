import { ApplyOptions } from '@sapphire/decorators';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { constructEmbed } from '../../lib/embedbuilder';

@ApplyOptions<Subcommand.Options>({
	description: 'Set the repeat mode for the bot!',
	preconditions: ['GuildOnly', 'InVoiceChannel'],
	subcommands: [
		{
			name: 'all',
			chatInputRun: 'chatInputAll',
			default: true
		},
		{
			name: 'one',
			chatInputRun: 'chatInputOne'
		},
		{
			name: 'off',
			chatInputRun: 'chatInputOff'
		}
	]
})
export class RepeatCommand extends Subcommand {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('repeat')
				.setDescription(this.description)
				.addSubcommand((command) => command.setName('all').setDescription('Repeat the whole queue.'))
				.addSubcommand((command) => command.setName('one').setDescription('Repeat the current track.'))
				.addSubcommand((command) => command.setName('off').setDescription('Turn off repeats.'))
		);
	}

	public async chatInputAll(interaction: Subcommand.ChatInputCommandInteraction) {
		await interaction.deferReply();

		const dispatcher = this.container.queue.get(interaction.guild!.id);

		if (!dispatcher)
			return interaction.editReply({
				embeds: [
					constructEmbed({
						description: "The bot currently isn't in a voice channel."
					})
				]
			});
		if (dispatcher.repeat == 'all')
			return interaction.editReply({
				embeds: [
					constructEmbed({
						description: 'The queue is already set to repeat all.'
					})
				]
			});

		dispatcher.repeatMode('all');

		return interaction.editReply({
			embeds: [
				constructEmbed({
					description: 'Successfully set the queue to repeat all tracks.'
				})
			]
		});
	}

	public async chatInputOff(interaction: Subcommand.ChatInputCommandInteraction) {
		await interaction.deferReply();

		const dispatcher = this.container.queue.get(interaction.guild!.id);

		if (!dispatcher)
			return interaction.editReply({
				embeds: [
					constructEmbed({
						description: "The bot currently isn't in a voice channel."
					})
				]
			});
		if (dispatcher.repeat == 'off')
			return interaction.editReply({
				embeds: [
					constructEmbed({
						description: 'The queue does not currently have any repeat modes enabled.'
					})
				]
			});

		dispatcher.repeatMode('off');

		return interaction.editReply({
			embeds: [
				constructEmbed({
					description: 'Successfully disabled the looping of any tracks.'
				})
			]
		});
	}

	public async chatInputOne(interaction: Subcommand.ChatInputCommandInteraction) {
		await interaction.deferReply();

		const dispatcher = this.container.queue.get(interaction.guild!.id);

		if (!dispatcher)
			return interaction.editReply({
				embeds: [
					constructEmbed({
						description: "The bot currently isn't in a voice channel."
					})
				]
			});
		if (dispatcher.repeat == 'one')
			return interaction.editReply({
				embeds: [
					constructEmbed({
						description: 'The queue is already set to loop this track.'
					})
				]
			});

		dispatcher.repeatMode('one');

		return interaction.editReply({
			embeds: [
				constructEmbed({
					description: 'Successfully set the queue to loop the current track.'
				})
			]
		});
	}
}
