import { Guild, TextChannel } from 'discord.js';
import { FormulaBot } from './client';
import { Player } from 'shoukaku';
import { container } from '@sapphire/framework';
import { constructEmbed } from './embedbuilder';

export class FormulaDispatcher {
	// Properties
	client: FormulaBot;
	guild: Guild;
	channel: TextChannel;
	player: Player;
	queue: any[];
	repeat: 'off' | 'one' | 'all';
	current: any | null;
	stopped: boolean;

	// Constructor
	public constructor({ client, guild, channel, player }: { client: FormulaBot; guild: Guild; channel: TextChannel; player: Player }) {
		this.client = client;
		this.guild = guild;
		this.channel = channel;
		this.player = player;
		this.queue = [];
		this.repeat = 'off';
		this.current = null;
		this.stopped = false;

		let _notifiedOnce = false;
		// @ts-expect-error
		let m;

		this.player
			.on('start', async () => {
				if (this.repeat === 'one') {
					if (_notifiedOnce) return;
					else _notifiedOnce = true;
				} else if (this.repeat === 'all' || this.repeat === 'off') {
					_notifiedOnce = false;
				}

				if (this.current.source === 'spotify') {
					m = await this.channel.send({
						embeds: [
							constructEmbed({
								description: `<:spotify:1219522954174529578>  Now playing: [**${this.current.metadata.title} by ${this.current.metadata.author}**](https://open.spotify.com/track/${this.current.metadata.identifier})`
							})
						]
					});
				} else if (this.current.info?.sourceName === 'youtube') {
					await this.channel.send({
						embeds: [
							constructEmbed({
								description: `<:youtube:1219602806135197706>  Now playing: [**${this.current.info.title} by ${this.current.info.author}**](${this.current.info.uri})`
							})
						]
					});
				}
			})
			.on('end', async () => {
				// @ts-expect-error
				await m?.delete().catch(() => null)
				if (this.repeat === 'one') this.queue.unshift(this.current);
				if (this.repeat === 'all') this.queue.push(this.current);
				this.play();
			})
			.on('stuck', () => {
				if (this.repeat === 'one') this.queue.unshift(this.current);
				if (this.repeat === 'all') this.queue.push(this.current);
				this.play();
			});
	}

	get exists() {
		const { queue } = container;
		return queue.has(this.guild.id);
	}

	play() {
		if (!this.exists || !this.queue.length) {
			this.current = null;
			this.queue = [];

			return this.channel
				.send({ embeds: [constructEmbed({ description: 'There are no more songs in the queue, feel free to add some more.' })] })
				.catch(() => null);
		}

		this.current = this.queue.shift();
		// @ts-expect-error
		return this.player.playTrackNew({ songData: this.current }, this);
	}

	destroy(reason: string) {
		const { shoukaku, queue } = container;
		shoukaku.leaveVoiceChannel(this.player.guildId);
		this.queue.length = 0;
		queue.delete(this.guild.id);
		this.client.logger.info(
			this.player.constructor.name,
			`Destroyed the player & connection @ guild "${this.guild.id}"\nReason: ${reason || 'No Reason Provided'}`
		);
		if (this.stopped) return;
	}
}
