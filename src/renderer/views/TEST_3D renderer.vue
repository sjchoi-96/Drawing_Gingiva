<script setup lang="ts">
  import Drawing_Gingiva from '../layouts/Drawing_Gingiva.vue'
</script>

<template>
  <v-container fluid class="guide-container">
    <v-row class="mpr-container">
      <Drawing_Gingiva />
    </v-row>
  </v-container>
</template>

<style scoped>
  .guide-container {
    height: calc(100vh - 100px);
    padding: 16px;
    display: flex;
    flex-direction: column;
  }

  .mpr-container {
    height: calc(30vh - 26px);
    margin: 0;
  }
</style>

