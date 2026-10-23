/**
 * store.js - shared reactive state + action logic.
 *
 * This replaces the old DOM-driven `ui.js`. The framework now owns rendering,
 * so everything here is either reactive state or a pure action that mutates it.
 * The framework-agnostic modules (audio-player.js, editor.js, lrc-parser.js,
 * transcriber.js) are reused as-is.
 */

import { reactive } from 'vue'
import { AudioPlayer } from './audio-player.js'
import { LyricEditor } from './editor.js'
import {
  formatTimestamp,
  isSyncedLyrics,
  parseLRC,
  parsePlainLyrics,
} from './lrc-parser.js'
import * as musicMetadata from 'music-metadata'

export const player = new AudioPlayer()

// Class instance wrapped in a reactive proxy: every mutation of editor.lines /
// editor.selectedIndex is picked up by Vue, so no render callbacks are needed.
export const editor = reactive(new LyricEditor())

export const playerState = reactive({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  ready: false,
  trackName: '',
  autoPlay: true,
})

export const store = reactive({
  step: 1,

  // Song
  audioFile: null,

  // Lyrics input (step 2)
  lyricsText: '',
  metadata: { artist: '', title: '', album: '' },

  // AI transcription
  transcribe: { active: false, status: '', progress: 0 },

  // lrclib
  showLrclib: false,
  lrclibQuery: '',
  lrclibResults: [],
  lrclibBusy: false,

  // Export
  publishStatus: '',

  // Step 3 sync flags
  seeking: false,
  markingMode: false,
})

export const MODELS = [
  { id: 'Xenova/whisper-tiny.en', name: 'Tiny', size: '~39 MB', note: 'Fastest, good for clear audio' },
  { id: 'Xenova/whisper-base.en', name: 'Base', size: '~74 MB', note: 'Better accuracy' },
  { id: 'Xenova/whisper-small.en', name: 'Small', size: '~244 MB', note: 'Good balance of speed & accuracy' },
  { id: 'Xenova/whisper-medium.en', name: 'Medium', size: '~769 MB', note: 'High accuracy, slower' },
]

export const formatTime = AudioPlayer.formatTime
export { formatTimestamp } from './lrc-parser.js'

/* ---------------------------------------------------------------- navigation */

export function canGoToStep(step) {
  if (step === 1) return true
  if (step === 2) return player.fileName !== ''

  // Steps 3 and 4 both need audio plus lyrics. Step 4 additionally needs at
  // least one synced line, otherwise the exported LRC would be empty.
  if (playerState.duration <= 0 || !editor.hasLyrics) return false
  if (step === 4) return editor.lines.some((line) => line.time !== null)
  return true
}

export function goToStep(step) {
  if (!canGoToStep(step)) return
  store.step = step

  if (step === 4) {
    // No player on the export page, so stop audio rather than leave it running.
    player.pause()
  }
}

export function startOver() {
  player.pause()
  editor.clear()
  store.audioFile = null
  store.lyricsText = ''
  store.metadata = { artist: '', title: '', album: '' }
  store.transcribe = { active: false, status: '', progress: 0 }
  store.showLrclib = false
  store.lrclibResults = []
  store.publishStatus = ''
  playerState.trackName = ''
  playerState.duration = 0
  store.step = 1
}

/* ------------------------------------------------------------ song loading */

export async function handleAudioFile(file) {
  store.audioFile = file
  player.loadFile(file)
  playerState.trackName = file.name.replace(/\.[^/.]+$/, '')
  await applyAudioMetadata(file)
  goToStep(2)
}

