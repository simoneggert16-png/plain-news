<script setup>
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { t } from '../../../i18n/index.js';
import UiButton from '../../kit/UiButton.vue';
import RailPanel from '../../rail/RailPanel.vue';
import CctvCalValue from '../../cctv/CctvCalValue.vue';
import CctvPicker from '../../cctv/CctvPicker.vue';
import { useCctvStore } from '../../stores/cctv.js';
import UiBadge from '../../kit/UiBadge.vue';

// The CCTV panel, rendered from what CctvControls presents and publishes;
// until it renders, the panel shows its initial markup. The controls draw
// the live video into its canvas.
const { view, frame, live, sourceBadge, summary } = storeToRefs(useCctvStore());
// The frame's request state, as data attributes that read "true" or are
// empty; none until the controls first publish.
const flag = (on) => (on ? 'true' : '');
const frameData = computed(() =>
  frame.value
    ? {
        'data-camera-id': frame.value.cameraId,
        'data-current-src': frame.value.currentSrc,
        'data-loading': flag(frame.value.loading),
        'data-error': flag(frame.value.error),
      }
    : {},
);

const isFullscreen = ref(false);

function syncPanelFullscreenClass(active) {
  if (typeof document === 'undefined') return;
  const panelEl = document.getElementById('cctv-panel');
  if (panelEl) panelEl.classList.toggle('cctv-fullscreen-mode', active);
}

function toggleFullscreen() {
  const next = !isFullscreen.value;
  isFullscreen.value = next;
  syncPanelFullscreenClass(next);
  if (typeof document === 'undefined') return;
  const wrap = document.getElementById('cctv-frame-wrap');
  if (next) {
    if (wrap && typeof wrap.requestFullscreen === 'function' && !document.fullscreenElement) {
      wrap.requestFullscreen().catch(() => {});
    }
  } else if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
    document.exitFullscreen().catch(() => {});
  }
}

function exitFullscreen() {
  if (!isFullscreen.value) return;
  isFullscreen.value = false;
  syncPanelFullscreenClass(false);
  if (typeof document !== 'undefined' && document.fullscreenElement && typeof document.exitFullscreen === 'function') {
    document.exitFullscreen().catch(() => {});
  }
}

function triggerPanelButton(id) {
  if (typeof document === 'undefined') return;
  document.getElementById(id)?.click();
}

function onFullscreenChange() {
  if (typeof document === 'undefined') return;
  const wrap = document.getElementById('cctv-frame-wrap');
  if (!document.fullscreenElement && isFullscreen.value && wrap) {
    isFullscreen.value = false;
    syncPanelFullscreenClass(false);
  } else if (document.fullscreenElement === wrap && !isFullscreen.value) {
    isFullscreen.value = true;
    syncPanelFullscreenClass(true);
  }
}

function onKeydown(event) {
  if (event.key === 'Escape' && isFullscreen.value) {
    event.stopPropagation();
    exitFullscreen();
  }
}

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('keydown', onKeydown);
  }
});

onBeforeUnmount(() => {
  syncPanelFullscreenClass(false);
  if (typeof document !== 'undefined') {
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('keydown', onKeydown);
  }
});
</script>

