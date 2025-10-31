<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { supabase } from '../lib/supabase';

const props = defineProps({
  userId: {
    type: String,
    required: true
  }
});

const loading = ref(true);
const contributionData = ref({});
const currentYear = ref(new Date().getFullYear());

// 生成贡献日历数据
const generateCalendarData = (posts) => {
  const data = {};
  
  // 初始化当前年份的数据
  const startDate = new Date(currentYear.value, 0, 1);
  const endDate = new Date(currentYear.value, 11, 31);
  
  // 填充所有日期
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    data[dateStr] = 0;
  }
  
  // 统计每天的博客数量
  posts.forEach(post => {
    if (post.created_at) {
      const date = new Date(post.created_at);
      const dateStr = date.toISOString().split('T')[0];
      if (date.getFullYear() === currentYear.value) {
        data[dateStr] = (data[dateStr] || 0) + 1;
      }
    }
  });
  
  return data;
};

// 获取贡献等级（颜色强度）
const getContributionLevel = (count) => {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
};

// 生成月份标签和位置
const monthLabels = computed(() => {
  const months = [];
  
  // 使用北京时间计算
  const startDate = new Date(Date.UTC(currentYear.value, 0, 1, 8, 0, 0)); // UTC+8 北京时间
  
  // 找到包含1月1日的那个周的第一天（周日）
  let firstSunday = new Date(startDate);
  if (firstSunday.getDay() !== 0) {
    firstSunday.setDate(startDate.getDate() - startDate.getDay());
  }
  
  let lastMonthColumn = -1;
  
  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(Date.UTC(currentYear.value, i, 1, 8, 0, 0)); // UTC+8 北京时间
    
    // 计算该月份在日历中的列位置
    const daysDiff = Math.floor((monthDate - firstSunday) / (1000 * 60 * 60 * 24));
    const weekColumn = Math.floor(daysDiff / 7) + 1; // +1 因为第一列是周标签
    
    // 只有当月份位置发生变化时才显示月份标签
    // 避免在同一个周内重复显示月份
    if (weekColumn > lastMonthColumn) {
      months.push({
        name: monthDate.toLocaleString('zh-CN', { month: 'short' }),
        column: weekColumn,
        span: 1 // 默认跨度为1列
      });
      lastMonthColumn = weekColumn;
    } else if (months.length > 0) {
      // 如果月份位置没有变化，增加前一个月份的跨度
      months[months.length - 1].span += 1;
    }
  }
  
  return months;
});

// 生成周标签
const weekLabels = computed(() => {
  return ['日', '一', '二', '三', '四', '五', '六'];
});

// 生成日历格子数据
const calendarGrid = computed(() => {
  const grid = [];
  
  // 使用北京时间计算日历布局
  // 获取当前年份1月1日的北京时间
  const startDate = new Date(Date.UTC(currentYear.value, 0, 1, 8, 0, 0)); // UTC+8 北京时间
  let firstSunday = new Date(startDate);
  
  // 如果1月1日不是周日，就往前找到最近的周日
  if (firstSunday.getDay() !== 0) {
    firstSunday.setDate(startDate.getDate() - startDate.getDay());
  }
  
  // 生成53周（GitHub样式）
  for (let week = 0; week < 53; week++) {
    const weekData = [];
    for (let day = 0; day < 7; day++) {
      const currentDate = new Date(firstSunday);
      currentDate.setDate(firstSunday.getDate() + week * 7 + day);
      
      // 使用北京时间的日期字符串
      const beijingDate = new Date(currentDate.getTime() + 8 * 60 * 60 * 1000); // UTC+8
      const dateStr = beijingDate.toISOString().split('T')[0];
      const count = contributionData.value[dateStr] || 0;
      const level = getContributionLevel(count);
      
      weekData.push({
        date: currentDate,
        dateStr,
        count,
        level,
        isCurrentYear: currentDate.getFullYear() === currentYear.value,
        dayOfWeek: currentDate.getDay() // 0=周日, 1=周一, ..., 6=周六
      });
    }
    grid.push(weekData);
  }
  
  return grid;
});

// 获取总博客数量
const totalPosts = computed(() => {
  return Object.values(contributionData.value).reduce((sum, count) => sum + count, 0);
});

