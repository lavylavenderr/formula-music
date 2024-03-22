import { Precondition } from '@sapphire/framework';
import { CommandInteraction, ContextMenuCommandInteraction, GuildMember, Message } from 'discord.js';

export class InVoiceChannelPrecondition extends Precondition {
	public override async messageRun(message: Message) {
		return this.checkIfInVC(message.member as GuildMember);
	}

	public override async chatInputRun(interaction: CommandInteraction) {
		return this.checkIfInVC(interaction.member as GuildMember);
	}

	public override async contextMenuRun(interaction: ContextMenuCommandInteraction) {
		return this.checkIfInVC(interaction.member as GuildMember);
	}

	private async checkIfInVC(member: GuildMember) {
		return member.voice.channel ? this.ok() : this.error({ message: 'You must be in a voice channel to run this command.' });
	}
}

declare module '@sapphire/framework' {
	interface Preconditions {
		InVoiceChannel: never;
	}
}
