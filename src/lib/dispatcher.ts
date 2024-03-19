import { Guild, TextChannel } from 'discord.js';
import { FormulaBot } from './client';
import { Player } from 'shoukaku';
import { container } from '@sapphire/framework';
import { Track } from "shoukaku"

export class FormulaDispatcher {
	// Properties
	client: FormulaBot;
	guild: Guild;
	channel: TextChannel;
	player: Player;
	queue: any[];
	repeat: 'off' | 'one' | 'all';
	current: Track | null;
	stopped: boolean;

	// Constructor
	public constructor({ client, guild, channel, player }: { client: FormulaBot; guild: Guild; channel: TextChannel; player: Player }) {
		this.client = client;
		this.guild = guild;
		this.channel = channel;
		this.player = player;
		this.queue = [];
		this.repeat = 'one';
		this.current = null;
		this.stopped = false;

		this.player
			.on('start', () => {
				console.log(this.current);
			})
			.on('end', () => {
				if (this.repeat === 'one') this.queue.unshift(this.current);
				if (this.repeat === 'all') this.queue.push(this.current);
				this.play();
			})
			.on('stuck', () => {
				if (this.repeat === 'one') this.queue.unshift(this.current);
				if (this.repeat === 'all') this.queue.push(this.current);
				this.play();
			})
	}

	get exists() {
		const { queue } = container;
		return queue.has(this.guild.id);
	}

	play() {
		if (!this.exists || !this.queue.length) {
			this.current = null;
			this.queue = [];

			return this.channel.send('we outta songs boii').catch(() => null);
		}
		this.current = this.queue.shift();
		return this.player.playTrack({ track: this.current?.encoded! });
	}

	destroy(reason: string) {
		const { shoukaku, queue } = container;
        shoukaku.leaveVoiceChannel(this.player.guildId)
		this.queue.length = 0;
		queue.delete(this.guild.id);
		this.client.logger.info(
			this.player.constructor.name,
			`Destroyed the player & connection @ guild "${this.guild.id}"\nReason: ${reason || 'No Reason Provided'}`
		);
		if (this.stopped) return;
	}
}
