import {
	container,
	type ChatInputCommandSuccessPayload,
	type Command,
	type ContextMenuCommandSuccessPayload,
	type MessageCommandSuccessPayload
} from '@sapphire/framework';
import { cyan } from 'colorette';
import type { APIUser, ColorResolvable, Guild, User } from 'discord.js';

export function getRandomHexColor(): ColorResolvable {
    const red = Math.floor(Math.random() * 256);
    const green = Math.floor(Math.random() * 256);
    const blue = Math.floor(Math.random() * 256);

    const hexRed = red.toString(16).padStart(2, '0');
    const hexGreen = green.toString(16).padStart(2, '0');
    const hexBlue = blue.toString(16).padStart(2, '0');

    const hexColor = "#" + hexRed + hexGreen + hexBlue as ColorResolvable;

    return hexColor;
}

export function logSuccessCommand(payload: ContextMenuCommandSuccessPayload | ChatInputCommandSuccessPayload | MessageCommandSuccessPayload): void {
	let successLoggerData: ReturnType<typeof getSuccessLoggerData>;

	if ('interaction' in payload) {
		successLoggerData = getSuccessLoggerData(payload.interaction.guild, payload.interaction.user, payload.command);
	} else {
		successLoggerData = getSuccessLoggerData(payload.message.guild, payload.message.author, payload.command);
	}

	container.logger.debug(`${successLoggerData.shard} - ${successLoggerData.commandName} ${successLoggerData.author} ${successLoggerData.sentAt}`);
}

export function getSuccessLoggerData(guild: Guild | null, user: User, command: Command) {
	const shard = getShardInfo(guild?.shardId ?? 0);
	const commandName = getCommandInfo(command);
	const author = getAuthorInfo(user);
	const sentAt = getGuildInfo(guild);

	return { shard, commandName, author, sentAt };
}

function getShardInfo(id: number) {
	return `[${cyan(id.toString())}]`;
}

function getCommandInfo(command: Command) {
	return cyan(command.name);
}

function getAuthorInfo(author: User | APIUser) {
	return `${author.username}[${cyan(author.id)}]`;
}

function getGuildInfo(guild: Guild | null) {
	if (guild === null) return 'Direct Messages';
	return `${guild.name}[${cyan(guild.id)}]`;
}

export function humanizeMs(ms: number): string {
    // Convert milliseconds to seconds
    const totalSeconds = Math.floor(ms / 1000);

    // Calculate hours, minutes, and seconds
    const hours = Math.floor(totalSeconds / 3600);
    const remainingSeconds = totalSeconds % 3600;
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    // Format hours, minutes, and seconds
    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');
    const secondsStr = String(seconds).padStart(2, '0');

    // Construct the result string
    let result = `${minutesStr}:${secondsStr}`;
    if (hours > 0) {
        result = `${hoursStr}:${result}`;
    }

    return result;
}

export function capitalizeFirstLetter(input: string): string {
    if (input.length === 0) {
        return input;
    }
    return input.charAt(0).toUpperCase() + input.slice(1);
}

export function splitIntoGroups<T>(arr: T[], groupSize: number): { index: number, content: any }[][] {
    const groups: { index: number, content: T }[][] = [];
    for (let i = 0; i < arr.length; i += groupSize) {
        groups.push(arr.slice(i, i + groupSize).map((content, index) => ({ index: i + index, content })));
    }
    return groups;
}

export function timeToSeconds(timeString: string): number | null {
    const timeRegex = /^(\d{1,2}):(\d{2})$/;
    const match = timeString.match(timeRegex);
    
    if (!match) {
        console.error("Invalid time format. Please use 'mm:ss' or 'm:ss'");
        return null;
    }
    
    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    
    if (minutes < 0 || seconds < 0 || seconds > 59) {
        console.error("Invalid time values. Minutes and seconds should be between 0-59.");
        return null;
    }
    
    const totalSeconds = minutes * 60 + seconds;
    return totalSeconds;
}

export function millisecondsToMinutesSeconds(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    const minutesStr = String(minutes).padStart(2, '0');
    const secondsStr = String(seconds).padStart(2, '0');
    
    return `${minutesStr}:${secondsStr}`;
}

export function generateLoadingBar(startMs: number, endMs: number, currentMs: number, barLength: number): string {
    currentMs = Math.max(startMs, Math.min(endMs, currentMs));
    
    const progress = (currentMs - startMs) / (endMs - startMs);
    
    const completedSegments = Math.floor(progress * barLength);
    const remainingSegments = barLength - completedSegments;
    const completedBar = '▬'.repeat(completedSegments);
    const remainingBar = '▬'.repeat(remainingSegments);
    const progressBar = `${completedBar}🔘${remainingBar}`;
    
    return progressBar;
}