export async function loadDemo() {
  const demoSongUrl = 'https://c.madeye.dev/syncsongdemo.mp3'
  const demoArtist = 'Joshua Hendricks'
  const demoTitle = 'Sing It Wrong'

  player.loadUrl(demoSongUrl, `${demoArtist} - ${demoTitle}`)
  playerState.trackName = `${demoArtist} - ${demoTitle}`
  store.metadata = { artist: demoArtist, title: demoTitle, album: '' }
  store.lyricsText = DEMO_LYRICS

  // Keep the audio bytes around so transcription still works for the demo.
  try {
    const response = await fetch(demoSongUrl)
    const blob = await response.blob()
    store.audioFile = new File([blob], 'demo-song.mp3', { type: 'audio/mpeg' })
  } catch (err) {
    console.warn('Could not fetch demo audio for transcription:', err)
    store.audioFile = null
  }

  goToStep(2)
}

async function applyAudioMetadata(file) {
  try {
    const metadata = await musicMetadata.parseBlob(file)
    const { artist, album, title } = metadata.common

    store.metadata = {
      artist: artist || store.metadata.artist,
      title: title || store.metadata.title,
      album: album || store.metadata.album,
    }
    playerState.trackName = title ? (artist ? `${artist} - ${title}` : title) : file.name.replace(/\.[^/.]+$/, '')
  } catch (err) {
    console.warn('Could not read audio metadata:', err)
  }
}

/* ----------------------------------------------------------- lyrics parsing */

export function parseLyricsInput() {
  const content = store.lyricsText.trim()
  if (!content) return

  const data = isSyncedLyrics(content)
    ? parseLRC(content)
    : { metadata: {}, lines: parsePlainLyrics(content) }

  const metadata = { ...data.metadata }
  if (store.metadata.artist) metadata.artist = store.metadata.artist
  if (store.metadata.title) metadata.title = store.metadata.title
  if (store.metadata.album) metadata.album = store.metadata.album

  store.metadata = {
    artist: metadata.artist || '',
    title: metadata.title || '',
    album: metadata.album || '',
  }

  editor.loadLyrics({ metadata, lines: data.lines })
}

export function applyLyricsFile(file) {
  const reader = new FileReader()
  reader.onload = (event) => {
    const content = event.target.result
    store.lyricsText = content

    if (isSyncedLyrics(content)) {
      const parsed = parseLRC(content)
      if (parsed.metadata.artist && !store.metadata.artist) store.metadata.artist = parsed.metadata.artist
      if (parsed.metadata.title && !store.metadata.title) store.metadata.title = parsed.metadata.title
      if (parsed.metadata.album && !store.metadata.album) store.metadata.album = parsed.metadata.album
    }
  }
  reader.onerror = () => console.error('Failed to read lyrics file')
  reader.readAsText(file)
}

/* ------------------------------------------------------------ lrclib */

