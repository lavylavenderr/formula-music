import { Events, Listener } from "@sapphire/framework";
import { Interaction } from "discord.js";

export class interactionCreateEvent extends Listener<typeof Events.InteractionCreate> {
    public override async run(event: Interaction) {
        // very simple, will change later :D
        await this.container.prisma.user.upsert({
            create: {
                discordId: event.user.id
            },
            update: {},
            where: { discordId: event.user.id }
        })
    }
}