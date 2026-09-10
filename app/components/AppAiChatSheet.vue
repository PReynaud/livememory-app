<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useAgentChatStore } from '@/stores/agent-chat';
import { useEventsStore } from '@/stores/events';

const chat = useAgentChatStore();
const events = useEventsStore();
const { open, loading, error, messages, pendingPreview } = storeToRefs(chat);
const prompt = ref('');
const files = ref<File[]>([]);
const imageError = ref('');
const sheetOpen = computed({
  get: () => open.value,
  set: (value) => {
    open.value = value;
    if (!value) chat.cancelPreview();
  }
});

const allowed = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const selectImages = (event: Event) => {
  const chosen = Array.from((event.target as HTMLInputElement).files ?? []);
  const total = chosen.reduce((sum, file) => sum + file.size, 0);
  if (chosen.length > 5 || chosen.some(file => !allowed.has(file.type) || file.size > 15 * 1024 * 1024) || total > 50 * 1024 * 1024) {
    files.value = [];
    imageError.value = 'Use up to five PNG, JPEG, GIF, or WebP images, 15 MB each and 50 MB total.';
    return;
  }
  files.value = chosen;
  imageError.value = '';
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
  if (!prompt.value.trim() || loading.value) return;
  const result = await chat.send(prompt.value, await imagePayload());
  if (!result.error) {
    prompt.value = '';
    files.value = [];
  }
};
const confirm = async () => {
  const result = await chat.confirm();
  if (!result.error) await events.fetchEvents({ silent: true });
};
</script>

<template>
  <USlideover
    v-model:open="sheetOpen"
    side="bottom"
    title="Assistant"
    :close="false"
  >
    <template #body>
      <div class="space-y-4">
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
          class="rounded-xl p-3"
          :class="message.role === 'user' ? 'bg-primary text-black' : 'bg-elevated'"
        >
          {{ message.text }}
        </div>
        <form
          class="space-y-3"
          @submit.prevent="send"
        >
          <UTextarea
            v-model="prompt"
            label="Message"
            placeholder="Ask about a concert…"
            :disabled="loading"
          />
          <input
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            type="file"
            data-testid="agent-chat-images"
            :disabled="loading"
            @change="selectImages"
          >
          <p
            v-if="files.length"
            class="text-sm text-muted"
          >
            {{ files.length }} image(s) attached for this turn only.
          </p>
          <UAlert
            v-if="imageError"
            color="error"
            variant="subtle"
            :title="imageError"
            data-testid="agent-chat-image-error"
          />
          <UButton
            type="submit"
            label="Ask assistant"
            :loading="loading"
            :disabled="!prompt.trim() || loading"
            data-testid="agent-chat-send"
          />
        </form>
        <div
          v-if="pendingPreview"
          class="flex gap-3"
        >
          <UButton
            label="Confirm changes"
            :loading="loading"
            data-testid="agent-chat-confirm"
            @click="confirm"
          />
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            :disabled="loading"
            data-testid="agent-chat-cancel"
            @click="chat.cancelPreview()"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
