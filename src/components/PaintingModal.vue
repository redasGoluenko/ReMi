<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { Painting, PaintingAuthor } from '../types/painting'

const props = defineProps<{
  viewer: PaintingAuthor | null
  unreadPaintings: Painting[]
  isSaving: boolean
}>()

const emit = defineEmits<{
  close: []
  chooseViewer: [viewer: PaintingAuthor]
  dismiss: [id: string]
  submit: [imageData: string]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasWrapRef = ref<HTMLDivElement | null>(null)
const colorPickerRef = ref<HTMLDivElement | null>(null)
const hueSliderRef = ref<HTMLDivElement | null>(null)
const selectedColor = ref('#2b2118')
const selectedHue = ref(hexToHsv(selectedColor.value).h)
const brushSize = ref(8)
const hasDrawn = ref(false)
const isDrawing = ref(false)
const isBrushModalOpen = ref(false)
const isPickingColor = ref(false)
const isPickingHue = ref(false)
const activePaintingIndex = ref(0)
const lastPoint = ref<{ x: number; y: number } | null>(null)
const canvasHistory = ref<ImageData[]>([])

const currentPainting = computed(() => props.unreadPaintings[activePaintingIndex.value] ?? null)
const hasUnread = computed(() => props.unreadPaintings.length > 0)
const canDraw = computed(() => Boolean(props.viewer) && !hasUnread.value)
const canUndo = computed(() => canvasHistory.value.length > 0)

watch(
  () => props.unreadPaintings.length,
  () => {
    activePaintingIndex.value = 0
  },
)

watch(
  canDraw,
  async (nextCanDraw) => {
    if (!nextCanDraw) {
      return
    }

    await nextTick()
    resizeCanvas()
  },
  { immediate: true },
)

function authorName(author: PaintingAuthor) {
  return author === 'redas' ? 'Redas' : 'Migle'
}

function formatSentAt(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function chooseViewer(viewer: PaintingAuthor) {
  emit('chooseViewer', viewer)
}

function dismissCurrent() {
  if (!currentPainting.value) {
    return
  }

  emit('dismiss', currentPainting.value.id)
}

function resizeCanvas() {
  const canvas = canvasRef.value
  const wrapper = canvasWrapRef.value

  if (!canvas || !wrapper) {
    return
  }

  const rect = wrapper.getBoundingClientRect()
  const pixelRatio = window.devicePixelRatio || 1
  const width = Math.max(300, Math.floor(rect.width))
  const height = Math.max(300, Math.floor(rect.height))

  canvas.width = Math.floor(width * pixelRatio)
  canvas.height = Math.floor(height * pixelRatio)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const context = canvas.getContext('2d')

  if (!context) {
    return
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.fillStyle = '#fff8ef'
  context.fillRect(0, 0, width, height)
  canvasHistory.value = []
  hasDrawn.value = false
}

function getCanvasPoint(event: PointerEvent) {
  const canvas = canvasRef.value

  if (!canvas) {
    return null
  }

  const rect = canvas.getBoundingClientRect()

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function beginDrawing(event: PointerEvent) {
  if (!canDraw.value) {
    return
  }

  const canvas = canvasRef.value
  const point = getCanvasPoint(event)

  if (!canvas || !point) {
    return
  }

  event.preventDefault()
  saveCanvasSnapshot()
  canvas.setPointerCapture(event.pointerId)
  isDrawing.value = true
  lastPoint.value = point
  drawPoint(point)
}

function continueDrawing(event: PointerEvent) {
  if (!isDrawing.value || !lastPoint.value) {
    return
  }

  const point = getCanvasPoint(event)

  if (!point) {
    return
  }

  event.preventDefault()
  drawLine(lastPoint.value, point)
  lastPoint.value = point
}

function endDrawing(event: PointerEvent) {
  if (canvasRef.value?.hasPointerCapture(event.pointerId)) {
    canvasRef.value.releasePointerCapture(event.pointerId)
  }

  isDrawing.value = false
  lastPoint.value = null
}

function drawPoint(point: { x: number; y: number }) {
  const context = canvasRef.value?.getContext('2d')

  if (!context) {
    return
  }

  context.beginPath()
  context.arc(point.x, point.y, brushSize.value / 2, 0, Math.PI * 2)
  context.fillStyle = selectedColor.value
  context.fill()
  hasDrawn.value = true
}

function drawLine(from: { x: number; y: number }, to: { x: number; y: number }) {
  const context = canvasRef.value?.getContext('2d')

  if (!context) {
    return
  }

  context.beginPath()
  context.moveTo(from.x, from.y)
  context.lineTo(to.x, to.y)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = brushSize.value
  context.strokeStyle = selectedColor.value
  context.stroke()
  hasDrawn.value = true
}

function saveCanvasSnapshot() {
  const canvas = canvasRef.value
  const context = canvas?.getContext('2d')

  if (!canvas || !context) {
    return
  }

  canvasHistory.value.push(context.getImageData(0, 0, canvas.width, canvas.height))
}

function undoLastStroke() {
  const canvas = canvasRef.value
  const context = canvas?.getContext('2d')
  const previousCanvas = canvasHistory.value.pop()

  if (!canvas || !context || !previousCanvas) {
    return
  }

  context.save()
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.putImageData(previousCanvas, 0, 0)
  context.restore()
  hasDrawn.value = canvasHistory.value.length > 0
}

function submitPainting() {
  const canvas = canvasRef.value

  if (!canvas || !hasDrawn.value || props.isSaving) {
    return
  }

  emit('submit', canvas.toDataURL('image/png'))
}

function closeBrushModal() {
  isBrushModalOpen.value = false
}

function openColorPicker() {
  isBrushModalOpen.value = true
}

function pickColor(event: PointerEvent) {
  const picker = colorPickerRef.value

  if (!picker) {
    return
  }

  const rect = picker.getBoundingClientRect()
  const saturation = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  const value = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height))

  selectedColor.value = hsvToHex(selectedHue.value, saturation, value)
}

function beginColorPick(event: PointerEvent) {
  colorPickerRef.value?.setPointerCapture(event.pointerId)
  isPickingColor.value = true
  pickColor(event)
}

function continueColorPick(event: PointerEvent) {
  if (!isPickingColor.value) {
    return
  }

  pickColor(event)
}

function endColorPick(event: PointerEvent) {
  if (colorPickerRef.value?.hasPointerCapture(event.pointerId)) {
    colorPickerRef.value.releasePointerCapture(event.pointerId)
  }

  isPickingColor.value = false
}

function pickHue(event: PointerEvent) {
  const slider = hueSliderRef.value

  if (!slider) {
    return
  }

  const rect = slider.getBoundingClientRect()
  const position = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  selectedHue.value = Math.round(position * 360)
  updateHue()
}

function beginHuePick(event: PointerEvent) {
  hueSliderRef.value?.setPointerCapture(event.pointerId)
  isPickingHue.value = true
  pickHue(event)
}

function continueHuePick(event: PointerEvent) {
  if (!isPickingHue.value) {
    return
  }

  pickHue(event)
}

function endHuePick(event: PointerEvent) {
  if (hueSliderRef.value?.hasPointerCapture(event.pointerId)) {
    hueSliderRef.value.releasePointerCapture(event.pointerId)
  }

  isPickingHue.value = false
}

function updateHue() {
  const { s, v } = hexToHsv(selectedColor.value)
  selectedColor.value = hsvToHex(selectedHue.value, s, v)
}

function hsvToHex(hue: number, saturation: number, value: number) {
  const chroma = value * saturation
  const hueSegment = hue / 60
  const x = chroma * (1 - Math.abs((hueSegment % 2) - 1))
  const match = value - chroma
  let red = 0
  let green = 0
  let blue = 0

  if (hueSegment >= 0 && hueSegment < 1) {
    red = chroma
    green = x
  } else if (hueSegment < 2) {
    red = x
    green = chroma
  } else if (hueSegment < 3) {
    green = chroma
    blue = x
  } else if (hueSegment < 4) {
    green = x
    blue = chroma
  } else if (hueSegment < 5) {
    red = x
    blue = chroma
  } else {
    red = chroma
    blue = x
  }

  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, '0'))
    .join('')}`
}

function hexToHsv(hex: string) {
  const normalized = hex.replace('#', '')
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let hue = 0

  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6)
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2)
    } else {
      hue = 60 * ((red - green) / delta + 4)
    }
  }

  return {
    h: hue < 0 ? hue + 360 : hue,
    s: max === 0 ? 1 : delta / max,
    v: max === 0 ? 1 : max,
  }
}

window.addEventListener('resize', resizeCanvas)

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas)
})
</script>

<template>
  <div class="fixed inset-0 z-50 bg-[#f7eddc] text-[#2f261b]">
    <section class="relative flex h-full w-full flex-col overflow-hidden">
      <div
        v-if="viewer && !hasUnread"
        class="flex min-h-[4.25rem] items-center gap-3 border-b border-[#e2cfb5] bg-[#f7eddc] px-3 py-3 sm:px-5"
      >
        <button
          type="button"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#b99767] bg-[#fff8ef] shadow-sm transition hover:bg-[#efe1cc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88a44]"
          aria-label="Open brush color"
          @click="openColorPicker"
        >
          <span class="relative h-6 w-6 overflow-hidden rounded-full border border-[#8f7655]" aria-hidden="true">
            <span
              class="absolute inset-0"
              :style="{ backgroundColor: selectedColor }"
            />
            <span class="absolute inset-x-0 bottom-0 h-1/3 bg-white/35" />
          </span>
        </button>

        <label class="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold uppercase text-[#5b4937]">
          Size
          <input
            v-model.number="brushSize"
            type="range"
            min="3"
            max="24"
            class="min-w-0 flex-1 accent-[#244f2f]"
            aria-label="Brush size"
          />
        </label>

        <button
          type="button"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d8c3a6] text-2xl leading-none text-[#6f5136] transition hover:bg-[#efe1cc] hover:text-[#2f261b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88a44]"
          aria-label="Close paintings"
          @click="emit('close')"
        >
          &times;
        </button>
      </div>

      <div
        v-else
        class="flex min-h-[4.25rem] items-center gap-3 border-b border-[#e2cfb5] bg-[#f7eddc] px-4 py-3 sm:px-5"
      >
        <div class="min-w-0 flex-1 pr-2">
          <h2 class="truncate text-xl font-semibold text-[#244f2f] sm:text-2xl">Paintings</h2>
          <p class="mt-0.5 truncate text-sm text-[#735f49]">
            <span v-if="!viewer">Choose who is using this device.</span>
            <span v-else>A painting is waiting for you.</span>
          </p>
        </div>

        <button
          type="button"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d8c3a6] text-2xl leading-none text-[#6f5136] transition hover:bg-[#efe1cc] hover:text-[#2f261b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88a44]"
          aria-label="Close paintings"
          @click="emit('close')"
        >
          &times;
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
        <div v-if="!viewer" class="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            class="rounded-2xl border border-[#d8c3a6] bg-[#fff8ef] px-4 py-5 text-left transition hover:bg-[#efe1cc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88a44]"
            @click="chooseViewer('redas')"
          >
            <span class="block text-lg font-semibold text-[#2f261b]">Redas</span>
            <span class="mt-1 block text-sm text-[#735f49]">Show paintings from Migle.</span>
          </button>

          <button
            type="button"
            class="rounded-2xl border border-[#d8c3a6] bg-[#fff8ef] px-4 py-5 text-left transition hover:bg-[#efe1cc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88a44]"
            @click="chooseViewer('migle')"
          >
            <span class="block text-lg font-semibold text-[#2f261b]">Migle</span>
            <span class="mt-1 block text-sm text-[#735f49]">Show paintings from Redas.</span>
          </button>
        </div>

        <div v-else-if="currentPainting" class="space-y-4">
          <div class="overflow-hidden rounded-[1.25rem] border border-[#dcc8ac] bg-[#fff8ef]">
            <img
              :src="currentPainting.imageData"
              :alt="`Painting from ${authorName(currentPainting.author)}`"
              class="aspect-square w-full object-contain"
            />
          </div>

          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-[#2f261b]">
                From {{ authorName(currentPainting.author) }}
              </p>
              <p class="text-xs text-[#735f49]">{{ formatSentAt(currentPainting.createdAt) }}</p>
            </div>

            <button
              type="button"
              class="rounded-2xl bg-[#244f2f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f4328] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88a44]"
              @click="dismissCurrent"
            >
              {{ unreadPaintings.length > 1 ? 'Next' : 'Dismiss' }}
            </button>
          </div>
        </div>

        <div v-else class="flex h-full min-h-0 flex-col">
          <div ref="canvasWrapRef" class="min-h-[320px] flex-1 overflow-hidden rounded-[1.25rem] border border-[#dcc8ac] bg-[#fff8ef]">
            <canvas
              ref="canvasRef"
              class="block touch-none"
              aria-label="Drawing canvas"
              @pointerdown="beginDrawing"
              @pointermove="continueDrawing"
              @pointerup="endDrawing"
              @pointercancel="endDrawing"
              @pointerleave="endDrawing"
            />
          </div>
        </div>
      </div>

      <div v-if="viewer && !hasUnread" class="flex gap-3 border-t border-[#e2cfb5] bg-[#f7eddc] p-3 sm:p-5">
        <button
          type="button"
          class="flex-1 rounded-2xl border border-[#d8c3a6] px-4 py-3 font-medium text-[#4d3725] transition hover:bg-[#efe1cc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88a44] disabled:opacity-55"
          :disabled="!canUndo"
          @click="undoLastStroke"
        >
          Undo
        </button>
        <button
          type="button"
          class="flex-1 rounded-2xl bg-[#244f2f] px-4 py-3 font-semibold text-white transition hover:bg-[#1f4328] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d5b376] disabled:opacity-55"
          :disabled="!hasDrawn || isSaving"
          @click="submitPainting"
        >
          {{ isSaving ? 'Sending...' : 'Submit' }}
        </button>
      </div>

      <div
        v-if="isBrushModalOpen"
        class="absolute inset-0 z-20 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
        @click.self="closeBrushModal"
      >
        <section class="w-full max-w-md rounded-[1.5rem] border border-[#ead9c6] bg-[#f7eddc] p-4 shadow-2xl shadow-black/25">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h3 class="text-lg font-semibold text-[#244f2f]">Color</h3>
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-full border border-[#d8c3a6] text-xl leading-none text-[#6f5136] transition hover:bg-[#efe1cc] hover:text-[#2f261b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88a44]"
              aria-label="Close color picker"
              @click="closeBrushModal"
            >
              &times;
            </button>
          </div>

          <div
            ref="colorPickerRef"
            class="h-[min(82vw,24rem)] min-h-72 w-full touch-none cursor-crosshair rounded-[1.1rem] border border-[#d8c3a6] shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88a44]"
            role="slider"
            tabindex="0"
            aria-label="Brush color"
            :style="{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${selectedHue} 100% 50%))`,
            }"
            @pointerdown.prevent="beginColorPick"
            @pointermove.prevent="continueColorPick"
            @pointerup="endColorPick"
            @pointercancel="endColorPick"
          />

          <div class="mt-4 block">
            <span class="mb-2 block text-sm font-medium text-[#5b4937]">Hue</span>
            <div
              ref="hueSliderRef"
              class="relative h-10 w-full touch-none cursor-pointer rounded-full border border-[#d8c3a6] bg-[linear-gradient(to_right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)] shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88a44]"
              role="slider"
              tabindex="0"
              aria-label="Color hue"
              :aria-valuenow="selectedHue"
              aria-valuemin="0"
              aria-valuemax="360"
              @pointerdown.prevent="beginHuePick"
              @pointermove.prevent="continueHuePick"
              @pointerup="endHuePick"
              @pointercancel="endHuePick"
            >
              <span
                class="absolute top-1/2 h-12 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(47,38,27,0.45),0_3px_10px_rgba(0,0,0,0.28)]"
                :style="{
                  left: `${(selectedHue / 360) * 100}%`,
                  backgroundColor: `hsl(${selectedHue} 100% 50%)`,
                }"
                aria-hidden="true"
              />
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>
