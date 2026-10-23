<script setup>
import { ref } from 'vue'
import { store, playerState, handleAudioFile, loadDemo, formatTime } from '../store.js'

const dragOver = ref(false)

function openFilePicker() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'audio/*,.mp3,.flac,.ogg,.m4a,.wav'
  input.onchange = (event) => {
    const file = event.target.files[0]
    if (file) handleAudioFile(file)
  }
  input.click()
}
</script>

<template>
  <div class="text-center mb-6">
    <h2 class="text-2xl font-bold text-slate-200 mb-2">Add Your Song</h2>
    <p class="text-slate-400">Drop an audio file to get started</p>
  </div>

  <div
    v-if="!store.audioFile"
    class="drop-zone-large"
    :class="{ 'drag-over': dragOver }"
    @dragover.prevent="dragOver = true"
    @dragleave="dragOver = false"
    @drop.prevent="
      (event) => {
        dragOver = false
        const file = event.dataTransfer.files[0]
        if (file) handleAudioFile(file)
      }
    "
    @click="openFilePicker"
  >
    <div class="text-center">
      <div class="text-6xl mb-4">🎵</div>
      <p class="text-slate-200 font-medium text-lg mb-2">Drop audio file here</p>
      <p class="text-slate-500">or click to browse</p>
      <p class="text-slate-600 text-sm mt-4">MP3, FLAC, OGG, M4A, WAV</p>
    </div>
  </div>

  <div class="mt-6 text-center">
    <p class="text-slate-500 text-sm mb-2">Don't have a song handy?</p>
    <button id="btn-try-demo" class="btn btn-secondary" @click="loadDemo">
      🎤 Try it out with a demo
    </button>
  </div>

  <div v-if="store.audioFile" class="mt-6">
    <div class="bg-slate-800 rounded-lg p-4">
      <div class="flex items-center gap-4">
        <div class="text-4xl">🎵</div>
        <div class="flex-1 min-w-0">
          <p class="font-medium text-slate-200 truncate">{{ store.audioFile.name }}</p>
          <p class="text-sm text-slate-400">{{ formatTime(playerState.duration) }}</p>
        </div>
        <button class="btn btn-secondary text-sm" @click="openFilePicker">Change</button>
      </div>
    </div>
  </div>
</template>
