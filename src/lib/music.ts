import { FormulaDispatcher } from './dispatcher';

export async function prefetchSong(dispatcher: FormulaDispatcher) {
	const nextSong = dispatcher.queue[0];

	if (nextSong.isrc) await fetch(`http://5.78.115.239:8001/track/${nextSong.isrc}`).catch((error) => console.log(error));

	return;
}
