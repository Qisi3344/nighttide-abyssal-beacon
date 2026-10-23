# 架构说明

## 分层

```
SIM(纯逻辑,零依赖,可 node --test)     VIEW(three.js/DOM/WebAudio)
┌──────────────────────────┐          ┌────────────────────────┐
│ GameStateMachine 状态机    │◄─事件───►│ UIManager(DOM 界面)      │
│ OxygenSystem 氧气         │          │ App3D 渲染器+后期链       │
│ Objectives 任务           │          │ Terrain/Environment/Flora│
│ PredatorBrain AI 决策     │◄─感知/意图─│ Gameplay(交互组装)       │
│ RNG / SaveSystem / Input  │          │ Player/CameraRig/Predator│
└──────────────────────────┘          │ AudioSystem(WebAudio)    │
                                      └────────────────────────┘
              EventBus 串起两层(松耦合,UI/音效全靠订阅)
```

- `data/WorldData.js` 是关卡布局的**单一事实来源**:信标/光晶/氧藻/守卫航点/区域半径全部在此,SIM 消费坐标做逻辑,VIEW 消费同一份数据建场景。改地图只改这一个文件。
- SIM 层没有任何 three.js 引用——`node --test` 直接跑,33 个用例覆盖状态机/氧气/任务/AI 决策表/RNG/存档。

## 关键实现

### 地形 = 解析高度场
`Terrain.heightAt(x,z)` 是纯函数(fbm 噪声 + 海沟边缘抬升 + 功能区压平)。mesh 顶点采样同一函数 → **视觉与碰撞永远一致**,玩家物理直接调函数,无需射线检测。

### 主循环双驱动(看门狗)
rAF 优先;检测 rAF 停滞 >250ms(嵌入式 webview 失焦场景)自动切换 setTimeout(16ms) 驱动,rAF 恢复后让位。帧间重入用 8ms 阈值保护。

### 程序化角色
- 潜水员:胶囊躯干+玻璃头盔+双氧气瓶+SpotLight 头灯;四肢为枢轴挂点,游泳摆频 ∝ 归一化速度(静止漂浮/巡航/冲刺三档体态)。
- 守卫:头锥+可张合双颚+14 节身体链;每节向前节位置收敛(节距 1.35m)+相位递增正弦侧摆 → 蛇形游动;眼亮度 ∝ dangerLevel。

### 粒子三层
- 微尘 1400 + 孢子 320:ShaderMaterial 顶点动画(GPU,零每帧 CPU)
- 气泡 260:CPU 池化复用,槽位循环写 buffer

### 音频零素材
WebAudio 合成:环境=失谐双正弦(52/52.7Hz 差拍)+ LFO 白噪海流;声纳 ping=880→440 扫频;心跳随氧气余量加速;守卫低吼=saw+waveshaper 失真+下扫。

## 扩展指南

- **新关卡/换图**:改 `WorldData.js`(加信标/挪氧藻/守卫航点),Terrain/Environment 自动适配(信标塔/光晶/氧藻都是数据驱动生成)。
- **新敌人**:复制 PredatorBrain 模式——纯决策脑(单测)+ Model 类(视觉/运动),在 Gameplay.update 里组装感知。
- **流式响应/手柄**:Input 是唯一输入门面,加 `gamepad` 轮询分支即可;相机 rig 已与输入解耦。
- **多关卡存档**:SaveSystem 已有版本化 key(nighttide.save.v1),加 run 进度字段即可。
