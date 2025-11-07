<script setup>
import { ref, onMounted, computed } from 'vue';
import { supabase } from '../lib/supabase';
import { getFollowingList } from '../lib/follow';

// 获取用户信息（优先从user_profiles表，其次从posts表，最后默认值）
const getUserInfoFromProfiles = async (userId) => {
  try {
    // 1. 首先尝试从user_profiles表获取
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('nickname, avatar_url')
      .eq('user_id', userId)
      .single();
    
    if (!profileError && profileData) {
      return { 
        nickname: profileData.nickname || '用户', 
        avatar_url: profileData.avatar_url || '' 
      };
    }
    
    // 2. 如果user_profiles表没有数据，尝试从posts表获取
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select('author_name, author_avatar')
      .eq('author', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!postsError && postsData && postsData.length > 0) {
      return { 
        nickname: postsData[0].author_name || '用户', 
        avatar_url: postsData[0].author_avatar || '' 
      };
    }
    
    // 3. 如果都没有数据，返回默认值
    return { nickname: '用户', avatar_url: '' };
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return { nickname: '用户', avatar_url: '' };
  }
};

const loading = ref(false);
const errorMsg = ref('');
const posts = ref([]);
const currentUser = ref(null);
const hasFetched = ref(false); // 防止重复调用
const followingList = ref([]); // 存储关注列表
const selectedAuthors = ref([]); // 选中的作者列表
const authorSearch = ref(''); // 作者搜索关键词

// 测试函数
const testFunction = () => {
  console.log('测试函数被调用');
  return '测试成功';
};

// 立即执行测试
console.log('Following组件脚本开始执行');
console.log('测试结果:', testFunction());

// 获取已关注用户的文章
const fetchFollowingPosts = async () => {
  // 防止重复调用
  console.log('检查调用条件:', { loading: loading.value, hasFetched: hasFetched.value });
  if (loading.value || hasFetched.value) {
    console.log('调用被阻止，直接返回');
    return;
  }
  
  loading.value = true;
  errorMsg.value = '';
  
  try {
    console.log('开始获取关注文章...');
    
    // 获取当前用户（只在首次调用时获取）
    if (!currentUser.value) {
      console.log('正在获取当前用户信息...');
      const { data: userRes, error: userError } = await supabase.auth.getUser();
      console.log('用户信息获取结果:', { userRes, userError });
      currentUser.value = userRes?.user || null;
    }
    
    console.log('当前用户状态:', currentUser.value);
    
    if (!currentUser.value) {
      console.log('未获取到用户信息，显示登录提示');
      errorMsg.value = '请先登录';
      posts.value = [];
      hasFetched.value = true;
      loading.value = false;
      return;
    }
    
    console.log('当前用户ID:', currentUser.value.id);
    
    // 获取关注列表
    console.log('正在获取关注列表...');
    const followingList = await getFollowingList(currentUser.value.id);
    console.log('关注列表:', followingList);
    
    if (followingList.length === 0) {
      console.log('关注列表为空');
      posts.value = [];
      hasFetched.value = true;
      loading.value = false;
      return;
    }
    
    // 获取已关注用户的文章
    const followingIds = followingList.map(item => item.following_id);
    console.log('关注用户ID列表:', followingIds);
    
    const { data: postsData, error } = await supabase
      .from('posts')
      .select('*')
      .in('author', followingIds)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    console.log('获取到的文章数据:', postsData);
    
    // 对每个文章作者同步获取最新的用户信息
    const postsWithLatestInfo = await Promise.all(
      (postsData || []).map(async (post) => {
        if (post.author) {
          try {
            const userInfo = await getUserInfoFromProfiles(post.author);
            return {
              ...post,
              author_name: userInfo.nickname,
              author_avatar: userInfo.avatar_url
            };
          } catch (error) {
            console.error('获取用户信息失败:', error);
            return post;
          }
        }
        return post;
      })
    );
    
    posts.value = postsWithLatestInfo;
    hasFetched.value = true;
    
  } catch (error) {
    console.error('获取关注文章失败:', error);
    errorMsg.value = '加载失败，请重试';
    posts.value = [];
    hasFetched.value = true; // 即使出错也标记为已获取，防止无限重试
  } finally {
    loading.value = false;
    console.log('加载完成，loading状态:', loading.value, 'posts数量:', posts.value.length);
  }
};

