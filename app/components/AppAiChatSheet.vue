<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useAgentChatStore } from '@/stores/agent-chat';
import { useEventsStore } from '@/stores/events';
import {
  ASSISTANT_ADDING,
  ASSISTANT_WORKING,
  askDisabled,
  attendanceChipLabel,
  composerBusy,
  proposalCardMeta,
  visibleTranscriptText
} from '#shared/agent-chat-transcript';

const chat = useAgentChatStore();
const events = useEventsStore();
const { open, turnLoading, confirming, error, messages, pendingProposalId } = storeToRefs(chat);
const prompt = ref('');
const files = ref<File[]>([]);
const imageError = ref('');
const imageInput = ref<HTMLInputElement | null>(null);
const hasTranscript = computed(() => Boolean(error.value) || messages.value.length > 0 || turnLoading.value);

const allowed = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const resetImageInput = () => {
  if (imageInput.value) imageInput.value.value = '';
};
const selectImages = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const chosen = Array.from(input.files ?? []);
  const total = chosen.reduce((sum, file) => sum + file.size, 0);
  if (chosen.length > 5 || chosen.some(file => !allowed.has(file.type) || file.size > 15 * 1024 * 1024) || total > 50 * 1024 * 1024) {
    files.value = [];
    imageError.value = 'Use up to five PNG, JPEG, GIF, or WebP images, 15 MB each and 50 MB total.';
    input.value = '';
    return;
  }
  files.value = chosen;
  imageError.value = '';
};
const removeImage = (index: number) => {
  files.value = files.value.filter((_, fileIndex) => fileIndex !== index);
  resetImageInput();
};
const imagePayload = async () => Promise.all(files.value.map(async file => ({
  data: (await file.arrayBuffer() && await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })),
  mimeType: file.type
})));
const send = async () => {
  if (askDisabled(prompt.value, turnLoading.value, confirming.value, !!pendingProposalId.value)) return;
  const result = await chat.send(prompt.value, await imagePayload());
  if (!result.error) {
    prompt.value = '';
    files.value = [];
    resetImageInput();
  }
};
const onPromptKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' || event.shiftKey) return;
  event.preventDefault();
  void send();
};
const confirm = async () => {
  const result = await chat.confirm();
  if (!result.error) await events.fetchEvents({ silent: true });
};

const closeControl = {
  'color': 'neutral',
  'variant': 'ghost',
  'aria-label': 'Close assistant'
} as const;
const slideoverUi = {
  overlay: 'bg-elevated/0',
  content: 'lm-chrome lm-sheet-shell lm-assistant-sheet bg-default/50 backdrop-blur-[24px] divide-y-0 ring-0 shadow-none rounded-t-3xl',
  header: 'lm-sheet-head relative flex-col items-stretch gap-0 px-4 pt-6 pb-0 sm:px-4 min-h-0',
  body: 'min-h-0 flex-1 overflow-y-auto px-4 py-0 sm:px-4',
  footer: 'lm-sheet-foot px-4 pt-3 pb-4 sm:px-4',
  wrapper: 'flex min-h-0 flex-col',
  title: 'text-lg font-bold tracking-tight pb-3',
  close: 'absolute top-7 end-3'
};
</script>

