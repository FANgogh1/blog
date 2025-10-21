<script setup>
import { ref } from 'vue';
const posts = ref([
  { id: 1, title: '用 Vue 3 构建扁平化博客 UI', excerpt: '快速搭建简洁美观的前端页面与路由...', tags: ['Vue','UI','前端'] },
  { id: 2, title: '前端性能优化 10 条实用建议', excerpt: '从资源、交互与渲染三个维度入手...', tags: ['性能','优化'] },
  { id: 3, title: 'CSS 扁平化设计指南', excerpt: '一致的阴影、圆角与色彩层级...', tags: ['CSS','设计'] },
]);
</script>

<template>
  <div class="grid cols-3">
    <article v-for="p in posts" :key="p.id" class="card" style="padding:16px;">
      <h3 style="margin:0 0 8px;">{{ p.title }}</h3>
      <p style="color:var(--muted); margin:0 0 12px;">{{ p.excerpt }}</p>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
        <span v-for="t in p.tags" :key="t" class="btn ghost" style="pointer-events:none;">#{{ t }}</span>
      </div>
      <router-link class="btn primary" :to="{ name: 'post', params: { id: p.id } }">阅读详情</router-link>
    </article>
  </div>
</template>

<style scoped>
</style>