export async function openLrclibSearch() {
  const meta = store.metadata
  const duration = playerState.duration ? Math.round(playerState.duration) : null
  const query = [meta.artist, meta.title].filter(Boolean).join(' - ')

  if (meta.artist && meta.title) {
    store.showLrclib = true
    store.lrclibQuery = query
    store.lrclibBusy = true
    store.lrclibResults = []

    const params = new URLSearchParams({ artist_name: meta.artist, track_name: meta.title })
    if (meta.album) params.set('album_name', meta.album)
    if (duration) params.set('duration', String(duration))

    try {
      const response = await fetch(`https://lrclib.net/api/get?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result && (result.syncedLyrics || result.plainLyrics)) {
          applyLrclibResult(result)
          store.showLrclib = false
          store.lrclibBusy = false
          return
        }
      }
    } catch (err) {
      console.warn('Direct lrclib lookup failed:', err)
    }

    store.lrclibBusy = false
  } else {
    store.showLrclib = !store.showLrclib
    if (store.lrclibQuery === '' && query) store.lrclibQuery = query
  }
}

export async function searchLrclib() {
  const query = store.lrclibQuery.trim()
  if (!query) return

  store.lrclibBusy = true
  store.lrclibResults = []

  try {
    const response = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`)
    const results = await response.json()
    store.lrclibResults = results.slice(0, 10)
  } catch (err) {
    console.error('lrclib search failed:', err)
  } finally {
    store.lrclibBusy = false
  }
}

export function applyLrclibResult(item) {
  store.lyricsText = item.syncedLyrics || item.plainLyrics || ''
  if (item.artistName) store.metadata.artist = item.artistName
  if (item.trackName) store.metadata.title = item.trackName
  if (item.albumName) store.metadata.album = item.albumName
}

/* ---------------------------------------------------------- transcription */

export async function startTranscription(modelId) {
  if (!store.audioFile) {
    console.error('No audio file loaded for transcription')
    alert('Please add an audio file first before transcribing.')
    return
  }

  store.lyricsText = ''
  store.transcribe = { active: true, status: 'Loading AI model...', progress: 0 }

  try {
    const { initTranscriber, transcribe } = await import('./transcriber.js')
    const selectedModel = modelId || MODELS[0].id
    const modelInfo = MODELS.find((m) => m.id === selectedModel)

    await initTranscriber((progress) => {
      if (progress.status === 'progress' && progress.progress !== undefined) {
        const pct = Math.round(progress.progress)
        store.transcribe.status = `Downloading ${modelInfo?.name || 'model'}... ${pct}%`
        store.transcribe.progress = pct * 0.3
      } else if (progress.status === 'ready') {
        store.transcribe.status = 'Model loaded, preparing audio...'
      } else if (progress.file) {
        store.transcribe.status = `Loading ${progress.file.split('/').pop()}...`
      }
    }, selectedModel)

    store.transcribe.status = 'Preparing audio for transcription...'
    store.transcribe.progress = 30

    const lines = await transcribe(store.audioFile, (progress) => {
      if (progress.status) store.transcribe.status = progress.status

      if (progress.progress !== undefined) {
        store.transcribe.progress = 30 + Math.round(progress.progress * 65)

        let status = `Transcribing: ${Math.round(progress.progress * 100)}%`
        if (progress.chunk && progress.totalChunks) {
          status = `Transcribing chunk ${progress.chunk}/${progress.totalChunks}`
        }
        if (progress.remaining && progress.remaining > 0) {
          const mins = Math.floor(progress.remaining / 60)
          const secs = Math.round(progress.remaining % 60)
          status += mins > 0 ? ` (~${mins}m ${secs}s remaining)` : ` (~${secs}s remaining)`
        }
        store.transcribe.status = status
      }
    })

    const hasTimestamps = lines.some((line) => line.time !== null)
    store.lyricsText = hasTimestamps
      ? lines.map((line) => (line.time !== null ? `${formatTimestamp(line.time)}${line.text}` : line.text)).join('\n')
      : lines.map((line) => line.text).join('\n')

    store.transcribe.status = `✓ Transcribed ${lines.length} lines`
    store.transcribe.progress = 100
    setTimeout(() => {
      store.transcribe = { active: false, status: '', progress: 0 }
    }, 1500)
  } catch (error) {
    console.error('Transcription failed:', error)
    store.transcribe.status = `Error: ${error.message}`
    setTimeout(() => {
      store.transcribe = { active: false, status: '', progress: 0 }
    }, 3000)
  }
}

/* ------------------------------------------------------------ step 3 sync */

/**
 * Seek to a time and temporarily disable auto-selection so that a user-initiated
 * jump is not immediately overwritten by the playback-driven line selection.
 */
let seekTimer = null
export function jumpToTime(time) {
  store.seeking = true
  player.seek(time)

  if (seekTimer) clearTimeout(seekTimer)
  seekTimer = setTimeout(() => {
    store.seeking = false
    seekTimer = null
  }, 200)
}

export function selectAndSeek(index) {
  editor.selectLine(index)
  const line = editor.lines[index]
  if (line && line.time !== null) {
    jumpToTime(line.time)
    if (!playerState.isPlaying && playerState.autoPlay) player.play()
  }
}

export function navigate(delta) {
  if (delta < 0) editor.selectPreviousLine()
  else editor.selectNextLine()

  const line = editor.getSelectedLine()
  if (line?.time !== null && line?.time !== undefined) jumpToTime(line.time)
}

export function adjustTimestamp(delta) {
  if (!editor.hasLyrics) return
  const newTime = editor.adjustTimestamp(delta)
  jumpToTime(newTime)
}

/**
 * Tap-to-sync: stamp the selected line with the current playback time and move
 * to the next one. Marking mode is required so the playback loop does not
 * auto-select a different line the instant the timestamp lands.
 */
export function markCurrentLine() {
  if (!editor.hasLyrics) return

  store.markingMode = true
  editor.markAndAdvance(playerState.currentTime)
  if (!playerState.isPlaying) player.play()
}

export function exitMarkingMode() {
  store.markingMode = false
}

/**
 * Remove the timestamp of a single line, turning it back into an unsynced line.
 * Used when a line was marked at the wrong time and the user wants to redo it.
 *
 * Note: editor.setTimestamp() clamps to >= 0, so a null timestamp has to be
 * assigned directly instead.
 *
 * @param {number} index - Line index
 * @returns {boolean} true if a timestamp was actually removed
 */
export function clearLineTimestamp(index) {
  const line = editor.lines[index]
  if (!line || line.time === null) return false

  editor.lines[index] = { ...line, time: null }

  // The playback highlight should not linger on a line that no longer has a time.
  if (editor.currentPlayingIndex === index) editor.currentPlayingIndex = -1

  return true
}

/**
 * Remove every timestamp, leaving the lyrics as plain unsynced text.
 * @returns {number} How many timestamps were removed
 */
export function clearAllTimestamps() {
  const count = editor.lines.filter((line) => line.time !== null).length
  if (count === 0) return 0

  editor.lines = editor.lines.map((line) => ({ ...line, time: null }))
  editor.currentPlayingIndex = -1
  store.markingMode = false

  return count
}

export function addLineAtCurrentTime() {
  const index = editor.addLine(playerState.currentTime || 0, '')
  return index
}

/**
 * Split a line at the cursor: keep the text before the cursor on the current line
 * and insert the remainder as a new line at the midpoint between the current line
 * and the next one. Returns the index of the newly inserted line.
 *
 * The insert position is explicit (index + 1) rather than time-based, because
 * neighbouring lines may still have no timestamp at all.
 */
export function splitLine(index, textBefore, textAfter) {
  const current = editor.lines[index]
  if (!current) return -1

  editor.updateLineText(index, textBefore)

  const nextLine = editor.lines[index + 1]
  const baseTime = current.time ?? 0
  const newTime = nextLine && nextLine.time !== null ? (baseTime + nextLine.time) / 2 : baseTime + 0.1

  editor.lines.splice(index + 1, 0, { time: newTime, text: textAfter, id: Date.now() })
  editor.selectLine(index + 1)

  return index + 1
}

export function deleteLine(index) {
  if (editor.lines.length <= 1) return
  editor.deleteLine(index)
}

/**
 * Fill in every line that has no timestamp. Rather than a flat interval across
 * the whole track (which can push the last line past the end when blank lines or
 * already-timed lines are mixed in), each unsynced line is spread evenly inside
 * the gap between its nearest timed neighbours.
 */
export function autoSyncUnsyncedLines() {
  if (!editor.hasLyrics || playerState.duration <= 0) return

  const lines = [...editor.lines]
  const lastTime = Math.max(0, playerState.duration - 0.5)

  // Collect runs of consecutive unsynced lines and distribute each run inside
  // the window bounded by the timed lines around it.
  let i = 0
  while (i < lines.length) {
    if (lines[i].time !== null) {
      i++
      continue
    }

    const runStart = i
    while (i < lines.length && lines[i].time === null) i++
    const runEnd = i - 1

    const before = lines[runStart - 1]?.time
    const after = lines[runEnd + 1]?.time
    const windowStart = before !== undefined && before !== null ? before : 0
    const windowEnd = after !== undefined && after !== null ? after : lastTime

    const count = runEnd - runStart + 1
    const span = Math.max(0, windowEnd - windowStart)
    const step = span / count

    for (let k = 0; k < count; k++) {
      lines[runStart + k] = { ...lines[runStart + k], time: windowStart + step * (k + 0.5) }
    }
  }

  editor.lines = lines
}

export function lrcPreview() {
  return editor.toLRC()
}

export function exportFilename() {
  const { artist, title } = editor.metadata
  return title ? `${artist || 'Unknown'} - ${title}.lrc` : 'lyrics.lrc'
}

/* --------------------------------------------------- player event wiring */

// The AudioPlayer class exposes plain callback properties, so we assign them
// once here instead of registering listeners.
player.onTimeUpdate = (time) => {
  playerState.currentTime = time

  const playingIndex = editor.updatePlayingLine(time)

  // Only follow the music while genuinely playing: a manual seek or an active
  // tap-to-sync session must not have the selection stolen away.
  //
  // A line the user picked on purpose but which still has no timestamp has
  // nothing to seek to, so playback never moves to it. Without this guard the
  // playback highlight would pull the selection straight back to the line that
  // is playing, making it impossible to click (or step onto) an unsynced line.
  const selectedLine = editor.lines[editor.selectedIndex]
  if (
    playerState.isPlaying &&
    playingIndex >= 0 &&
    playingIndex !== editor.selectedIndex &&
    !store.markingMode &&
    !store.seeking &&
    selectedLine &&
    selectedLine.time !== null
  ) {
    editor.selectLine(playingIndex)
  }
}

player.onDurationChange = (duration) => {
  playerState.duration = duration
  playerState.ready = true
}

player.onPlay = () => {
  playerState.isPlaying = true
}

player.onPause = () => {
  playerState.isPlaying = false
  exitMarkingMode()
}

player.onError = (err) => {
  console.error('Player error:', err)
}

/* ------------------------------------------------------------- demo lyrics */

const DEMO_LYRICS = `Pulled up at the red light
Windows down, I'm feelin' brave
Belting out that power ballad
Like I'm center stage
"I can see clearly now, Lorraine is gone"
Yeah I hit that note so proud
'Til my girl starts cry-laugh-crying
Rollin' in the passenger seat, way too loud

I sing it wrong, sing it strong
Got the messed up words, but the vibe's still on
Bone apple tea to the fancy song
If it sounds kinda right, I'm gonna sing along
Yeah, call me out, I'll just sing it louder
Confidence, baby, that's my superpower
I sing it wrong, sing it strong
But you're still dancin' when you hear this song

At church I went full gospel
Thought I knew that chorus line
"Round John Virgin, mother and child"
Pastor gave me side-eye from the shrine
At the bar it's classic rock night
I'm their beautiful disaster, man
"Hold me closer, Tony Danza"
Got the whole place clappin' with their cans

I sing it wrong, sing it strong
Got the messed up words, but the vibe's still on
Bone apple tea to the fancy song
If it sounds kinda right, I'm gonna sing along
Yeah, call me out, I'll just sing it louder
Confidence, baby, that's my superpower
I sing it wrong, sing it strong
But you're still dancin' when you hear this song

Your mama in the kitchen like, "Boy, behave"
But I still toast up, "Bone apple tea," wave
Misheard grace, got a gravy stain prayer
"Lead us not into Penn Station" in the air
Your playlist's poetry, mine's karaoke crime
But I turn wrong lyrics into pickup lines
Leanin' in close, low and slow, I grin
"Is it you're the one that I want, or you're the one that I won?"

I sing it wrong, sing it strong
Got the messed up words, but the vibe's still on
Bone apple tea to the fancy song
If it sounds kinda right, I'm gonna sing along
Yeah, call me out, I'll just sing it louder
Confidence, baby, that's my superpower
I sing it wrong, sing it strong
But you're still dancin' when you hear this song`
