import { Guild, Message, TextChannel, VoiceBasedChannel } from 'discord.js';
import { FormulaBot } from './client';
import { Player } from 'shoukaku';
import { container } from '@sapphire/framework';
import { constructEmbed } from './embedbuilder';

interface ModifiedPlayer extends Player {
	playTrackNew: (playable: any, dispatcher: any) => Promise<void>;
}

export class FormulaDispatcher {
	// Properties
	client: FormulaBot;
	guild: Guild;
	channel: TextChannel;
	player: ModifiedPlayer;
	queue: any[];
	repeat: 'off' | 'one' | 'all';
	current: any | null;
	stopped: boolean;
	voiceChannel: VoiceBasedChannel;

	// Constructor
	public constructor({
		client,
		guild,
		channel,
		player,
		voiceChannel
	}: {
		client: FormulaBot;
		guild: Guild;
		channel: TextChannel;
		player: ModifiedPlayer;
		voiceChannel: VoiceBasedChannel;
	}) {
		this.client = client;
		this.guild = guild;
		this.channel = channel;
		this.player = player;
		this.queue = [];
		this.repeat = 'off';
		this.current = null;
		this.stopped = false;
		this.voiceChannel = voiceChannel;

		let m: Message;
		let description: string;
		let _notifiedOnce = false;

		this.player
			.on('start', async () => {
				if (!this.current) return;

				if (this.repeat === 'one') {
					if (_notifiedOnce) return;
					else _notifiedOnce = true;
				} else if (this.repeat === 'all' || this.repeat === 'off') {
					_notifiedOnce = false;
				}

				if (this.current.sourceName === 'soundcloud') {
					description = `<:soundcloud:1220152120624545864> Now playing: [**${this.current.title} by ${this.current.author}**](https://open.spotify.com/track/${this.current.identifier})`;
				} else if (this.current.sourceName === 'youtube') {
					description = `<:youtube:1219602806135197706> Now playing: [**${this.current.title || 'Unknown'} by ${this.current.author || 'Unknown'}**](${this.current.uri})`;
				} else {
					description = `<:deezer:1223917076293357619> Now playing: [**${this.current.title || 'Unknown'} by ${this.current.author || 'Unknown'}**](${this.current.uri})`;
				}

				m = await this.channel.send({
					embeds: [constructEmbed({ description })]
				});
			})
			.on('end', async () => {
				await m?.delete().catch(() => null);

				if (this.repeat === 'one') this.queue.unshift(this.current);
				if (this.repeat === 'all') this.queue.push(this.current);

				this.play();
			})
			.on('closed', () => {})
			.on('stuck', () => {
				if (this.repeat === 'one') this.queue.unshift(this.current);
				if (this.repeat === 'all') this.queue.push(this.current);
				this.play();
			});

		// If track is playing return, if bot isn't in VC return, and if there are users in the VC, return.
		setInterval(async () => {
			if (this.current) return;
			if (!this.guild.members.cache.get(this.client.user!.id)?.voice.channel) return;
			if (this.voiceChannel.members.size > 1) return;

			if (m) await m.delete().catch(() => null);
			this.channel.send({
				embeds: [
					constructEmbed({
						description: "There are no users in the voice channel, I'll now disconnect."
					})
				]
			});
			return this.destroy('Empty VC');
		}, 10000);
	}

	get exists() {
		const { queue } = container;
		return queue.has(this.guild.id);
	}

	pause() {
		if (!this.exists || !this.current) return;

		this.player.setPaused(true);
		this.stopped = true;
	}

	unpause() {
		if (!this.exists || !this.current) return;

		this.player.setPaused(false);
		this.stopped = false;
	}

	skip() {
		this.player.stopTrack();
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

		if (!this.current) {
			this.destroy();
			return this.channel
				.send({ embeds: [constructEmbed({ description: 'An error has occured attemping to play a track.' })] })
				.catch(() => null);
		}

		return this.player.playTrackNew({ metadata: this.current }, this);
	}

	destroy(reason?: string) {
		const { shoukaku, queue } = container;

		this.client.logger.info(
			this.player.constructor.name,
			`Destroyed the player & connection @ guild "${this.guild.id}"\nReason: ${reason || 'No Reason Provided'}`
		);

		this.queue = [];
		// this.player.stopTrack();
		shoukaku.leaveVoiceChannel(this.player.guildId);
		return queue.delete(this.guild.id);
	}
}