onMounted(() => {
  console.log('Following页面已挂载，开始调用fetchFollowingPosts');
  fetchFollowingPosts();
  console.log('fetchFollowingPosts调用完成');
});

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

// 获取文章摘要
const getExcerpt = (content) => {
  if (!content) return '';
  // 移除HTML标签
  const text = content.replace(/<[^>]+>/g, '');
  // 截取前100个字符
  return text.length > 100 ? text.slice(0, 100) + '...' : text;
};

// 获取筛选后的文章列表
const filteredPosts = computed(() => {
  if (selectedAuthors.value.length === 0) {
    return posts.value;
  }
  return posts.value.filter(post => selectedAuthors.value.includes(post.author));
});

// 获取作者列表（用于筛选）
const authors = computed(() => {
  const authorMap = new Map();
  posts.value.forEach(post => {
    if (post.author && post.author_name) {
      if (!authorMap.has(post.author)) {
        authorMap.set(post.author, {
          id: post.author,
          name: post.author_name,
          avatar: post.author_avatar,
          postCount: 0
        });
      }
      authorMap.get(post.author).postCount++;
    }
  });
  
  // 根据搜索关键词过滤
  let filteredAuthors = Array.from(authorMap.values());
  
  if (authorSearch.value.trim()) {
    const keyword = authorSearch.value.toLowerCase();
    filteredAuthors = filteredAuthors.filter(author => 
      author.name.toLowerCase().includes(keyword)
    );
  }
  
  // 按文章数量排序
  return filteredAuthors.sort((a, b) => b.postCount - a.postCount);
});

// 切换作者选择
const toggleAuthor = (authorId) => {
  console.log('切换作者选择:', authorId, '当前选中:', selectedAuthors.value);
  const index = selectedAuthors.value.indexOf(authorId);
  if (index > -1) {
    selectedAuthors.value.splice(index, 1);
  } else {
    selectedAuthors.value.push(authorId);
  }
  console.log('切换后选中:', selectedAuthors.value);
  console.log('筛选后的文章数量:', filteredPosts.value.length);
};

// 清空所有选择
const clearSelection = () => {
  selectedAuthors.value = [];
  authorSearch.value = '';
};

// 全选所有作者
const selectAll = () => {
  selectedAuthors.value = authors.value.map(author => author.id);
};
</script>

