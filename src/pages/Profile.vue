<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../lib/supabase';
import ContributionCalendar from '../components/ContributionCalendar.vue';
import { 
  followUser, 
  unfollowUser, 
  isFollowing, 
  getFollowingCount, 
  getFollowersCount,
  getFollowingList,
  getFollowersList
} from '../lib/follow';

const route = useRoute();
const router = useRouter();
const props = defineProps({
  id: {
    type: String,
    default: ''
  }
});

const user = ref(null);
const currentUser = ref(null);
const loading = ref(true);

const form = ref({
  nickname: '',
  bio: '',
  avatarFile: null,
  avatarPreview: '',
  backgroundFile: null,
  backgroundPreview: ''
});
const saving = ref(false);
const errorMsg = ref('');
const successMsg = ref('');
const editMode = ref(false);

// 关注相关状态
const followingCount = ref(0);
const followersCount = ref(0);
const isFollowingUser = ref(false);
const followLoading = ref(false);
const followError = ref('');
const showFollowingList = ref(false);
const showFollowersList = ref(false);
const followingList = ref([]);
const followersList = ref([]);
const listLoading = ref(false);
const unfollowLoading = ref(new Set()); // 用于跟踪正在取消关注的用户

// 判断是否是查看自己的主页
const isOwnProfile = computed(() => {
  if (!currentUser.value || !user.value) return false;
  return currentUser.value.id === user.value.id;
});

/** 加载用户资料 */
const loadUserProfile = async (userId) => {
  loading.value = true;
  errorMsg.value = '';
  
  try {
    // 获取当前登录用户
    const { data: currentUserData } = await supabase.auth.getUser();
    currentUser.value = currentUserData?.user || null;
    
    // 如果是查看自己的主页，使用当前用户信息
    if (!userId || userId === currentUser.value?.id) {
      user.value = currentUser.value;
      if (user.value) {
        const meta = user.value.user_metadata || {};
        form.value.nickname = meta.nickname || '';
        form.value.bio = meta.bio || '';
        form.value.avatarPreview = meta.avatar_url || '';
        form.value.backgroundPreview = meta.background_url || '';
      }
    } else {
      // 查看其他用户的主页，通过ID查询用户信息
      // 创建一个自定义的用户信息表来存储公开的用户资料
      try {
        // 首先尝试从专门的用户资料表获取信息
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', userId)
          .single();
          
        if (!profileError && profileData) {
          // 从用户资料表获取信息
          user.value = {
            id: userId,
            email: profileData.email || '用户',
            user_metadata: {
              nickname: profileData.nickname || '用户',
              bio: profileData.bio || '',
              avatar_url: profileData.avatar_url || '',
              background_url: profileData.background_url || ''
            }
          };
        } else {
          // 如果用户资料表不存在或没有数据，从posts表获取最新的文章信息
          const { data: postsData, error: postsError } = await supabase
            .from('posts')
            .select('author_name, author_avatar')
            .eq('author', userId)
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (!postsError && postsData && postsData.length > 0) {
            // 从最新的文章获取用户信息（相对较新的昵称）
            user.value = {
              id: userId,
              email: '用户',
              user_metadata: {
                nickname: postsData[0].author_name || '用户',
                avatar_url: postsData[0].author_avatar || ''
              }
            };
          } else {
            // 如果没有文章信息，显示默认用户信息
            user.value = {
              id: userId,
              email: '用户',
              user_metadata: {
                nickname: '用户',
                avatar_url: ''
              }
            };
          }
        }
      } catch (error) {
        console.error('获取用户信息失败:', error);
        // 显示默认用户信息
        user.value = {
          id: userId,
          email: '用户',
          user_metadata: {
            nickname: '用户',
            avatar_url: ''
          }
        };
      }
    }
  } catch (error) {
    console.error('加载用户信息失败:', error);
    // 显示友好的错误信息
    errorMsg.value = '用户信息暂时无法访问';
    user.value = null;
  } finally {
    loading.value = false;
  }
  
  // 加载关注数据
  if (user.value) {
    await loadFollowData(user.value.id);
  }
};

/** 组件挂载时加载数据 */
onMounted(async () => {
  await loadUserProfile(props.id);
});

// 监听路由参数变化
import { watch } from 'vue';
watch(() => props.id, async (newId) => {
  await loadUserProfile(newId);
});

/** 选择头像文件，做本地预览 */
const onPickAvatar = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  form.value.avatarFile = file;
  try {
    form.value.avatarPreview = URL.createObjectURL(file);
  } catch {}
};

