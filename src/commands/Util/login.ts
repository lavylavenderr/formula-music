import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

@ApplyOptions<Command.Options>({
	description: 'Login and link your Spotify Account to the bot.',
	preconditions: ['GuildOnly']
})
export class LoginCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder.setName(this.name).setDescription(this.description));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply({ ephemeral: true });

		const scopes = [
			'playlist-read-private',
			'playlist-read-collaborative',
			'user-top-read',
			'user-library-read',
		];
		const existingCreds = await this.container.prisma.spotifyCreds.findUnique({
			where: {
				discordId: interaction.user.id
			}
		});

		if (existingCreds) return interaction.editReply({ content: "You're already authenticated!" });

		const queryParams = new URLSearchParams();
		queryParams.append('client_id', process.env.SPOTIFY_CLIENT_ID!), queryParams.append('response_type', 'code');
		queryParams.append('redirect_uri', process.env.REDIRECT_URL!);
		queryParams.append('response_type', 'code');
		queryParams.append('scope', scopes.join(', '));
		queryParams.append('state', interaction.user.id);

		return interaction.editReply({
			content: `You can login by clicking [here!](https://accounts.spotify.com/authorize?${queryParams})`
		});
	}
}
