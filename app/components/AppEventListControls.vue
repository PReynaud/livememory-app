<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { CONCERT_LIST_COPY } from '@/utils/concert-list-copy';
import type { FilterChip, ListTab } from '@/utils/concert-list-filters';

const props = defineProps<{
  tab: ListTab;
  upcomingCount: number;
  pastCount: number;
  filterCount: number;
  chips: FilterChip[];
  hint: string;
}>();

const emit = defineEmits<{
  'update:tab': [ListTab];
  'openFilter': [];
  'removeFilter': [string];
  'clearFilters': [];
}>();

const upcomingTab = ref<HTMLButtonElement | null>(null);
const pastTab = ref<HTMLButtonElement | null>(null);
const skipFocus = ref(true);

watch(() => props.tab, (next) => {
  if (skipFocus.value) {
    skipFocus.value = false;
    return;
  }

  void nextTick(() => {
    (next === 'past' ? pastTab : upcomingTab).value?.focus();
  });
});

const onTabKeydown = (event: KeyboardEvent, current: ListTab) => {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
    return;
  }

  event.preventDefault();
  emit('update:tab', current === 'upcoming' ? 'past' : 'upcoming');
};
</script>

<template>
  <div class="space-y-3">
    <div
      class="lm-list-tabs"
      role="tablist"
      aria-label="Concert period"
      data-testid="concert-list-tabs"
    >
      <button
        id="concert-tab-upcoming"
        ref="upcomingTab"
        type="button"
        class="lm-list-tab"
        role="tab"
        aria-controls="concert-list-panel"
        :aria-selected="tab === 'upcoming'"
        :tabindex="tab === 'upcoming' ? 0 : -1"
        @click="emit('update:tab', 'upcoming')"
        @keydown="onTabKeydown($event, 'upcoming')"
      >
        {{ CONCERT_LIST_COPY.upcomingTab }}
        <span class="lm-list-tab-count">{{ upcomingCount }}</span>
      </button>
      <button
        id="concert-tab-past"
        ref="pastTab"
        type="button"
        class="lm-list-tab"
        role="tab"
        aria-controls="concert-list-panel"
        :aria-selected="tab === 'past'"
        :tabindex="tab === 'past' ? 0 : -1"
        @click="emit('update:tab', 'past')"
        @keydown="onTabKeydown($event, 'past')"
      >
        {{ CONCERT_LIST_COPY.pastTab }}
        <span class="lm-list-tab-count">{{ pastCount }}</span>
      </button>
    </div>

    <div class="lm-filter-bar">
      <button
        type="button"
        class="lm-btn-filter"
        data-testid="concert-filter-open"
        @click="emit('openFilter')"
      >
        <UIcon
          name="i-lucide-list-filter"
          class="size-4 text-muted"
          aria-hidden="true"
        />
        {{ CONCERT_LIST_COPY.filter }}
        <span
          v-if="filterCount > 0"
          class="lm-filter-badge"
        >{{ filterCount }}</span>
      </button>

      <div
        v-if="chips.length"
        class="flex min-w-0 flex-1 flex-wrap items-center gap-2"
      >
        <button
          v-for="chip in chips"
          :key="chip.id"
          type="button"
          class="lm-filter-chip"
          :aria-label="CONCERT_LIST_COPY.removeFilter(chip.label)"
          @click="emit('removeFilter', chip.id)"
        >
          {{ chip.label }}
          <UIcon
            name="i-lucide-x"
            class="size-3.5"
          />
        </button>
        <button
          v-if="filterCount >= 2"
          type="button"
          class="min-h-11 px-2 text-[13px] font-semibold text-muted underline underline-offset-4"
          @click="emit('clearFilters')"
        >
          {{ CONCERT_LIST_COPY.clearAll }}
        </button>
      </div>
      <p
        v-else
        class="text-[13px] text-muted"
      >
        {{ hint }}
      </p>
    </div>
  </div>
</template>
