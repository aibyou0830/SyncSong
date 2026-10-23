<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  store,
  MODELS,
  goToStep,
  parseLyricsInput,
  applyLyricsFile,
  startTranscription,
  openLrclibSearch,
  searchLrclib,
  applyLrclibResult,
} from '../store.js'

const dragOver = ref(false)
const showModelMenu = ref(false)

const canTranscribe = computed(() => store.audioFile !== null)
const hasLyricsText = computed(() => store.lyricsText.trim().length > 0)

function openFilePicker() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.lrc,.txt,text/plain'
  input.onchange = (event) => {
    const file = event.target.files[0]
    if (file) applyLyricsFile(file)
  }
  input.click()
}

function closeModelMenu() {
  showModelMenu.value = false
}

function onDocumentClick(event) {
  if (showModelMenu.value && !modelGroup.value?.contains(event.target)) {
    closeModelMenu()
  }
}

const modelGroup = ref(null)

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div class="text-center mb-6">
    <h2 class="text-2xl font-bold text-slate-200 mb-2">Add Lyrics</h2>
    <p class="text-slate-400">Import, paste, or type your lyrics</p>
  </div>

  <div class="flex flex-wrap gap-2 mb-4">
    <button class="btn btn-secondary flex-1 flex items-center justify-center gap-2" @click="openLrclibSearch">
      <span>🔍</span> Search LRCLIB
    </button>
    <button class="btn btn-secondary flex-1 flex items-center justify-center gap-2" @click="openFilePicker">
      <span>📂</span> Open File
    </button>

    <div ref="modelGroup" class="flex-1 flex relative">
      <button
        class="btn btn-secondary flex-1 flex items-center justify-center gap-2 rounded-r-none border-r-0"
        :disabled="!canTranscribe"
        :title="canTranscribe ? '' : 'Transcription requires an audio file'"
        @click="startTranscription(MODELS[0].id)"
      >
        <span>🎙️</span> Auto-Transcribe
      </button>
      <button
        class="btn btn-secondary px-2 rounded-l-none border-l border-slate-600"
        :disabled="!canTranscribe"
        aria-label="Select model"
        @click.stop="showModelMenu = !showModelMenu"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      <div
        v-if="showModelMenu"
        class="absolute top-full right-0 mt-1 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50"
      >
        <div class="p-2 border-b border-slate-700">
          <p class="text-xs text-slate-400 font-medium">Select AI Model</p>
        </div>
        <div class="p-1">
          <button
            v-for="model in MODELS"
            :key="model.id"
            class="w-full text-left px-3 py-2 rounded hover:bg-slate-700 transition-colors"
            @click="closeModelMenu(); startTranscription(model.id)"
          >
            <div class="flex justify-between items-center">
              <span class="text-slate-200">{{ model.name }}</span>
              <span class="text-xs text-slate-500">{{ model.size }}</span>
            </div>
            <p class="text-xs text-slate-400">{{ model.note }}</p>
          </button>
        </div>
      </div>
    </div>
  </div>

  <div v-if="store.transcribe.active" class="mb-4">
    <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
      <div class="flex items-center gap-2 text-sm text-slate-400">
        <div class="animate-spin h-4 w-4 border-2 border-primary-400 border-t-transparent rounded-full"></div>
        <span>{{ store.transcribe.status }}</span>
      </div>
      <div class="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div class="h-full bg-primary-500 transition-all duration-300" :style="{ width: `${Math.min(100, store.transcribe.progress)}%` }"></div>
      </div>
      <p class="text-slate-500 text-xs mt-2">First run downloads ~40MB AI model (cached for future use)</p>
    </div>
  </div>

  <div v-if="store.showLrclib" class="mb-4">
    <div class="bg-slate-800 rounded-lg p-4">
      <div class="flex gap-2 mb-3">
        <input type="text" v-model="store.lrclibQuery" class="input-field flex-1" placeholder="Search by artist, title...">
        <button class="btn btn-primary" :disabled="store.lrclibBusy" @click="searchLrclib">Search</button>
      </div>

      <div class="max-h-48 overflow-y-auto">
        <p v-if="store.lrclibBusy" class="text-slate-400 text-sm text-center py-4">Searching...</p>
        <p v-else-if="store.lrclibResults.length === 0" class="text-slate-500 text-sm text-center py-4">
          {{ store.lrclibQuery ? 'No results found' : 'Enter a search query' }}
        </p>
        <template v-else>
          <div
            v-for="(item, i) in store.lrclibResults"
            :key="i"
            class="p-2 hover:bg-slate-700 rounded cursor-pointer"
            @click="applyLrclibResult(item); store.showLrclib = false"
          >
            <p class="text-sm text-slate-200 truncate">{{ item.trackName || 'Unknown' }}</p>
            <p class="text-xs text-slate-400 truncate">{{ item.artistName || 'Unknown' }} - {{ item.albumName || '' }}</p>
            <span v-if="item.syncedLyrics" class="text-xs text-green-500">⏱ Synced</span>
            <span v-else class="text-xs text-slate-500">Plain</span>
          </div>
        </template>
      </div>
    </div>
  </div>

  <div class="mb-4">
    <textarea
      v-model="store.lyricsText"
      class="lyrics-textarea"
      :class="{ 'drag-over': dragOver }"
      placeholder="Paste LRC content, type lyrics, or drag &amp; drop a .lrc/.txt file here..."
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="
        (event) => {
          dragOver = false
          const file = event.dataTransfer.files[0]
          if (file) applyLyricsFile(file)
        }
      "
    ></textarea>
  </div>

  <details class="mb-6">
    <summary class="text-sm text-slate-400 cursor-pointer hover:text-slate-300">
      ▶ Edit metadata (optional)
    </summary>
    <div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label class="block text-xs text-slate-500 mb-1">Artist</label>
        <input type="text" v-model="store.metadata.artist" class="input-field" placeholder="Artist name">
      </div>
      <div>
        <label class="block text-xs text-slate-500 mb-1">Title</label>
        <input type="text" v-model="store.metadata.title" class="input-field" placeholder="Track title">
      </div>
      <div>
        <label class="block text-xs text-slate-500 mb-1">Album</label>
        <input type="text" v-model="store.metadata.album" class="input-field" placeholder="Album name">
      </div>
    </div>
  </details>

  <div class="flex justify-between">
    <button class="btn btn-secondary" @click="goToStep(1)">← Back</button>
    <button class="btn btn-primary" :disabled="!hasLyricsText" @click="parseLyricsInput(); goToStep(3)">
      Next: Sync →
    </button>
  </div>
</template>
