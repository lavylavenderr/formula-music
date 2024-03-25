import { Events, Listener } from '@sapphire/framework';
import { Message } from 'discord.js';

export class messageCreateEvent extends Listener<typeof Events.MessageCreate> {
	public override async run(event: Message) {
		// very simple, will change later :D
		if (!event.content.includes('f!')) return;

		await this.container.prisma.user.upsert({
			create: {
				discordId: event.author.id
			},
			update: {},
			where: { discordId: event.author.id }
		});
	}
}