<template>
  <USlideover
    v-model:open="open"
    side="bottom"
    title="Assistant"
    :close="closeControl"
    :ui="slideoverUi"
  >
    <template #body>
      <div
        v-if="hasTranscript"
        class="space-y-3 py-3"
      >
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
          data-testid="agent-chat-error"
        />
        <div
          v-for="(message, index) in messages"
          :key="index"
          class="max-w-[85%] rounded-2xl px-3 py-2 text-[15px] leading-snug"
          :class="message.role === 'user' ? 'ms-auto bg-primary text-black' : 'bg-[var(--well)] text-[var(--fg)] ring-1 ring-[var(--well-border)]'"
        >
          <p v-if="visibleTranscriptText(message.text)">
            {{ visibleTranscriptText(message.text) }}
          </p>
          <div
            v-if="message.card"
            class="mt-3 space-y-2"
            data-testid="agent-chat-card"
          >
            <p
              v-if="visibleTranscriptText(message.card.artist)"
              class="text-lg font-semibold"
            >
              {{ visibleTranscriptText(message.card.artist) }}
            </p>
            <p v-if="visibleTranscriptText(proposalCardMeta(message.card))">
              {{ visibleTranscriptText(proposalCardMeta(message.card)) }}
            </p>
            <span
              class="inline-flex h-6 items-center rounded-full border px-2 text-[10px] font-semibold leading-none"
              :class="message.card.attendance === 'going' ? 'border-[#FF4D8A] text-[#FF4D8A]' : 'border-[#A3A3A3] text-[#A3A3A3]'"
            >
              {{ attendanceChipLabel(message.card.attendance) }}
            </span>
            <p
              v-if="visibleTranscriptText(message.card.note)"
              class="text-sm text-muted"
            >
              {{ visibleTranscriptText(message.card.note) }}
            </p>
          </div>
          <div
            v-if="message.status === 'pending'"
            class="mt-3 space-y-3"
          >
            <p
              v-if="confirming"
              data-testid="agent-chat-adding"
            >
              {{ ASSISTANT_ADDING }}
            </p>
            <div class="flex gap-3">
              <UButton
                :label="message.card ? 'Add concert' : 'Save'"
                :loading="confirming"
                :disabled="confirming"
                data-testid="agent-chat-confirm"
                @click="confirm"
              />
              <UButton
                label="Don't add"
                color="neutral"
                variant="outline"
                :disabled="confirming"
                data-testid="agent-chat-cancel"
                @click="chat.cancelPreview()"
              />
            </div>
          </div>
        </div>
        <p
          v-if="turnLoading"
          aria-live="polite"
          data-testid="agent-chat-working"
        >
          {{ ASSISTANT_WORKING }}
        </p>
      </div>
    </template>
    <template #footer>
      <form
        class="flex w-full flex-col gap-2"
        @submit.prevent="send"
      >
        <UAlert
          v-if="imageError"
          color="error"
          variant="subtle"
          :title="imageError"
          data-testid="agent-chat-image-error"
        />
        <div
          v-if="files.length"
          class="flex flex-col gap-2"
        >
          <p class="text-xs text-muted">
            Attached for this turn only.
          </p>
          <ul class="flex flex-wrap gap-2">
            <li
              v-for="(file, index) in files"
              :key="`${file.name}-${index}`"
              class="lm-assistant-chip"
            >
              <span class="truncate">{{ file.name }}</span>
              <button
                type="button"
                class="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted hover:text-[var(--fg)]"
                :aria-label="`Remove ${file.name}`"
                :disabled="composerBusy(turnLoading, confirming, !!pendingProposalId)"
                @click="removeImage(index)"
              >
                <UIcon
                  name="i-lucide-x"
                  class="size-3.5"
                />
              </button>
            </li>
          </ul>
        </div>
        <div class="lm-assistant-composer">
          <UTextarea
            v-model="prompt"
            aria-label="Message"
            placeholder="Ask about a concert…"
            variant="none"
            :rows="1"
            :maxrows="4"
            autoresize
            :disabled="composerBusy(turnLoading, confirming, !!pendingProposalId)"
            class="min-w-48 flex-1"
            :ui="{ base: 'bg-transparent px-0 py-1.5 text-[15px] ring-0 shadow-none placeholder:text-muted focus-visible:ring-0' }"
            @keydown="onPromptKeydown"
          />
          <div class="flex shrink-0 items-center gap-1">
            <UButton
              type="button"
              icon="i-lucide-image-plus"
              color="neutral"
              variant="ghost"
              aria-label="Attach images"
              :disabled="composerBusy(turnLoading, confirming, !!pendingProposalId)"
              @click="imageInput?.click()"
            />
            <input
              ref="imageInput"
              class="sr-only"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              type="file"
              tabindex="-1"
              aria-hidden="true"
              data-testid="agent-chat-images"
              :disabled="composerBusy(turnLoading, confirming, !!pendingProposalId)"
              @change="selectImages"
            >
            <UButton
              type="submit"
              label="Ask assistant"
              :loading="turnLoading"
              :disabled="askDisabled(prompt, turnLoading, confirming, !!pendingProposalId)"
              data-testid="agent-chat-send"
            />
          </div>
        </div>
      </form>
    </template>
  </USlideover>
</template>