<template>
  <div class="following-container">
    <!-- 左侧筛选面板 -->
    <aside v-if="currentUser && posts.length > 0" class="filter-sidebar">
      <div class="filter-header">
        <h3>筛选作者</h3>
        <div class="filter-stats">
          <span class="selected-count">{{ selectedAuthors.length }} 已选</span>
          <span class="total-count">/ {{ authors.length }} 作者</span>
        </div>
      </div>
      
      <!-- 搜索框 -->
      <div class="search-box">
        <input 
          v-model="authorSearch" 
          type="text" 
          placeholder="搜索作者..." 
          class="search-input"
        />
        <svg v-if="authorSearch" @click="authorSearch = ''" class="clear-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      </div>
      
      <!-- 操作按钮 -->
      <div class="action-buttons">
        <button @click="selectAll" class="btn btn-small" :disabled="authors.length === 0">
          全选
        </button>
        <button @click="clearSelection" class="btn btn-small btn-outline" :disabled="selectedAuthors.length === 0">
          清空
        </button>
      </div>
      
      <!-- 作者列表 -->
      <div class="authors-list">
        <div 
          v-for="author in authors" 
          :key="author.id" 
          class="author-item"
          :class="{ selected: selectedAuthors.includes(author.id) }"
          @click="toggleAuthor(author.id)"
        >
          <div class="author-avatar-container">
            <img v-if="author.avatar" :src="author.avatar" alt="avatar" class="author-avatar" />
            <div v-else class="author-avatar-placeholder">
              {{ author.name.slice(0,1).toUpperCase() }}
            </div>
            <div v-if="selectedAuthors.includes(author.id)" class="checkmark">
              ✓
            </div>
          </div>
          <div class="author-info">
            <span class="author-name">{{ author.name }}</span>
            <span class="post-count">{{ author.postCount }} 篇文章</span>
          </div>
        </div>
        
        <div v-if="authors.length === 0" class="no-authors">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6;">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
          </svg>
          <p>暂无作者</p>
        </div>
      </div>
    </aside>
    
    <!-- 右侧内容区域 -->
    <main class="content-main">
      <div class="page-header">
        <h2 style="margin:0 0 16px;">关注动态</h2>
        <div style="color:var(--muted); margin-bottom:20px;">
          这里显示你关注的人发布的文章
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" style="text-align:center; padding:40px; color:var(--muted);">
        <div>加载中...</div>
      </div>

      <!-- 错误提示 -->
      <div v-else-if="errorMsg" class="card" style="padding:16px; background:#fff5f5; border:1px solid #ffccc7;">
        <div style="color:#ff4d4f; display:flex; align-items:center; gap:8px;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          {{ errorMsg }}
        </div>
      </div>

    <!-- 未登录提示 -->
    <div v-else-if="!currentUser" class="card" style="padding:20px; text-align:center;">
      <div style="color:var(--muted); margin-bottom:16px;">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6;">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="8.5" cy="7" r="4"></circle>
          <line x1="20" y1="8" x2="20" y2="14"></line>
          <line x1="23" y1="11" x2="17" y2="11"></line>
        </svg>
      </div>
      <h3 style="margin:0 0 8px; color:var(--text);">请先登录</h3>
      <p style="color:var(--muted); margin:0 0 16px;">登录后可以查看你关注的人发布的文章</p>
      <router-link to="/login" class="btn primary">立即登录</router-link>
    </div>

    <!-- 空状态 -->
    <div v-else-if="posts.length === 0" class="card" style="padding:40px; text-align:center;">
      <div style="color:var(--muted); margin-bottom:16px;">
        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6;">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        </svg>
      </div>
      <h3 style="margin:0 0 8px; color:var(--text);">暂无关注文章</h3>
      <p style="color:var(--muted); margin:0 0 16px;">你关注的人还没有发布文章，或者你还没有关注任何人</p>
      <div style="display:flex; gap:12px; justify-content:center;">
        <router-link to="/" class="btn">浏览首页</router-link>
        <router-link to="/hot" class="btn primary">查看热榜</router-link>
      </div>
    </div>

    <!-- 有文章时的内容 -->
    <div v-else>
      <!-- 筛选结果提示 -->
      <div v-if="selectedAuthors.length > 0" class="filter-result-indicator">
        <div class="filter-info">
          <span>显示 {{ selectedAuthors.length }} 位作者的文章 (共 {{ filteredPosts.length }} 篇)</span>
          <button @click="clearSelection" class="btn btn-small btn-link">显示全部</button>
        </div>
      </div>

      <!-- 文章列表 -->
      <div class="posts-grid">
        <router-link v-for="post in filteredPosts" :key="post.id" class="card post-card" :to="{ name: 'post', params: { id: post.id } }">
          <h3 class="post-title">{{ post.title }}</h3>
          <div class="post-meta">
            <div class="author-info">
              <router-link v-if="post.author" :to="{ name: 'user', params: { id: post.author } }" style="text-decoration:none; color:inherit;">
                <div style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                  <img v-if="post.author_avatar" :src="post.author_avatar" alt="avatar" class="author-avatar" />
                  <div v-else class="author-avatar-placeholder">
                    {{ (post.author_name || '匿名').slice(0,1).toUpperCase() }}
                  </div>
                  <span class="author-name">{{ post.author_name || '匿名' }}</span>
                </div>
              </router-link>
              <div v-else style="display:flex; align-items:center; gap:8px;">
                <img v-if="post.author_avatar" :src="post.author_avatar" alt="avatar" class="author-avatar" />
                <div v-else class="author-avatar-placeholder">
                  {{ (post.author_name || '匿名').slice(0,1).toUpperCase() }}
                </div>
                <span class="author-name">{{ post.author_name || '匿名' }}</span>
              </div>
            </div>
            <span class="post-date">{{ formatDate(post.created_at) }}</span>
          </div>
          <p class="post-excerpt">{{ getExcerpt(post.content) }}</p>
          <div class="post-actions">
            <span class="btn view-btn">查看详情</span>
          </div>
        </router-link>
      </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* 容器布局 */