<template>
<RailPanel id="cctv-panel" start-collapsed :title="t('CCTV')" sideways scroll rail-scroller>
    <div class="cyber-panel-body ui-scroll" data-rail-scroller>
    <div id="cctv-frame-wrap" :class="['cctv-frame-wrap', { loading: frame?.wrapLoading, 'has-frame': frame?.hasFrame, 'is-fullscreen': isFullscreen }]" @dblclick="toggleFullscreen">
      <span class="cctv-frame-caption" aria-hidden="true">{{ t('ACQUIRING FRAME') }}</span>
      <img id="cctv-frame" alt="CCTV feed frame" :class="{ active: frame?.hasFrame }" :src="frame?.src || undefined" :hidden="live" v-bind="frameData" />
      <canvas id="cctv-video" class="cctv-frame" :hidden="!live"></canvas>
      <button
        id="cctv-fullscreen-btn"
        type="button"
        class="cctv-fullscreen-btn"
        :aria-pressed="isFullscreen ? 'true' : 'false'"
        :title="isFullscreen ? 'ESC' : 'Fullscreen'"
        @click.stop="toggleFullscreen"
      >
        <span aria-hidden="true">{{ isFullscreen ? '✕ ESC' : '⛶' }}</span>
      </button>
      <div v-if="isFullscreen" class="cctv-fs-hud-top" @click.stop>
        <span class="cctv-fs-meta">{{ view?.meta ?? '' }}</span>
        <span v-if="view?.age?.text" class="cctv-fs-age">{{ view.age.text }}</span>
      </div>
      <div v-if="isFullscreen" class="cctv-fs-hud-bottom" @click.stop>
        <button type="button" class="cctv-fs-action-btn" :disabled="view?.navDisabled" @click="triggerPanelButton('cctv-prev-btn')">◀ {{ t('PREV') }}</button>
        <button type="button" class="cctv-fs-action-btn" :disabled="view?.refreshDisabled" @click="triggerPanelButton('cctv-refresh-btn')">↻ {{ t('REFRESH FRAME') }}</button>
        <button type="button" class="cctv-fs-action-btn" :disabled="view?.navDisabled" @click="triggerPanelButton('cctv-next-btn')">{{ t('NEXT') }} ▶</button>
        <button type="button" class="cctv-fs-action-btn cctv-fs-close-btn" @click="exitFullscreen">✕ ESC</button>
      </div>
    </div>
    <UiBadge id="cctv-source-badge" role="status" aria-live="polite" :data-frame-state="sourceBadge?.state">{{ sourceBadge?.label ?? t('SOURCE · UNKNOWN') }}</UiBadge>
    <UiBadge id="cctv-age-badge" role="status" aria-live="polite" :data-age-tone="view?.age?.tone">{{ view?.age?.text ?? '' }}</UiBadge>
    <div id="cctv-meta">{{ view?.meta ?? t('Enable CCTV to load camera intersections') }}</div>
    <div class="cctv-controls">
      <UiButton class="scene-btn" :pressed="Boolean(view?.enabled)" pressed-class="active" id="cctv-enable-btn">{{ view?.enabled ? t('CCTV ON') : t('CCTV OFF') }}</UiButton>
      <UiButton id="cctv-nearest-btn" type="button" class="gev-action-button scene-btn" :disabled="view?.navDisabled">{{ t('NEAREST') }}</UiButton>
    </div>
    <div class="cctv-controls">
      <UiButton id="cctv-prev-btn" type="button" class="gev-action-button scene-btn" :disabled="view?.navDisabled">{{ t('PREV') }}</UiButton>
      <CctvPicker class="gev-field" id="cctv-camera-select" :aria-label="t('CCTV camera')" />
      <UiButton id="cctv-next-btn" type="button" class="gev-action-button scene-btn" :disabled="view?.navDisabled">{{ t('NEXT') }}</UiButton>
    </div>
    <div class="cctv-controls">
      <UiButton id="cctv-focus-btn" type="button" class="gev-action-button scene-btn" :disabled="view?.focusDisabled">{{ t('FOCUS') }}</UiButton>
      <UiButton id="cctv-refresh-btn" type="button" class="gev-action-button scene-btn" :disabled="view?.refreshDisabled" :title="t('Pull a newer picture from this camera now')">{{ t('REFRESH FRAME') }}</UiButton>
      <UiButton class="scene-btn" :pressed="Boolean(view?.coverage.active)" pressed-class="active" id="cctv-coverage-btn" :disabled="view?.toggleDisabled">{{ view?.coverage.text ?? t('COVERAGE OFF') }}</UiButton>
      <UiButton class="scene-btn" :pressed="Boolean(view?.autoHop.active)" pressed-class="active" id="cctv-auto-hop-btn" :disabled="view?.toggleDisabled">{{ view?.autoHop.text ?? t('AUTO HOP OFF') }}</UiButton>
    </div>
    <div class="cctv-controls">
      <UiButton class="scene-btn" :pressed="Boolean(view?.projection.active)" pressed-class="active" id="cctv-projection-btn" :disabled="view?.toggleDisabled">{{ view?.projection.text ?? t('PROJECTION ON') }}</UiButton>
      <UiBadge id="cctv-quality-chip" class="gev-status-badge--box" :data-cal-badge="view?.quality.calBadge">{{ view?.quality.label ?? t('CAL · {badge}', { badge: '--' }) }}</UiBadge>
    </div>
    <div class="cctv-calibration-block">
      <div class="cctv-calibration-header">
        <div class="cctv-summary-label">{{ t('CALIBRATION') }}</div>
        <UiButton class="scene-btn" :pressed="Boolean(view?.calibration.adjust.active)" pressed-class="active" id="cctv-adjust-btn" :title="t('Drag the camera in the world: rings rotate, arrows move, handles set range/FOV')" :disabled="view?.calibration.disabled">{{ view?.calibration.adjust.text ?? t('ADJUST') }}</UiButton>
      </div>
      <div id="cctv-cal-readout" class="cctv-cal-readout" :aria-label="t('Camera pose — click a value to type')">
        <CctvCalValue field="heading" label="HDG" :title="t('Heading (compass °) — click to type')" />
        <CctvCalValue field="pitch" label="PITCH" :title="t('Pitch (° up/down) — click to type')" />
        <CctvCalValue field="fov" label="FOV" :title="t('Horizontal FOV (°) — click to type')" />
        <CctvCalValue field="range" label="RANGE" :title="t('Range / monitor-plane distance (m) — click to type')" />
        <CctvCalValue field="height" label="HGT" :title="t('Mount height above ground (m) — click to type')" />
        <CctvCalValue field="north" label="ΔN" :title="t('North offset from catalog position (m) — click to type')" />
        <CctvCalValue field="east" label="ΔE" :title="t('East offset from catalog position (m) — click to type')" />
      </div>
      <div class="cctv-controls cctv-calibration-actions">
        <UiButton id="cctv-calib-save-btn" type="button" class="gev-action-button scene-btn" :disabled="view?.calibration.disabled">{{ t('SAVE CAL') }}</UiButton>
        <UiButton id="cctv-calib-reset-btn" type="button" class="gev-action-button scene-btn" :disabled="view?.calibration.disabled">{{ t('RESET CAL') }}</UiButton>
      </div>
    </div>
    <div class="cctv-summary-label">{{ t('SCENE SUMMARY') }}</div>
    <div id="cctv-summary">{{ summary ?? t('Enable CCTV to start camera-linked intelligence summaries.') }}</div>
    </div>
</RailPanel>
</template>