// 获取连续天数
const streakDays = computed(() => {
  let streak = 0;
  let maxStreak = 0;
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // 从今天往前找连续有贡献的天数
  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    if (contributionData.value[dateStr] > 0) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 0;
    }
  }
  
  return maxStreak;
});

// 获取用户博客数据
const fetchUserPosts = async () => {
  loading.value = true;
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('created_at')
      .eq('author', props.userId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    contributionData.value = generateCalendarData(data || []);
  } catch (error) {
    console.error('获取博客数据失败:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (props.userId) {
    fetchUserPosts();
  }
});

// 监听userId变化
watch(() => props.userId, (newUserId) => {
  if (newUserId) {
    fetchUserPosts();
  }
});
</script>

<template>
  <div class="contribution-calendar">
    <div class="calendar-header">
      <h3 style="margin:0 0 8px;">博客创作日历</h3>
      <div class="stats">
        <span class="stat-item">
          <strong>{{ totalPosts }}</strong> 篇博客
        </span>
        <span class="stat-item">
          <strong>{{ streakDays }}</strong> 天连续创作
        </span>
        <span class="stat-item">
          <strong>{{ currentYear }}</strong> 年
        </span>
      </div>
    </div>
    
    <div v-if="loading" class="loading">
      加载创作数据中...
    </div>
    
    <div v-else class="calendar-container">
      <!-- 月份标签 -->
      <div class="month-labels">
        <div class="week-label-spacer"></div>
        <div 
          v-for="(month, index) in monthLabels" 
          :key="index"
          class="month-label"
          :style="{ 
            gridColumn: `${month.column} / span ${month.span}`,
            textAlign: month.span > 1 ? 'center' : 'left'
          }"
        >
          {{ month.name }}
        </div>
      </div>
      
      <!-- 周标签和日历格子 -->
      <div class="calendar-grid">
        <!-- 周标签 -->
        <div class="week-labels">
          <div 
            v-for="(day, index) in weekLabels" 
            :key="index"
            class="week-label"
          >
            {{ day }}
          </div>
        </div>
        
        <!-- 日历格子 -->
        <div class="grid-cells">
          <div 
            v-for="(week, weekIndex) in calendarGrid" 
            :key="weekIndex"
            class="week-column"
          >
            <div 
              v-for="(day, dayIndex) in week" 
              :key="dayIndex"
              class="contribution-cell"
              :class="[
                `level-${day.level}`,
                { 'current-year': day.isCurrentYear }
              ]"
              :title="`${day.dateStr}: ${day.count} 篇博客`"
            ></div>
          </div>
        </div>
      </div>
      
      <!-- 图例 -->
      <div class="legend">
        <span>更少</span>
        <div class="legend-cells">
          <div class="legend-cell level-0" title="0 篇"></div>
          <div class="legend-cell level-1" title="1 篇"></div>
          <div class="legend-cell level-2" title="2-3 篇"></div>
          <div class="legend-cell level-3" title="4-5 篇"></div>
          <div class="legend-cell level-4" title="5+ 篇"></div>
        </div>
        <span>更多</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.contribution-calendar {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  backdrop-filter: blur(10px);
  padding: 16px;
  margin-top: 20px;
  position: relative;
  transition: box-shadow 0.25s ease, transform 0.25s ease;
}

.contribution-calendar::before {
  content: "";
  position: absolute; 
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  /* 霓虹微光边框 - 只在暗色模式下显示 */
  box-shadow: 0 0 0 1px rgba(0, 232, 132, 0.12), 0 0 12px rgba(0, 232, 132, 0.06) inset;
}

/* 在亮色模式下隐藏绿色边框 */
:root[data-theme='light'] .contribution-calendar::before {
  box-shadow: none;
}

.contribution-calendar:hover {
  box-shadow: 0 16px 40px rgba(0,0,0,0.45), 0 0 16px rgba(124,77,255,0.25);
  transform: translateY(-1px);
}

.calendar-header {
  margin-bottom: 16px;
}

.stats {
  display: flex;
  gap: 20px;
  font-size: 14px;
  color: var(--muted);
}

.stat-item strong {
  color: var(--text);
}

.loading {
  text-align: center;
  padding: 40px;
  color: var(--muted);
}

.calendar-container {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 8px;
}