.following-container {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 24px;
  max-width: 1700px;
  margin: 0 auto;
  padding: 0 20px;
}

/* 左侧筛选面板 */
.filter-sidebar {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  height: fit-content;
  position: sticky;
  top: 20px;
}

.filter-header {
  margin-bottom: 16px;
}

.filter-header h3 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.filter-stats {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}

.selected-count {
  color: var(--primary);
  font-weight: 500;
}

/* 搜索框 */
.search-box {
  position: relative;
  margin-bottom: 16px;
}

.search-input {
  width: 100%;
  padding: 8px 32px 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg);
  color: var(--text);
}

.search-input:focus {
  outline: none;
  border-color: var(--primary);
}

.clear-icon {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  color: var(--muted);
}

.clear-icon:hover {
  color: var(--text);
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
}

.btn-outline:hover:not(:disabled) {
  background: rgba(0, 232, 132, 0.08);
}

.btn-link {
  background: none;
  border: none;
  color: var(--primary);
  text-decoration: underline;
  cursor: pointer;
}

/* 作者列表 */
.authors-list {
  max-height: 400px;
  overflow-y: auto;
}

.author-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  margin-bottom: 4px;
}

.author-item:hover {
  background: rgba(0, 232, 132, 0.08);
}

.author-item.selected {
  background: rgba(0, 232, 132, 0.12);
}

.author-avatar-container {
  position: relative;
  flex-shrink: 0;
}

.author-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--border);
}

.author-avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #163229;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--primary);
  font-weight: 700;
}

.checkmark {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--card);
}

.author-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.author-name {
  font-weight: 500;
  font-size: 14px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.post-count {
  font-size: 12px;
  color: var(--muted);
}

.no-authors {
  text-align: center;
  padding: 20px;
  color: var(--muted);
}

.no-authors p {
  margin: 8px 0 0;
  font-size: 14px;
}

/* 右侧内容区域 */
.content-main {
  min-width: 0;
}

.page-header {
  margin-bottom: 24px;
}

/* 筛选结果提示 */
.filter-result-indicator {
  margin-bottom: 16px;
}

.filter-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(0, 232, 132, 0.12);
  border: 1px solid var(--primary);
  border-radius: 6px;
  color: var(--primary);
  font-size: 14px;
}

/* 文章列表区域 */
.posts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.post-card {
  padding: 20px;
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.post-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.post-title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text);
}

.post-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 14px;
}

.author-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--border);
}

.author-avatar-placeholder {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #163229;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--primary);
  font-weight: 700;
}

.author-name {
  font-weight: 500;
}

.post-date {
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}

.post-excerpt {
  color: var(--muted);
  margin: 0;
  line-height: 1.5;
  flex: 1;
  font-size: 14px;
}

.post-actions {
  margin-top: auto;
  display: flex;
  gap: 8px;
  padding-top: 16px;
}

.view-btn {
  pointer-events: none;
  font-size: 14px;
  padding: 8px 16px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .following-container {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .filter-sidebar {
    position: static;
    margin-bottom: 16px;
  }
  
  .posts-grid {
    grid-template-columns: 1fr;
  }
}

/* 移动端小屏幕适配 */
@media (max-width: 480px) {
  .filter-sidebar {
    padding: 16px;
  }
  
  .authors-list {
    max-height: 300px;
  }
  
  .post-card {
    padding: 16px;
  }
}
</style>