/** 选择背景图文件，做本地预览 */
const onPickBackground = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  // 验证文件大小（最大5MB）
  if (file.size > 5 * 1024 * 1024) {
    errorMsg.value = '背景图文件大小不能超过5MB';
    return;
  }
  
  // 验证文件类型
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    errorMsg.value = '请选择JPEG、PNG或WebP格式的图片';
    return;
  }
  
  form.value.backgroundFile = file;
  try {
    form.value.backgroundPreview = URL.createObjectURL(file);
  } catch {}
};

/** 保存资料：先上传头像和背景图(如有)，再更新用户 metadata */
const onSave = async () => {
  if (!user.value || !editMode.value) return;
  errorMsg.value = '';
  successMsg.value = '';
  saving.value = true;

  let avatarUrl = form.value.avatarPreview || '';
  let backgroundUrl = form.value.backgroundPreview || '';

  try {
    // 若选择了新头像文件则上传
    if (form.value.avatarFile) {
      const uid = user.value.id;
      const ext = form.value.avatarFile.name.split('.').pop() || 'png';
      const path = `${uid}/avatar_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase
        .storage
        .from('avatars')
        .upload(path, form.value.avatarFile, { upsert: true, cacheControl: '3600', contentType: form.value.avatarFile.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      avatarUrl = pub?.publicUrl || avatarUrl;
    }

    // 若选择了新背景图文件则上传
    if (form.value.backgroundFile) {
      const uid = user.value.id;
      const ext = form.value.backgroundFile.name.split('.').pop() || 'jpg';
      const path = `${uid}/background_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase
        .storage
        .from('backgrounds')
        .upload(path, form.value.backgroundFile, { upsert: true, cacheControl: '3600', contentType: form.value.backgroundFile.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('backgrounds').getPublicUrl(path);
      backgroundUrl = pub?.publicUrl || backgroundUrl;
    }

    const { data, error } = await supabase.auth.updateUser({
      data: {
        nickname: form.value.nickname?.trim() || '',
        bio: form.value.bio?.trim() || '',
        avatar_url: avatarUrl || '',
        background_url: backgroundUrl || ''
      }
    });
    if (error) throw error;

    // 同步到公开的用户资料表，方便他人查看
    const userData = data.user;
    const meta = userData.user_metadata || {};
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userData.id,
        email: userData.email,
        nickname: meta.nickname || '',
        bio: meta.bio || '',
        avatar_url: meta.avatar_url || '',
        background_url: meta.background_url || '',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    // 同步本地 user
    user.value = data.user;
    successMsg.value = '保存成功';
    editMode.value = false;
  } catch (e) {
    errorMsg.value = e?.message || '保存失败';
  } finally {
    saving.value = false;
  }
};

const cancelEdit = () => {
  if (!user.value) return;
  const meta = user.value.user_metadata || {};
  form.value.nickname = meta.nickname || '';
  form.value.bio = meta.bio || '';
  form.value.avatarPreview = meta.avatar_url || '';
  form.value.avatarFile = null;
  form.value.backgroundPreview = meta.background_url || '';
  form.value.backgroundFile = null;
  errorMsg.value = '';
  successMsg.value = '';
  editMode.value = false;
};

const logout = async () => {
  await supabase.auth.signOut();
  location.href = '/';
};

/** 加载关注数据 */
const loadFollowData = async (userId) => {
  try {
    // 获取关注数和粉丝数
    followingCount.value = await getFollowingCount(userId);
    followersCount.value = await getFollowersCount(userId);
    
    // 检查当前用户是否已关注该用户
    if (currentUser.value && userId !== currentUser.value.id) {
      isFollowingUser.value = await isFollowing(userId);
    }
  } catch (error) {
    console.error('加载关注数据失败:', error);
  }
};

/** 关注/取消关注用户 */
const toggleFollow = async () => {
  if (!user.value || !currentUser.value) {
    followError.value = '请先登录';
    return;
  }
  
  if (user.value.id === currentUser.value.id) {
    followError.value = '不能关注自己';
    return;
  }
  
  followLoading.value = true;
  followError.value = '';
  
  try {
    if (isFollowingUser.value) {
      // 取消关注
      const result = await unfollowUser(user.value.id);
      if (result.success) {
        isFollowingUser.value = false;
        followersCount.value = Math.max(0, followersCount.value - 1);
      } else {
        followError.value = result.error;
      }
    } else {
      // 关注
      const result = await followUser(user.value.id);
      if (result.success) {
        isFollowingUser.value = true;
        followersCount.value += 1;
      } else {
        followError.value = result.error;
      }
    }
  } catch (error) {
    followError.value = '操作失败，请重试';
    console.error('关注操作失败:', error);
  } finally {
    followLoading.value = false;
  }
};

/** 加载关注列表 */
const loadFollowingList = async () => {
  if (!user.value) return;
  
  listLoading.value = true;
  try {
    followingList.value = await getFollowingList(user.value.id);
  } catch (error) {
    console.error('加载关注列表失败:', error);
    followingList.value = [];
  } finally {
    listLoading.value = false;
  }
};

/** 加载粉丝列表 */
const loadFollowersList = async () => {
  if (!user.value) return;
  
  listLoading.value = true;
  try {
    followersList.value = await getFollowersList(user.value.id);
  } catch (error) {
    console.error('加载粉丝列表失败:', error);
    followersList.value = [];
  } finally {
    listLoading.value = false;
  }
};

/** 显示关注列表弹窗 */
const showFollowingModal = async () => {
  showFollowingList.value = true;
  await loadFollowingList();
};

/** 显示粉丝列表弹窗 */
const showFollowersModal = async () => {
  showFollowersList.value = true;
  await loadFollowersList();
};

/** 取消关注用户（在关注列表中） */
const unfollowUserInList = async (targetUserId, targetUserIndex) => {
  if (!currentUser.value || !user.value) {
    followError.value = '请先登录';
    return;
  }
  
  if (targetUserId === currentUser.value.id) {
    followError.value = '不能取消关注自己';
    return;
  }
  
  // 添加正在取消关注的用户到loading集合
  unfollowLoading.value.add(targetUserId);
  
  try {
    const result = await unfollowUser(targetUserId);
    if (result.success) {
      // 从关注列表中移除该用户
      followingList.value.splice(targetUserIndex, 1);
      // 更新关注数量
      followingCount.value = Math.max(0, followingCount.value - 1);
      
      // 如果当前查看的是自己的主页，且取消关注的是正在查看的用户，更新关注状态
      if (isOwnProfile.value && user.value.id === targetUserId) {
        isFollowingUser.value = false;
      }
    } else {
      followError.value = result.error;
    }
  } catch (error) {
    followError.value = '取消关注失败，请重试';
    console.error('取消关注失败:', error);
  } finally {
    // 移除loading状态
    unfollowLoading.value.delete(targetUserId);
  }
};

/** 跳转到用户个人主页 */
const navigateToUserProfile = (userId) => {
  // 关闭当前弹窗
  showFollowingList.value = false;
  showFollowersList.value = false;
  
  // 如果当前已在目标用户页面，则不跳转
  if (route.params.id === userId) {
    return;
  }
  
  // 跳转到用户个人主页
  router.push({ name: 'user', params: { id: userId } });
};

</script>

<template>
  <div class="card" style="max-width:1280px; margin:0 auto; padding:40px;">
    <h2 style="margin:0 0 16px;">
      {{ isOwnProfile ? '个人中心' : '个人主页' }}
      <span v-if="!isOwnProfile && user" style="font-size:14px; color:var(--muted); font-weight:normal;">
        - {{ user.user_metadata?.nickname || '用户' }}
      </span>
    </h2>

    <div v-if="loading" style="color:var(--muted);">加载中...</div>

    <div v-else-if="!user" style="color:var(--muted);">
      <div v-if="isOwnProfile">
        尚未登录，<router-link to="/login">去登录</router-link>
      </div>
      <div v-else>
        用户不存在或无法访问
      </div>
    </div>

    <div v-else style="display:grid; gap:16px;">
      <!-- 背景图区域 -->
      <div style="position:relative; height:200px; border-radius:12px; overflow:hidden; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div v-if="user.user_metadata?.background_url" 
             :style="{ 
               backgroundImage: `url(${user.user_metadata.background_url})`,
               backgroundSize: 'cover',
               backgroundPosition: 'center',
               width: '100%',
               height: '100%',
               position: 'absolute',
               top: 0,
               left: 0
             }">
        </div>
        <div style="position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.3);"></div>
        
        <!-- 如果当前用户正在编辑，显示上传按钮 -->
        <div v-if="isOwnProfile && editMode" style="position:absolute; top:16px; right:16px;">
          <label class="btn" style="background:rgba(255,255,255,0.2); backdrop-filter:blur(10px); color:white; border:none; cursor:pointer;">
            <input type="file" accept="image/*" @change="onPickBackground" style="display:none;" />
            更换背景
          </label>
        </div>
        
        <!-- 显示当前背景预览 -->
        <div v-if="isOwnProfile && editMode && form.backgroundPreview" style="position:absolute; top:16px; left:16px; width:200px; height:80px; border-radius:8px; overflow:hidden; border:2px solid white;">
          <img :src="form.backgroundPreview" alt="背景预览" style="width:100%; height:100%; object-fit:cover;">
        </div>
      </div>

      <!-- 头像与基础信息 -->
      <div style="display:flex; align-items:center; justify-content:space-between; margin-top:24px;">
        <div style="display:flex; align-items:center; gap:24px;">
          <div style="position:relative;">
            <img v-if="user.user_metadata?.avatar_url" :src="user.user_metadata.avatar_url" alt="avatar"
                 style="width:120px; height:120px; border-radius:50%; object-fit:cover; border:2px solid var(--border);" />
            <div v-else
                 style="width:120px; height:120px; border-radius:50%; background:#163229; display:flex; align-items:center; justify-content:center; color:var(--primary); font-weight:700; font-size:36px;">
              {{ (user.user_metadata?.nickname || user.email || 'U').slice(0,1).toUpperCase() }}
            </div>
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:24px; margin-bottom:12px;">
              <div style="font-weight:600; font-size:28px;">{{ user.user_metadata?.nickname || '未设置昵称' }}</div>
              
              <!-- 关注数据 - 移动到用户名后面 -->
              <div style="display:flex; gap:24px;">
                <div style="text-align:center; cursor:pointer;" @click="showFollowingModal">
                  <div style="font-weight:600; font-size:20px;">{{ followingCount }}</div>
                  <div style="color:var(--muted); font-size:14px;">关注</div>
                </div>
                <div style="text-align:center; cursor:pointer;" @click="showFollowersModal">
                  <div style="font-weight:600; font-size:20px;">{{ followersCount }}</div>
                  <div style="color:var(--muted); font-size:14px;">粉丝</div>
                </div>
              </div>
            </div>
            
            <div style="color:var(--muted); font-size:16px;">{{ user.email }}</div>
            <div style="margin-top:12px; white-space:pre-wrap; color:var(--text); max-width:600px; font-size:15px; line-height:1.6;">{{ user.user_metadata?.bio || '尚未填写个人简介' }}</div>
          </div>
        </div>
        
        <!-- 操作按钮 -->
        <div v-if="isOwnProfile" style="display:flex; gap:8px; align-self:flex-start;">
          <button class="btn" @click="editMode ? cancelEdit() : (editMode = true)">
            {{ editMode ? '取消编辑' : '编辑资料' }}
          </button>
          <button class="btn" @click="logout">退出登录</button>
        </div>
        <div v-else style="display:flex; gap:8px; align-self:flex-start;">
          <router-link class="btn" to="/">返回首页</router-link>
          <!-- 关注按钮 -->
          <button v-if="currentUser && !isOwnProfile" 
                  class="btn" 
                  :class="{ primary: isFollowingUser }"
                  @click="toggleFollow"
                  :disabled="followLoading">
            {{ followLoading ? '处理中...' : (isFollowingUser ? '取消关注' : '关注') }}
          </button>
        </div>
      </div>

      <!-- 关注错误提示 -->
      <div v-if="followError" style="color:#ff6b6b; padding:8px; background:#fff5f5; border-radius:4px; margin-top:8px;">
        {{ followError }}
      </div>

      <!-- 编辑表单（仅自己可见） -->
      <div v-if="isOwnProfile && editMode" class="card" style="padding:16px; display:grid; gap:12px;">
        <label>
          昵称
          <input class="input" v-model="form.nickname" placeholder="输入新的昵称" />
        </label>
        <label>
          头像
          <input class="input" type="file" accept="image/*" @change="onPickAvatar" />
        </label>
        <label>
          背景图
          <input class="input" type="file" accept="image/*" @change="onPickBackground" />
        </label>
        <label>
          个人简介
          <textarea class="input" v-model="form.bio" placeholder="用几句话介绍自己..." rows="4" style="resize: none;"></textarea>
        </label>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn primary" :disabled="saving" @click="onSave">
            {{ saving ? '保存中...' : '保存资料' }}
          </button>
        </div>
        <div v-if="errorMsg" style="color:#ff6b6b;">{{ errorMsg }}</div>
        <div v-if="successMsg" style="color:#18c37a;">{{ successMsg }}</div>
      </div>
      
      <!-- 贡献日历 -->

      <ContributionCalendar v-if="user" :userId="user.id" />


      <!-- 关注列表弹窗 -->
      <div v-if="showFollowingList" class="modal-overlay" @click="showFollowingList = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>关注列表 ({{ followingCount }})</h3>
            <button class="close-btn" @click="showFollowingList = false">×</button>
          </div>
          <div class="modal-body">
            <div v-if="listLoading" style="text-align:center; color:var(--muted); padding:20px;">
              加载中...
            </div>
            <div v-else-if="followingList.length === 0" style="text-align:center; color:var(--muted); padding:20px;">
              还没有关注任何人
            </div>
            <div v-else>
              <div v-for="(item, index) in followingList" :key="item.following_id" class="user-item">
                <div style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid var(--border);">
                  <div style="position:relative; cursor:pointer;" @click="navigateToUserProfile(item.following_id)">
                    <img v-if="item.user.user_metadata?.avatar_url" :src="item.user.user_metadata.avatar_url" alt="avatar"
                         style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid var(--border);" />
                    <div v-else
                         style="width:40px; height:40px; border-radius:50%; background:#163229; display:flex; align-items:center; justify-content:center; color:var(--primary); font-weight:700;">
                      {{ (item.user.user_metadata?.nickname || item.user.email || 'U').slice(0,1).toUpperCase() }}
                    </div>
                  </div>
                  <div style="flex:1; cursor:pointer;" @click="navigateToUserProfile(item.following_id)">
                    <div style="font-weight:600; text-decoration:underline;">{{ item.user.user_metadata?.nickname || '用户' }}</div>
                    <div style="color:var(--muted); font-size:12px;">{{ item.user.email }}</div>
                  </div>
                  <div style="color:var(--muted); font-size:12px; margin-right:8px;">
                    {{ new Date(item.created_at).toLocaleDateString('zh-CN') }}
                  </div>
                  <!-- 取消关注按钮 -->
                  <button v-if="isOwnProfile" 
                          class="btn btn-sm"
                          style="background:#ff6b6b; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:12px;"
                          @click="unfollowUserInList(item.following_id, index)"
                          :disabled="unfollowLoading.has(item.following_id)">
                    {{ unfollowLoading.has(item.following_id) ? '取消中...' : '取消关注' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 粉丝列表弹窗 -->
      <div v-if="showFollowersList" class="modal-overlay" @click="showFollowersList = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>粉丝列表 ({{ followersCount }})</h3>
            <button class="close-btn" @click="showFollowersList = false">×</button>
          </div>
          <div class="modal-body">
            <div v-if="listLoading" style="text-align:center; color:var(--muted); padding:20px;">
              加载中...
            </div>
            <div v-else-if="followersList.length === 0" style="text-align:center; color:var(--muted); padding:20px;">
              还没有粉丝
            </div>
            <div v-else>
              <div v-for="item in followersList" :key="item.follower_id" class="user-item">
                <div style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid var(--border);">
                  <div style="position:relative; cursor:pointer;" @click="navigateToUserProfile(item.follower_id)">
                    <img v-if="item.user.user_metadata?.avatar_url" :src="item.user.user_metadata.avatar_url" alt="avatar"
                         style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid var(--border);" />
                    <div v-else
                         style="width:40px; height:40px; border-radius:50%; background:#163229; display:flex; align-items:center; justify-content:center; color:var(--primary); font-weight:700;">
                      {{ (item.user.user_metadata?.nickname || item.user.email || 'U').slice(0,1).toUpperCase() }}
                    </div>
                  </div>
                  <div style="flex:1; cursor:pointer;" @click="navigateToUserProfile(item.follower_id)">
                    <div style="font-weight:600; text-decoration:underline;">{{ item.user.user_metadata?.nickname || '用户' }}</div>
                    <div style="color:var(--muted); font-size:12px;">{{ item.user.email }}</div>
                  </div>
                  <div style="color:var(--muted); font-size:12px;">
                    {{ new Date(item.created_at).toLocaleDateString('zh-CN') }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--muted);
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--border);
}

.modal-body {
  padding: 0;
  max-height: 400px;
  overflow-y: auto;
}
</style>