.month-labels {
  display: grid;
  grid-template-columns: 20px repeat(53, 1fr);
  gap: 2px;
  font-size: 12px;
  color: var(--muted);
  margin-left: 20px;
}

.month-label {
  text-align: center;
  white-space: nowrap;
}

.calendar-grid {
  display: grid;
  grid-template-columns: 20px 1fr;
  gap: 8px;
}

.week-labels {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: var(--muted);
}

.week-label {
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.grid-cells {
  display: flex;
  gap: 2px;
}

.week-column {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.contribution-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid transparent;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  cursor: pointer;
}

.contribution-cell.current-year {
  border-color: var(--border);
}

.contribution-cell.level-0 {
  background-color: #ebedf0;
}

.contribution-cell.level-1 {
  background-color: #9be9a8;
}

.contribution-cell.level-2 {
  background-color: #40c463;
}

.contribution-cell.level-3 {
  background-color: #30a14e;
}

.contribution-cell.level-4 {
  background-color: #216e39;
}

.contribution-cell:hover {
  transform: scale(1.4);
  z-index: 10;
  box-shadow: 
    0 4px 8px rgba(0, 0, 0, 0.15),
    0 0 0 2px rgba(255, 255, 255, 0.8);
  border-radius: 3px;
}

.contribution-cell.level-0:hover {
  background-color: #d0d3d6;
}

.contribution-cell.level-1:hover {
  background-color: #7ae28a;
  box-shadow: 
    0 4px 12px rgba(155, 233, 168, 0.3),
    0 0 0 2px rgba(255, 255, 255, 0.9);
}

.contribution-cell.level-2:hover {
  background-color: #2ebd5b;
  box-shadow: 
    0 4px 12px rgba(64, 196, 99, 0.3),
    0 0 0 2px rgba(255, 255, 255, 0.9);
}

.contribution-cell.level-3:hover {
  background-color: #269945;
  box-shadow: 
    0 4px 12px rgba(48, 161, 78, 0.3),
    0 0 0 2px rgba(255, 255, 255, 0.9);
}

.contribution-cell.level-4:hover {
  background-color: #1a5c2d;
  box-shadow: 
    0 4px 12px rgba(33, 110, 57, 0.3),
    0 0 0 2px rgba(255, 255, 255, 0.9);
}

/* 添加悬浮提示动画 */
.contribution-cell::after {
  content: attr(title);
  position: absolute;
  bottom: 150%;
  left: 50%;
  transform: translateX(-50%) scale(0.8);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: all 0.3s ease;
  z-index: 100;
}

.contribution-cell:hover::after {
  opacity: 1;
  transform: translateX(-50%) scale(1);
  bottom: 140%;
}

.legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
  margin-top: 8px;
}

.legend-cells {
  display: flex;
  gap: 2px;
}

.legend-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
}

.legend-cell.level-0 { background-color: #ebedf0; }
.legend-cell.level-1 { background-color: #9be9a8; }
.legend-cell.level-2 { background-color: #40c463; }
.legend-cell.level-3 { background-color: #30a14e; }
.legend-cell.level-4 { background-color: #216e39; }

.legend-cell:hover {
  transform: scale(1.3);
  box-shadow: 
    0 3px 6px rgba(0, 0, 0, 0.15),
    0 0 0 2px rgba(255, 255, 255, 0.8);
  border-radius: 3px;
  z-index: 5;
}

.legend-cell.level-0:hover { background-color: #d0d3d6; }
.legend-cell.level-1:hover { background-color: #7ae28a; }
.legend-cell.level-2:hover { background-color: #2ebd5b; }
.legend-cell.level-3:hover { background-color: #269945; }
.legend-cell.level-4:hover { background-color: #1a5c2d; }

.legend-cell::after {
  content: attr(title);
  position: absolute;
  bottom: 150%;
  left: 50%;
  transform: translateX(-50%) scale(0.8);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: all 0.3s ease;
  z-index: 100;
}

.legend-cell:hover::after {
  opacity: 1;
  transform: translateX(-50%) scale(1);
  bottom: 140%;
}

@media (max-width: 768px) {
  .stats {
    flex-direction: column;
    gap: 8px;
  }
  
  .contribution-cell {
    width: 10px;
    height: 10px;
  }
  
  .legend-cell {
    width: 10px;
    height: 10px;
  }
}
</style>