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
const selectedColor = ref('#2b2118')
const brushSize = ref(8)
const hasDrawn = ref(false)
const isDrawing = ref(false)
const activePaintingIndex = ref(0)
const lastPoint = ref<{ x: number; y: number } | null>(null)

const colors = ['#2b2118', '#8d2d2c', '#214f38', '#2e5f8a', '#c58b2d', '#f7eddc']
const currentPainting = computed(() => props.unreadPaintings[activePaintingIndex.value] ?? null)
const hasUnread = computed(() => props.unreadPaintings.length > 0)
const canDraw = computed(() => Boolean(props.viewer) && !hasUnread.value)

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

function clearCanvas() {
  resizeCanvas()
}

function submitPainting() {
  const canvas = canvasRef.value

  if (!canvas || !hasDrawn.value || props.isSaving) {
    return
  }

  emit('submit', canvas.toDataURL('image/png'))
}

window.addEventListener('resize', resizeCanvas)

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas)
})
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-md"
    @click.self="emit('close')"
  >
    <section class="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] border border-[#ead9c6]/80 bg-[#f7eddc] text-[#2f261b] shadow-2xl shadow-black/25">
      <button
        type="button"
        class="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#d8c3a6] text-xl leading-none text-[#6f5136] transition hover:bg-[#efe1cc] hover:text-[#2f261b] focus:outline-none focus:ring-2 focus:ring-[#b88a44]"
        aria-label="Close paintings"
        @click="emit('close')"
      >
        &times;
      </button>

      <div class="border-b border-[#e2cfb5] px-4 py-4 pr-14 sm:px-5">
        <h2 class="text-2xl font-semibold text-[#244f2f]">Paintings</h2>
        <p class="mt-1 text-sm text-[#735f49]">
          <span v-if="!viewer">Choose who is using this device.</span>
          <span v-else-if="hasUnread">A painting is waiting for you.</span>
          <span v-else>Draw something and send it across.</span>
        </p>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div v-if="!viewer" class="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            class="rounded-2xl border border-[#d8c3a6] bg-[#fff8ef] px-4 py-5 text-left transition hover:bg-[#efe1cc] focus:outline-none focus:ring-2 focus:ring-[#b88a44]"
            @click="chooseViewer('redas')"
          >
            <span class="block text-lg font-semibold text-[#2f261b]">Redas</span>
            <span class="mt-1 block text-sm text-[#735f49]">Show paintings from Migle.</span>
          </button>

          <button
            type="button"
            class="rounded-2xl border border-[#d8c3a6] bg-[#fff8ef] px-4 py-5 text-left transition hover:bg-[#efe1cc] focus:outline-none focus:ring-2 focus:ring-[#b88a44]"
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
              class="rounded-2xl bg-[#244f2f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f4328] focus:outline-none focus:ring-2 focus:ring-[#b88a44]"
              @click="dismissCurrent"
            >
              {{ unreadPaintings.length > 1 ? 'Next' : 'Dismiss' }}
            </button>
          </div>
        </div>

        <div v-else class="space-y-4">
          <div ref="canvasWrapRef" class="h-[min(62vh,520px)] min-h-[320px] overflow-hidden rounded-[1.25rem] border border-[#dcc8ac] bg-[#fff8ef]">
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

          <div class="flex flex-wrap items-center gap-3">
            <div class="flex gap-2" aria-label="Brush colors">
              <button
                v-for="color in colors"
                :key="color"
                type="button"
                class="h-9 w-9 rounded-full border transition focus:outline-none focus:ring-2 focus:ring-[#b88a44]"
                :class="selectedColor === color ? 'border-[#244f2f] ring-2 ring-[#244f2f]' : 'border-[#cdb895]'"
                :style="{ backgroundColor: color }"
                :aria-label="`Use color ${color}`"
                @click="selectedColor = color"
              />
            </div>

            <label class="ml-auto flex min-w-40 items-center gap-2 text-sm font-medium text-[#5b4937]">
              Size
              <input
                v-model.number="brushSize"
                type="range"
                min="3"
                max="24"
                class="w-28 accent-[#244f2f]"
              />
            </label>
          </div>
        </div>
      </div>

      <div v-if="viewer && !hasUnread" class="flex gap-3 border-t border-[#e2cfb5] p-4 sm:p-5">
        <button
          type="button"
          class="flex-1 rounded-2xl border border-[#d8c3a6] px-4 py-3 font-medium text-[#4d3725] transition hover:bg-[#efe1cc] focus:outline-none focus:ring-2 focus:ring-[#b88a44]"
          @click="clearCanvas"
        >
          Clear
        </button>
        <button
          type="button"
          class="flex-1 rounded-2xl bg-[#244f2f] px-4 py-3 font-semibold text-white transition hover:bg-[#1f4328] focus:outline-none focus:ring-2 focus:ring-[#d5b376] disabled:opacity-55"
          :disabled="!hasDrawn || isSaving"
          @click="submitPainting"
        >
          {{ isSaving ? 'Sending...' : 'Submit' }}
        </button>
      </div>
    </section>
  </div>
</template>
