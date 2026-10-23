/**
 * SyncSong - Vue entry point
 */

import './style.css'
import { createApp } from 'vue'
import App from './App.vue'
import { store, editor, player } from './store.js'

const app = createApp(App)

if (import.meta.env.DEV) {
  window.__syncsong = { store, editor, player }
}

app.mount('#app')
