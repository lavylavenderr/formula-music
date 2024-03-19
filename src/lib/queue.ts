import { Guild, GuildMember, TextChannel } from 'discord.js';
import { FormulaBot } from './client';
import { Track } from 'shoukaku';
import { container } from '@sapphire/framework';
import { FormulaDispatcher } from './dispatcher';

export class Queue extends Map {
	client: FormulaBot;

	constructor(client: FormulaBot) {
		super();
		this.client = client;
	}

	async handle(guild: Guild, member: GuildMember, channel: TextChannel, track: Track) {
		const { shoukaku } = container;
		const doesExist = this.get(guild.id);
		if (!doesExist) {
			if (shoukaku.players.has(guild.id)) return 1;

			const player = await shoukaku.joinVoiceChannel({
				guildId: guild.id,
				shardId: guild.shardId,
				channelId: member.voice.channelId!
			});

            // Catch this, even though in practice it actually works, dunno why however, it's annoying LOL
			await player.setGlobalVolume(50).catch()
			this.client.logger.info(player.constructor.name, `New connection @ guild "${guild.id}"`);

			const dispatcher = new FormulaDispatcher({
				client: this.client,
				guild,
				channel,
				player
			});

			dispatcher.queue.push(track);
			this.set(guild.id, dispatcher);
			this.client.logger.info(dispatcher.constructor.name, `New player dispatcher @ guild "${guild.id}"`);
			return dispatcher;
		}
		doesExist.queue.push(track);
		if (!doesExist.current) doesExist.play();
		return null;
	}
}
