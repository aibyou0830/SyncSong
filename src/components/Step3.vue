<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import {
  editor,
  playerState,
  store,
  goToStep,
  selectAndSeek,
  navigate,
  adjustTimestamp,
  markCurrentLine,
  addLineAtCurrentTime,
  splitLine,
  deleteLine,
  autoSyncUnsyncedLines,
  clearLineTimestamp,
  clearAllTimestamps,
  formatTimestamp,
} from '../store.js'

/* ---------------------------------------------------------------- editing */

const lyricsEl = ref(null)
const editingIndex = ref(null)
const editText = ref('')

const unsyncedCount = computed(() => editor.lines.filter((line) => line.time === null).length)
const syncedCount = computed(() => editor.lines.filter((line) => line.time !== null).length)

/* Clear-all is destructive, so it requires a second click to confirm. */
const confirmClearAll = ref(false)
let confirmTimer = null

function requestClearAllTimestamps() {
  if (!confirmClearAll.value) {
    confirmClearAll.value = true
    confirmTimer = setTimeout(() => {
      confirmClearAll.value = false
    }, 4000)
    return
  }

  clearTimeout(confirmTimer)
  confirmTimer = null
  confirmClearAll.value = false
  clearAllTimestamps()
}

onUnmounted(() => {
  if (confirmTimer) clearTimeout(confirmTimer)
})

function focusLyrics() {
  lyricsEl.value?.focus()
}

function focusEditInput(atStart = false) {
  nextTick(() => {
    const input = lyricsEl.value?.querySelector('.lyric-edit-input')
    if (!input) return
    input.focus()
    if (atStart) input.setSelectionRange(0, 0)
    else input.select()
  })
}

function startEdit(index, cursorAtStart = false) {
  if (editingIndex.value !== null && editingIndex.value !== index) saveEdit()

  const line = editor.lines[index]
  if (!line) return

  editingIndex.value = index
  editText.value = line.text
  focusEditInput(cursorAtStart)
}

function saveEdit() {
  if (editingIndex.value === null) return
  const index = editingIndex.value
  editor.updateLineText(index, editText.value.trim())
  editingIndex.value = null
  focusLyrics()
}

function cancelEdit() {
  editingIndex.value = null
  focusLyrics()
}

/**
 * Leaving edit mode whenever the selection moves elsewhere (playback advance,
 * arrow navigation, a click on another line) so a stale inline input never
 * overwrites a line the user has stopped working on.
 */
watch(
  () => editor.selectedIndex,
  (index) => {
    if (editingIndex.value !== null && editingIndex.value !== index) saveEdit()
  }
)

/* ----------------------------------------------------------- scroll/active */

// Keep the line being worked on in view when the selection jumps.
watch(
  () => editor.selectedIndex,
  (index) => {
    if (store.step !== 3) return
    lyricsEl.value?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
)

/* -------------------------------------------------------------- keyboard */

function onKeyDown(event) {
  if (!editor.hasLyrics) return

  const target = event.target
  if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
    return
  }

  // Any deliberate navigation ends an ongoing tap-to-sync session.
  store.markingMode = false

  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault()
      navigate(-1)
      break
    case 'ArrowDown':
      event.preventDefault()
      navigate(1)
      break
    case 'ArrowLeft':
      event.preventDefault()
      adjustTimestamp(-0.1)
      break
    case 'ArrowRight':
      event.preventDefault()
      adjustTimestamp(0.1)
      break
    case 'Enter':
      event.preventDefault()
      markCurrentLine()
      break
    case 'Backspace':
      event.preventDefault()
      navigate(-1)
      break
    case 'Delete':
      event.preventDefault()
      clearLineTimestamp(editor.selectedIndex)
      break
    default:
      break
  }
}

function onEditKeyDown(event, index) {
  event.stopPropagation()

  if (event.key === 'Enter' && event.shiftKey) {
    event.preventDefault()
    const cursorPos = event.target.selectionStart ?? editText.value.length
    const textBefore = editText.value.slice(0, cursorPos).trim()
    const textAfter = editText.value.slice(cursorPos).trim()

    // Clear the editing state before inserting, otherwise the selection watcher
    // would flush the unsplit text back into the original line.
    editingIndex.value = null
    const newIndex = splitLine(index, textBefore, textAfter)
    if (newIndex >= 0) {
      editingIndex.value = newIndex
      editText.value = editor.lines[newIndex].text
      focusEditInput(true)
    }
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    saveEdit()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelEdit()
  }
}

/* --------------------------------------------------------------- actions */

function onLineClick(event, index) {
  // Do not re-select or seek while the user is typing in an inline edit box,
  // or while tapping the edit/delete buttons.
  if (event.target.closest('.lyric-actions') || event.target.closest('.lyric-edit-input')) return
  if (editingIndex.value === index) return

  store.markingMode = false
  selectAndSeek(index)
}

function addLine() {
  const index = addLineAtCurrentTime()
  startEdit(index)
}
</script>

