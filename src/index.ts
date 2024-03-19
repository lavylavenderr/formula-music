import './lib/setup';
import { config } from 'dotenv';
import { FormulaBot } from './lib/client';

config();

const client = new FormulaBot();

(async () => {
	try {
		await client.login(process.env.DISCORD_TOKEN);
	} catch (error) {
		client.logger.fatal(error);
		client.destroy();
		process.exit(1);
	}
})();
