<script setup lang="ts">
import { computed } from 'vue';
import { CONCERT_LIST_COPY } from '@/utils/concert-list-copy';
import type { ConcertListFilterState, FilterSection, ListTab } from '@/utils/concert-list-filters';

const props = defineProps<{
  open: boolean;
  tab: ListTab;
  draft: ConcertListFilterState;
  catalog: FilterSection[];
  draftCount: number;
}>();

const emit = defineEmits<{
  'update:open': [boolean];
  'update:draft': [ConcertListFilterState];
  'apply': [];
  'reset': [];
}>();

const sheetOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
});

const eyebrow = computed(() => {
  return props.tab === 'past' ? CONCERT_LIST_COPY.pastTab : CONCERT_LIST_COPY.upcomingTab;
});

const slideoverUi = {
  overlay: 'bg-elevated/0',
  content: 'lm-chrome lm-sheet-shell bg-default/50 backdrop-blur-[24px] divide-y-0 ring-0 shadow-none rounded-t-3xl inset-x-3 mx-auto max-w-[calc(var(--max-w)-24px)] bottom-[4.75rem] lg:bottom-8 lg:inset-x-auto lg:left-[calc(50%-14rem)] lg:mx-0 lg:max-w-none lg:w-[28rem] max-h-[min(85dvh,36rem)]',
  header: 'lm-sheet-head relative flex-col items-stretch gap-0 px-4 pt-6 pb-0 sm:px-4 min-h-0',
  body: 'min-h-0 overflow-y-auto px-4 py-3 sm:px-4 sm:py-3',
  footer: 'lm-sheet-foot px-4 pb-4 sm:px-4',
  wrapper: 'flex min-h-0 flex-col',
  title: 'text-lg font-bold tracking-tight order-2 pb-3',
  description: 'sheet-eyebrow order-1'
};

const toggleId = (id: string) => {
  const ids = props.draft.ids.includes(id)
    ? props.draft.ids.filter(item => item !== id)
    : [...props.draft.ids, id];

  emit('update:draft', { ...props.draft, ids });
};

const setArtistQuery = (value: string) => {
  emit('update:draft', { ...props.draft, artistQuery: value });
};

const onArtistKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    emit('apply');
  }
};
</script>

<template>
  <USlideover
    v-model:open="sheetOpen"
    side="bottom"
    :title="CONCERT_LIST_COPY.filter"
    :description="eyebrow"
    :close="false"
    :ui="slideoverUi"
  >
    <template #body>
      <div class="space-y-2.5">
        <section
          v-for="section in catalog"
          :key="section.id"
          class="lm-form-panel space-y-2.5"
        >
          <p class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            {{ section.label }}
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="option in section.options"
              :key="option.id"
              type="button"
              class="lm-option-chip"
              :aria-pressed="draft.ids.includes(option.id)"
              @click="toggleId(option.id)"
            >
              {{ option.label }}
            </button>
          </div>
        </section>

        <section class="lm-form-panel lm-form-panel-artist space-y-2.5">
          <p class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            {{ CONCERT_LIST_COPY.artist }}
          </p>
          <UInput
            :model-value="draft.artistQuery"
            :placeholder="CONCERT_LIST_COPY.artistPlaceholder"
            class="h-11 w-full"
            @update:model-value="setArtistQuery(String($event ?? ''))"
            @keydown="onArtistKeydown"
          />
        </section>
      </div>
    </template>
    <template #footer>
      <p class="text-[13px] text-muted">
        {{ CONCERT_LIST_COPY.criteriaSelected(draftCount) }}
      </p>
      <div class="flex items-center gap-4">
        <UButton
          type="button"
          :label="CONCERT_LIST_COPY.reset"
          color="neutral"
          variant="link"
          class="px-0 font-semibold text-muted"
          @click="emit('reset')"
        />
        <UButton
          type="button"
          :label="CONCERT_LIST_COPY.apply"
          color="primary"
          variant="outline"
          class="h-11 flex-1 justify-center rounded-full ring-2"
          @click="emit('apply')"
        />
      </div>
    </template>
  </USlideover>
</template>
