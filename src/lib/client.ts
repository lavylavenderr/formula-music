import { PrismaClient } from '@prisma/client';
import { LogLevel, SapphireClient, container } from '@sapphire/framework';
import { getRootData } from '@sapphire/pieces';
import { GatewayIntentBits, Partials } from 'discord.js';
import { join } from 'path';
import { ShoukakuHandler } from './lavalink';
import { Queue } from './queue';
import '@sapphire/plugin-api/register';
import '@sapphire/plugin-scheduled-tasks/register';

export class FormulaBot extends SapphireClient {
	private rootData = getRootData();

	public constructor() {
		super({
			defaultPrefix: 'f!',
			caseInsensitiveCommands: true,
			logger: {
				level: LogLevel.Debug
			},
			shards: 'auto',
			api: {
				automaticallyConnect: true,
				prefix: '/',
				origin: '*',
				listenOptions: {
					// funny story, this is my mcdonalds store number!
					port: Number(process.env.PORT! || 39837)
				}
			},
			intents: [
				GatewayIntentBits.DirectMessageReactions,
				GatewayIntentBits.DirectMessages,
				GatewayIntentBits.GuildModeration,
				GatewayIntentBits.GuildEmojisAndStickers,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.GuildMessageReactions,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildVoiceStates,
				GatewayIntentBits.MessageContent
			],
			tasks: {
				bull: {
					connection: {
						port: parseInt(process.env.REDIS_PORT!),
						password: process.env.REDIS_PASSWORD,
						host: process.env.REDIS_HOST
					}
				}
			},
			partials: [Partials.Channel],
			loadMessageCommandListeners: true
		});

		this.stores.get('interaction-handlers').registerPath(join(this.rootData.root, 'interactions'));
		this.stores.get('listeners').registerPath(join(this.rootData.root, 'listeners'));
	}

	public override async login(token?: string) {
		container.prisma = new PrismaClient();
		container.shoukaku = new ShoukakuHandler(this);
		container.queue = new Queue(this);

		return super.login(token);
	}

	public override async destroy() {
		await container.prisma.$disconnect();
		return super.destroy();
	}
}

declare module '@sapphire/pieces' {
	interface Container {
		prisma: PrismaClient;
		shoukaku: ShoukakuHandler;
		queue: Queue;
	}
}
