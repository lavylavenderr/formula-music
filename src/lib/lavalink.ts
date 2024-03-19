import { Connectors, Shoukaku } from "shoukaku";
import { FormulaBot } from "./client";
import servers from "../lavalink.json"

export class ShoukakuHandler extends Shoukaku {
    constructor(client: FormulaBot) {
        super(new Connectors.DiscordJS(client), servers)
        this.on('ready',
            (name, reconnected) =>
                client.logger.info('Shoukaku', `Lavalink Node: ${name} is now connected, This connection is ${reconnected ? 'resumed' : 'a new connection'}`)
        );
        this.on('debug',
            (name, info) => {
                if (info.toLowerCase().includes('server load')) return;
                client.logger.info('Shoukaku', `Lavalink Node: ${name} ${info}`);
            }
        );
    }
}