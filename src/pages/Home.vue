<script setup>
import { ref, onMounted } from 'vue';
import { QuillEditor } from '@vueup/vue-quill';
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import MarkdownIt from 'markdown-it';
const md = new MarkdownIt();
import { supabase } from '../lib/supabase';

const stripHtml = (html) => {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
};

const loading = ref(true);
const posts = ref([]);

const sample = [
  { id: 'sample-1', title: '用 Vue 3 构建扁平化博客 UI', content: '快速搭建简洁美观的前端页面与路由...' },
  { id: 'sample-2', title: '前端性能优化 10 条实用建议', content: '从资源、交互与渲染三个维度入手...' },
  { id: 'sample-3', title: 'CSS 扁平化设计指南', content: '一致的阴影、圆角与色彩层级...' },
];

const fetchPosts = async () => {
  loading.value = true;
  const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
  loading.value = false;
  posts.value = error ? [] : (data || []);
  if (!posts.value?.length) posts.value = sample;
};

onMounted(fetchPosts);

// 首页轮播图（从 Supabase Storage:banners/home 读取）
const banners = ref([]);
const curBanner = ref(0);
let bannerTimer = null;
const nextBanner = () => { if (banners.value.length) curBanner.value = (curBanner.value + 1) % banners.value.length; };
const prevBanner = () => { if (banners.value.length) curBanner.value = (curBanner.value - 1 + banners.value.length) % banners.value.length; };
const fetchBanners = async () => {
  try {
    const { data, error } = await supabase.storage.from('banners').list('home', { limit: 50, sortBy: { column: 'name', order: 'asc' } });
    if (error) return;
    const urls = (data || [])
      .filter(f => f && f.name && !String(f.name).startsWith('.'))
      .map(f => {
        const path = String(f.name).includes('/') ? f.name : `home/${f.name}`;
        return supabase.storage.from('banners').getPublicUrl(path).data?.publicUrl;
      })
      .filter(Boolean);
    banners.value = urls;
    if (bannerTimer) { clearInterval(bannerTimer); bannerTimer = null; }
    if (banners.value.length > 1) bannerTimer = setInterval(nextBanner, 5000);
  } catch {}
};
onMounted(fetchBanners);

/* 创建文章表单 */
const showCreate = ref(false);
const form = ref({ title: '', content: '' });
const saving = ref(false);
const errorMsg = ref('');

const createPost = async () => {
  errorMsg.value = '';
  if (!form.value.title.trim() || !form.value.content.trim()) {
    errorMsg.value = '标题与内容不能为空';
    return;
  }
  saving.value = true;

  // 必须登录：RLS 要求 author 等于当前用户
  const { data: userRes } = await supabase.auth.getUser();
  const author = userRes?.user?.id || userRes?.data?.user?.id || null;
  if (!author) {
    saving.value = false;
    errorMsg.value = '请先登录后再创建文章';
    return;
  }

  const meta = userRes?.user?.user_metadata || userRes?.data?.user?.user_metadata || {};
  const author_name = meta.nickname?.trim() || userRes?.user?.email || userRes?.data?.user?.email || '匿名';
  const author_avatar = meta.avatar_url || '';

  const { error } = await supabase
    .from('posts')
    .insert([{ title: form.value.title.trim(), content: form.value.content, author, author_name, author_avatar }]);

  saving.value = false;
  if (error) {
    errorMsg.value = error.message || '创建失败';
    return;
  }
  showCreate.value = false;
  form.value = { title: '', content: '' };
  await fetchPosts();
};
</script>

<template>
  <!-- 首页轮播图（Storage） -->
  <div v-if="banners.length" class="card" style="margin-bottom:16px; padding:0; overflow:hidden; position:relative; height:280px;">
    <img :src="banners[curBanner]" alt="banner" style="width:100%; height:100%; object-fit:cover; display:block;" />
    <button class="btn" @click="prevBanner" style="position:absolute; left:12px; top:50%; transform:translateY(-50%);">‹</button>
    <button class="btn" @click="nextBanner" style="position:absolute; right:12px; top:50%; transform:translateY(-50%);">›</button>
    <div style="position:absolute; left:0; right:0; bottom:10px; display:flex; justify-content:center; gap:6px;">
      <span v-for="(b, i) in banners" :key="i" :style="{ width: '8px', height: '8px', borderRadius: '50%', background: i===curBanner ? 'var(--primary)' : 'var(--border)' }"></span>
    </div>
  </div>

  <div class="grid cols-3">
    <article v-for="p in posts" :key="p.id" class="card" style="padding:16px;">
      <h3 style="margin:0 0 8px;">{{ p.title }}</h3>
      <div style="display:flex; align-items:center; gap:10px; color:var(--muted); margin-bottom:10px;">
        <img v-if="p.author_avatar" :src="p.author_avatar" alt="avatar" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border:1px solid var(--border);" />
        <div v-else style="width:24px; height:24px; border-radius:50%; background:#163229; display:flex; align-items:center; justify-content:center; font-size:12px; color:var(--primary); font-weight:700;">
          {{ (p.author_name || '匿名').slice(0,1).toUpperCase() }}
        </div>
        <span>{{ p.author_name || '匿名' }}</span>
        <span style="margin-left:auto; font-size:12px;">{{ p.created_at ? new Date(p.created_at).toLocaleString() : '' }}</span>
      </div>
      <p style="color:var(--muted); margin:0 0 12px;">{{ stripHtml(p.content)?.slice(0, 60) || '' }}</p>
      <router-link class="btn primary" :to="{ name: 'post', params: { id: p.id } }">阅读详情</router-link>
    </article>
  </div>

  <!-- 悬浮新增按钮 -->
  <button class="btn primary" style="position:fixed; right:24px; bottom:24px; z-index:30;" @click="showCreate = true">新增博客</button>

  <!-- 创建弹窗 -->
  <div v-if="showCreate" style="position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; z-index:40;">
    <div class="card" style="width:600px; padding:16px; display:grid; gap:12px;">
      <h3 style="margin:0;">新建文章</h3>
      <label>
        标题
        <input class="input" v-model="form.title" placeholder="请输入标题" />
      </label>
      <div>
        <div style="font-weight:600; margin-bottom:6px;">内容</div>
        <div class="card" style="padding:0; overflow:visible;">
          <QuillEditor theme="snow" v-model:content="form.content" contentType="html" style="height:260px;" />
        </div>
      </div>

      <div class="card" style="padding:12px;">
        <div style="font-weight:600; margin-bottom:6px;">预览</div>
        <div class="post-content" v-html="form.content"></div>
      </div>

      <div style="display:flex; gap:8px; align-items:center;">
        <button class="btn primary" :disabled="saving" @click="createPost">{{ saving ? '创建中...' : '创建' }}</button>
        <button class="btn" @click="showCreate = false">取消</button>
      </div>
      <div v-if="errorMsg" style="color:#ff6b6b;">{{ errorMsg }}</div>
      <div style="color:var(--muted); font-size:12px;">提示：需登录后创建文章</div>
    </div>
  </div>
</template>

<style scoped>
</style>