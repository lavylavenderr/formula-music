import { EmbedFooterOptions, EmbedBuilder, EmbedField, EmbedAuthorOptions } from 'discord.js';
import { getRandomHexColor } from './utils';

interface ConstructEmbedOptions {
	title?: string;
	description?: string;
	author?: EmbedAuthorOptions;
	fields?: EmbedField[];
	image?: string;
	thumbnail?: string;
	URL?: string;
	footer?: EmbedFooterOptions;
}

export function constructEmbed(options: ConstructEmbedOptions = {}): EmbedBuilder {
	const { title, description, author, fields, image, thumbnail, URL, footer } = options;

	let embed = new EmbedBuilder()
		.setAuthor(author || null)
		.setTitle(title || null)
		.setDescription(description || null)
		.setFields(fields || [])
		.setImage(image || null)
		.setThumbnail(thumbnail || null)
		.setURL(URL || null)
		.setFooter(footer || null)
		.setColor(getRandomHexColor());

	return embed;
}
