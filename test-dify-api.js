// Dify API 测试脚本
const DIFY_API_KEY = 'app-Vg3kxeMJHGPROlzKscALQHyX';
const DIFY_WORKFLOW_ID = 'Kxw3OfNFip28PJOh';
const DIFY_BASE_URL = 'https://dify.aipfuture.com/v1';

async function testDifyAPI() {
  console.log('🧪 开始测试Dify API连接...\n');
  
  // 测试数据
  const testContent = '这是一篇测试文章内容，用于验证Dify API连接是否正常。文章内容应该包含足够的信息让AI进行总结。';
  const testTitle = '测试文章标题';
  
  console.log('📋 测试配置:');
  console.log('- API密钥:', DIFY_API_KEY.substring(0, 10) + '...');
  console.log('- 工作流ID:', DIFY_WORKFLOW_ID);
  console.log('- API基础URL:', DIFY_BASE_URL);
  console.log('');
  
  try {
    console.log('📤 发送请求到Dify API...');
    
    const requestBody = {
      inputs: {
        article_content: testContent,
        article_title: testTitle,
      },
      response_mode: 'blocking',
      user: 'test-user',
    };
    
    console.log('📦 请求体:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(`${DIFY_BASE_URL}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log('📥 响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      console.log('❌ API请求失败');
      
      // 尝试获取详细错误信息
      try {
        const errorData = await response.text();
        console.log('📄 错误响应内容:', errorData);
        
        // 尝试解析JSON
        try {
          const jsonError = JSON.parse(errorData);
          console.log('🔍 解析后的错误信息:', JSON.stringify(jsonError, null, 2));
        } catch (parseError) {
          console.log('⚠️ 无法解析错误响应为JSON');
        }
      } catch (textError) {
        console.log('⚠️ 无法读取错误响应内容');
      }
      
      throw new Error(`Dify API 请求失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ API请求成功!');
    console.log('📊 响应数据:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.log('💥 测试失败:', error.message);
    
    // 提供诊断建议
    console.log('\n🔧 诊断建议:');
    console.log('1. 检查API密钥是否正确');
    console.log('2. 检查工作流ID是否正确');
    console.log('3. 检查Dify工作流是否已发布');
    console.log('4. 检查工作流的输入参数名称是否正确');
    console.log('5. 检查网络连接是否正常');
  }
}

// 运行测试
testDifyAPI().catch(console.error);