<script setup lang="ts">
import { definePageMeta } from '#imports';
import { useAddConcertSheetStore } from '@/stores/add-concert-sheet';

definePageMeta({
  middleware: 'auth'
});

const addSheet = useAddConcertSheetStore();
</script>

<template>
  <UContainer class="py-8 max-w-lg space-y-4">
    <h1 class="text-[34px] font-bold tracking-tight leading-tight">
      Home
    </h1>

    <section class="rounded-2xl bg-[#1A1A1A] p-4 space-y-3">
      <p class="text-lg font-semibold">
        Nothing upcoming.
      </p>
      <p class="text-muted">
        Add a night or a concert.
      </p>
      <UButton
        label="Add concert"
        color="primary"
        variant="outline"
        class="h-11 rounded-full ring-2"
        @click="addSheet.openSheet()"
      />
    </section>

    <section class="rounded-2xl bg-[#1A1A1A] p-4 flex">
      <div class="flex-1">
        <p class="text-2xl font-bold tracking-tight">
          0
        </p>
        <p class="mt-1 text-sm text-muted">
          Attended
        </p>
      </div>
      <div class="flex-1">
        <p class="text-2xl font-bold tracking-tight">
          0
        </p>
        <p class="mt-1 text-sm text-muted">
          Events
        </p>
      </div>
      <div class="flex-1">
        <p class="text-2xl font-bold tracking-tight">
          0
        </p>
        <p class="mt-1 text-sm text-muted">
          Going
        </p>
      </div>
    </section>
  </UContainer>
</template>
