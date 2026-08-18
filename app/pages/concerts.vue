<script setup lang="ts">
import { definePageMeta } from '#imports';

definePageMeta({
  middleware: 'auth'
});
</script>

<template>
  <UContainer class="py-8 max-w-lg space-y-4">
    <h1 class="text-[34px] font-bold tracking-tight leading-tight">
      Concerts
    </h1>

    <section class="rounded-2xl bg-[#1A1A1A] p-4 space-y-3">
      <p class="text-lg font-semibold">
        No shows yet.
      </p>
      <UButton
        label="Add concert"
        color="primary"
        variant="outline"
        class="h-11 rounded-full ring-2"
      />
    </section>
  </UContainer>
</template>
