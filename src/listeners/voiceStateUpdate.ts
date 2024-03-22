import { Events, Listener } from '@sapphire/framework';
import { VoiceBasedChannel, VoiceState } from 'discord.js';
import { constructEmbed } from '../lib/embedbuilder';
import { FormulaDispatcher } from '../lib/dispatcher';

export class voiceStateUpdateEvent extends Listener<typeof Events.VoiceStateUpdate> {
	public override async run(event: VoiceState) {
		const dispatcher = this.container.queue.get(event.guild.id) as FormulaDispatcher;
		if (!dispatcher) return;

		const channel = (await this.container.client.channels.fetch(dispatcher.voiceChannel.id)) as VoiceBasedChannel;

		if (!channel.members.get(this.container.client.id!)) {
			dispatcher.destroy('Bot was disconnected');
			return dispatcher.channel.send({
				embeds: [
					constructEmbed({
						description: "I've been disconnected from the voice channel :("
					})
				]
			});
		} else {
			return;
		}
	}
}
