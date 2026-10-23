<script setup>
import { store, editor, goToStep, startOver, lrcPreview, exportFilename } from '../store.js'

function copyToClipboard() {
  if (!editor.hasLyrics) return
  navigator.clipboard.writeText(lrcPreview()).catch((err) => console.error('Copy failed:', err))
}

function downloadLRC() {
  if (!editor.hasLyrics) return

  const blob = new Blob([lrcPreview()], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = exportFilename()
  anchor.click()
  URL.revokeObjectURL(url)
}

function publishToLrclib() {
  store.publishStatus = 'Publishing is not yet implemented...'
}
</script>

<template>
  <div class="text-center mb-6">
    <h2 class="text-2xl font-bold text-slate-200 mb-2">Export Lyrics</h2>
    <p class="text-slate-400">Download or share your synced lyrics</p>
  </div>

  <div class="mb-6">
    <label class="block text-sm text-slate-400 mb-2">PREVIEW</label>
    <pre class="bg-slate-800 border border-slate-700 rounded-lg p-4 text-sm font-mono text-slate-300 h-48 overflow-y-auto whitespace-pre-wrap">{{ lrcPreview() }}</pre>
  </div>

  <div class="space-y-3 mb-6">
    <button class="btn btn-secondary w-full flex items-center justify-center gap-2" @click="copyToClipboard">
      <span>📋</span> Copy to Clipboard
    </button>
    <button class="btn btn-primary w-full flex items-center justify-center gap-2" @click="downloadLRC">
      <span>💾</span> Download LRC File
    </button>
  </div>

  <div class="divider-text mb-6">
    <span>or publish online</span>
  </div>

  <div class="bg-slate-800/50 rounded-lg p-4 mb-6">
    <p class="text-slate-400 text-sm mb-3">Share your synced lyrics with the community</p>
    <button class="btn btn-secondary w-full flex items-center justify-center gap-2" @click="publishToLrclib">
      <span>🌐</span> Publish to lrclib.net
    </button>
    <p v-if="store.publishStatus" class="text-xs text-slate-500 mt-2 text-center">{{ store.publishStatus }}</p>
  </div>

  <div class="flex justify-between">
    <button class="btn btn-secondary" @click="goToStep(3)">← Edit</button>
    <button class="btn btn-secondary" @click="startOver">Start Over</button>
  </div>
</template>
