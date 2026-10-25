/** When someone last left to stream the song (from a Listen button), so the stage's song, if it was playing, waits to
 *  be asked back instead of starting over the song playing elsewhere. Kept apart from the sound engine. */
export const streaming = { leftAt: 0 };