<template>
  <div class="text-center mb-4">
    <h2 class="text-2xl font-bold text-slate-200 mb-1">Sync Lyrics</h2>
    <p class="text-slate-400 text-sm">Adjust timestamps while listening</p>
  </div>

  <div class="mt-3 mb-3 flex items-center justify-between text-xs text-slate-500">
    <div class="hidden sm:block">
      <kbd class="kbd">←</kbd><kbd class="kbd">→</kbd> adjust ·
      <kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd> navigate ·
      <kbd class="kbd">Enter</kbd> mark ·
      <kbd class="kbd">Shift</kbd>+<kbd class="kbd">Enter</kbd> split line ·
      <kbd class="kbd">Delete</kbd> clear stamp
    </div>
    <div class="flex items-center gap-2 ml-auto">
      <span id="line-counter">Line {{ editor.selectedIndex + 1 }} of {{ editor.lineCount }}</span>
      <button class="btn btn-secondary text-xs px-2 py-1" @click="addLine" title="Add new line at current time">
        + Add Line
      </button>
      <button
        v-if="syncedCount > 0"
        class="btn btn-secondary text-xs px-2 py-1"
        :class="{ 'btn-danger-confirm': confirmClearAll }"
        :title="confirmClearAll ? 'Click again to confirm' : 'Remove every timestamp and start the sync over'"
        @click="requestClearAllTimestamps"
      >
        {{ confirmClearAll ? `Confirm: clear ${syncedCount} stamps` : 'Clear all stamps' }}
      </button>
    </div>
  </div>

  <div v-if="unsyncedCount > 0" class="mb-3 flex items-center justify-between gap-2 text-xs bg-slate-800/50 border border-slate-700 rounded-lg p-3">
    <span class="text-slate-400">
      {{ unsyncedCount }} line{{ unsyncedCount > 1 ? 's' : '' }} still without a timestamp — they will be dropped from the exported file.
    </span>
    <button class="btn btn-secondary text-xs px-2 py-1" @click="autoSyncUnsyncedLines">
      Auto-sync by duration
    </button>
  </div>

  <div
    id="lyrics-display"
    ref="lyricsEl"
    class="h-72 bg-slate-800 border border-slate-700 rounded-lg p-3 overflow-y-auto focus:outline-none focus:ring-2 focus:ring-primary-500"
    tabindex="0"
    @keydown="onKeyDown"
  >
    <p v-if="editor.lines.length === 0" class="text-slate-500 text-center py-8">No lyrics loaded</p>

    <div
      v-for="(line, index) in editor.lines"
      :key="line.id"
      class="lyric-line"
      :class="{ selected: index === editor.selectedIndex, active: index === editor.currentPlayingIndex }"
      :data-index="index"
      @click="onLineClick($event, index)"
    >
      <span class="lyric-timestamp">{{ line.time !== null ? formatTimestamp(line.time) : '--:--' }}</span>

      <div class="lyric-text" :class="{ empty: !line.text.trim() }">
        <input
          v-if="index === editingIndex"
          class="lyric-edit-input"
          type="text"
          v-model="editText"
          @keydown="onEditKeyDown($event, index)"
          @blur="saveEdit"
        >
        <span v-else>{{ line.text.trim() ? line.text : '(instrumental)' }}</span>
      </div>

      <div class="lyric-actions">
        <button
          v-if="line.time !== null"
          class="lyric-btn lyric-btn-clear"
          :title="`Clear timestamp of line ${index + 1}`"
          @click.stop="clearLineTimestamp(index)"
        >⌫</button>
        <button class="lyric-btn lyric-btn-edit" title="Edit line" @click.stop="startEdit(index)">✏️</button>
        <button class="lyric-btn lyric-btn-delete" title="Delete line" @click.stop="deleteLine(index)">🗑️</button>
      </div>
    </div>
  </div>

  <div class="sync-controls mt-3 flex items-center justify-center gap-2">
    <button class="sync-btn" title="Decrease timestamp by 0.1s" @click="adjustTimestamp(-0.1)">
      <span class="text-lg">−</span>
      <span class="text-xs">0.1s</span>
    </button>
    <button class="sync-btn sync-btn-mark" title="Set timestamp to current time and advance" @click="markCurrentLine">
      <span class="text-lg">🎯</span>
      <span class="text-xs">Mark</span>
    </button>
    <button class="sync-btn" title="Increase timestamp by 0.1s" @click="adjustTimestamp(0.1)">
      <span class="text-lg">+</span>
      <span class="text-xs">0.1s</span>
    </button>
  </div>

  <div class="mt-6 flex justify-between">
    <button class="btn btn-secondary" @click="goToStep(2)">← Back</button>
    <button class="btn btn-primary" :disabled="syncedCount === 0" :title="syncedCount === 0 ? 'Nothing is synced yet — clear-all removed every timestamp' : ''" @click="goToStep(4)">Next: Export →</button>
  </div>
</template>
