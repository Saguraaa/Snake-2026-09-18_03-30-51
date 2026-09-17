# AGENTS.md - AI 协作编码与架构指南

## 1. 适用范围与项目基线

本文件作用于整个仓库。更深层目录中的 `AGENTS.md` 可以补充局部规则，但不得放宽本文件的架构红线。若用户指令与本文件的禁止项冲突，必须暂停相关实现，指出具体冲突并等待用户决定；不要自行绕过规则。

本项目是使用 Unity DOTS/ECS 和混合渲染构建的空间拓展贪吃蛇，支持 2D 与 3D 两种表现。逻辑空间使用可扩展的离散 Z 层表达地表、地下与空中空间。架构采用数据、业务逻辑、输入适配、Authoring 和表现层单向依赖，而不是传统 GameObject 驱动的 MVC。

当前经过验证的工程基线：

- Unity `6000.5.9f1`
- Entities `6.5.0`
- Input System `1.20.0`
- URP `17.6.0`
- 现有程序集依赖见 `Assets/Scripts/README.md`

除非用户明确要求升级，否则不得自行更改上述包版本。

### 1.1 当前项目状态（动态上下文）

最后核对日期：`2026-09-18`。

- **已完成**：清理并整理 Unity 工程目录；建立 Core、Features、Input、Authoring、View 的 asmdef 边界；保留 Pixel Adventure 1 参考素材和既有地下图层；完成蛇头、蛇身、蛇尾、果子、16 张草地图块、转向/待机动画的 SVG 与 PNG 资产及 Unity 动画片段。
- **当前阶段**：架构骨架与首批 2D 美术资产已经就绪。`Assets/Scripts` 中目前只有程序集说明与输入动作资产，尚未实现实际玩法 Component、System、Baker、2D/3D 同步或可玩场景。
- **下一里程碑**：先完成确定性的最小可玩闭环，包括网格配置、输入意图、蛇移动与成长、碰撞、食物生成、得分和基础 2D 表现；这些逻辑必须为后续地下层、跳跃、飞行能力和 3D 表现保留扩展入口。
- **当前已知约束**：Core/Features 的 `noEngineReferences=false` 是 Entities `6.5.0` 代码生成兼容要求；它不改变本文件规定的逻辑层边界。

本节用于让新会话快速了解项目所处阶段，必须只写经过仓库或 Unity 编辑器验证的事实，不使用主观完成百分比。每当任务改变“已完成、当前阶段、下一里程碑或已知阻塞”时，必须在同一改动中更新本节的日期和对应条目。文件级待办、验收清单和开发日志不堆积在本文件中；内容超过一个简短快照时，写入根目录 `PROJECT_STATUS.md`，本节只保留摘要和链接。项目进度不是架构决策，不写入 ADR。

#### PROJECT_STATUS.md 读取与同步规则

1. 开始实现任务前，如果根目录存在 `PROJECT_STATUS.md`，必须先读取它，了解当前阶段、下一里程碑、已知阻塞和验收状态。
2. `PROJECT_STATUS.md` 只提供动态项目上下文，不能覆盖用户指令、本文件的架构规则或已经生效的 ADR。内容发生冲突时，以用户指令和适用范围内优先级更高的规则为准，并指出状态文件已经过期。
3. 当任务完成一项可验收能力、改变里程碑状态、产生或解除阻塞，或者改变已经确定的下一步计划时，必须在同一改动中同步更新 `PROJECT_STATUS.md` 与本节摘要。
4. 只读调查、未改变项目阶段的普通 Bug 修复、格式调整或未完成的尝试不更新项目状态。所有状态必须以仓库内容、Unity 编辑器结果或测试结果为依据，不能根据计划推测完成情况。
5. `PROJECT_STATUS.md` 记录当前事实和近期执行上下文；结构性决策及其原因仍记录在 `AI_ARCHITECTURE_LOG.md`，两者不得互相替代。

本文中的关键词含义：

- **必须 / 严禁**：不可自行例外。
- **默认**：应按此执行；确有技术原因时，需要说明原因并采用影响最小的替代方案。
- **需要确认**：先完成只读调查，给出具体改动范围和影响，取得用户对该项改动的明确授权后再执行。当前会话中已经给出的明确授权持续有效，不重复询问。

## 2. 目录职责与依赖方向

```text
Assets/Scripts/
├── Core/                         # 跨模块的纯数据与稳定契约
├── Features/                     # 玩法数据与模拟系统
│   ├── Snake/
│   │   ├── Components/
│   │   ├── Systems/
│   │   └── Authoring/
│   ├── Food/
│   ├── Weather/
│   └── Skills/
├── Input/                        # 输入设备到 ECS 意图的适配
└── View/
    ├── Common/                   # UI、音效、通用表现
    ├── Mode2D/                   # 2D 表现同步
    └── Mode3D/                   # 3D 表现同步
```

唯一允许的业务依赖方向：

```text
Core <- Features
Core <- Input
Core + Features <- Authoring
Core + Features <- View.Common <- View.Mode2D
Core + Features <- View.Common <- View.Mode3D
```

具体规则：

1. `Core` 不依赖任何其他项目业务程序集，只存放跨模块共享且稳定的数据和协议。不要把 Core 变成所有类型的收纳目录。
2. `Features` 可以依赖 Core，不得依赖 Input、View 或 Authoring。
3. Feature 自有数据放在对应 Feature 的 `Components`，只有被多个模块共同使用的契约才放 Core。
4. `Input` 读取设备状态并写入 Core 定义的意图数据，不直接修改蛇的位置、得分、天气或技能状态。
5. `Authoring` 只负责编辑器配置与 Baking。它可以使用 `MonoBehaviour`、`Baker<T>` 和 Unity 对象，但不得承载运行时玩法逻辑。
6. `View` 只读取逻辑状态或消费表现事件。除创建意图实体外，不得写入具有玩法权威性的组件。
7. `View.Common` 不依赖 Mode2D 或 Mode3D；Mode2D 与 Mode3D 不得互相引用。
8. 当前 Snake、Food、Weather、Skills 共用 `SnakeGame.Features` 程序集，编译器无法阻止兄弟模块直接耦合。即使处于同一程序集，模块间仍必须通过 Core 契约、事件实体或明确的数据组件通信。
9. 如需把每个 Feature 拆成独立 asmdef，必须先确认，并在同一改动中记录 ADR。

美术、预制体和场景固定放置在：

- `Assets/Art/2D`
- `Assets/Art/3D`
- `Assets/Prefabs/2D_Entities`
- `Assets/Prefabs/3D_Entities`
- `Assets/Scenes`

## 3. 绝对禁止事项

### 3.1 Core 与 Features 中禁止托管玩法模型

`Core` 和 `Features` 中严禁：

- `class` 形式的运行时玩法数据或系统。
- `MonoBehaviour`、`ScriptableObject`、`SystemBase`。
- virtual/abstract 运行时多态和玩法继承树。
- 托管委托、闭包、反射、装箱和热路径 LINQ。
- 使用全局静态可变状态保存游戏状态。

允许使用：

- `struct`、`readonly struct`、静态纯函数。
- DOTS 必需的 `ISystem`、`IJobEntity`、`IComponentData`、`IBufferElementData` 等接口。
- 不产生托管状态的泛型辅助代码。

如确实需要托管桥接，只能放在 Input、View、Authoring、Editor 工具或测试中，并且不能成为玩法状态的唯一真值来源。

### 3.2 Component 必须是非托管数据

Core/Features 中的 `IComponentData`、`IBufferElementData` 和共享玩法数据必须是 `unmanaged struct`。

可以使用数值类型、枚举、`Entity`、`int2/int3`、`float2/float3`、`quaternion`、`FixedString`、`FixedList` 和 `BlobAssetReference<T>` 等 DOTS 安全值类型。

严禁在组件字段中存放：

- `string`、数组、`List<T>`、`Dictionary<TKey,TValue>`。
- 委托、接口实例或任意托管对象。
- `GameObject`、`Transform`、`Sprite`、`Material`、`Mesh`、`AudioClip` 等 `UnityEngine.Object`。
- 具有不清晰所有权的 `NativeArray`、`NativeList` 等原生容器。实体可变列表使用 `DynamicBuffer<T>`，只读共享大数据优先使用 Blob Asset。

### 3.3 逻辑层不得调用表现层

Core/Features 严禁：

- 引用任何 `SnakeGame.View.*` 程序集或类型。
- 操作 Sprite、Mesh、Renderer、Material、Animator、AudioSource、Camera、UI 等表现 API。
- 读取或修改 GameObject Transform 作为碰撞、移动或得分依据。
- 通过回调、静态事件或全局管理器把逻辑状态主动推送到 View。

表现层必须读取 ECS 数据；逻辑层不知道最终显示为 2D 还是 3D。

### 3.4 逻辑数学不得使用 UnityEngine 数学类型

Core/Features 禁止使用：

- `UnityEngine.Mathf`
- `UnityEngine.Vector2/Vector3`
- `UnityEngine.Quaternion`
- `UnityEngine.Random`
- 依赖渲染帧率的 `Time.deltaTime`

必须使用 `Unity.Mathematics` 的 `math`、`int2/int3`、`float2/float3`、`quaternion` 和可复现种子的 `Unity.Mathematics.Random`。

### 3.5 禁止盲改

修改任何已有文件前，必须完整读取该文件。修改公共 Component、Buffer、事件或状态契约前，还必须搜索并检查：

- 所有读取与写入它的 System。
- 所有 View 同步代码。
- 所有 Baker、Authoring、Prefab/SubScene 和序列化数据。
- 相关测试、asmdef 和命名空间。

不得根据文件名或片段臆测完整实现。

## 4. 实行前必须确认

以下事项需要用户确认：

1. 新增或删除 asmdef，或更改 asmdef 的 references、平台、`autoReferenced`、`noEngineReferences`、Define Constraints 等依赖行为。
2. 安装、删除或升级 Unity Package、第三方库、源码插件和外部服务 SDK。
3. 引入新的跨项目设计模式、代码生成器、DI 容器或全局单例管理器。
4. 对移动、碰撞、成长、食物生成、天气、技能等现有核心系统进行大规模重构。
5. 改变逻辑坐标语义、固定 Tick 模型、跨模块协议、事件生命周期或 2D/3D 映射约定。
6. 删除或批量迁移现有场景、Prefab、资源或序列化数据。

请求确认前必须先完成只读分析，并说明：拟修改文件、依赖变化、迁移方案、风险、验证方案以及可回退方式。用户已经明确授权的同一项操作无需重复确认。

特别说明：当前 Entities `6.5.0` 的代码生成器在本项目中使用 `noEngineReferences=true` 会在 IL Post Processing 阶段发生异常。因此 Core 和 Features 当前保留 `noEngineReferences=false`。不得擅自“修复”此设置；这只是包兼容要求，不代表允许逻辑层使用 UnityEngine 表现 API。

## 5. 逻辑空间与两个世界

### 5.1 GridPosition 是空间真值

逻辑位置必须使用离散的 `int3`。约定：

- `x`、`y` 表示当前逻辑层内的水平网格坐标。
- `z = 0` 是地表参考层。
- `z < 0` 表示地下空间，可以包含 `-1`、`-2` 等多个独立地下层。地下层是与地表同等地位的可游玩地图层，不只是地表的视觉偏移。
- `z > 0` 表示地表以上的高度或空中层。当前近期玩法只计划用正向 Z 表达跳跃，但坐标模型必须允许未来加入持续飞行、多个空中高度或空中地图。
- Z 没有预设的全局最小值或最大值。具体地图开放哪些层、层之间如何连接、实体能否进入某层，由地图数据、移动规则和能力组件共同决定。
- 系统不得仅根据 Z 的正负推断实体状态：不能把所有 `z > 0` 永久等同于“正在跳跃”，也不能把所有 `z < 0` 当成同一个地下空间。
- 碰撞、占用、食物、天气和技能判定比较完整 `int3`，不能只比较 `x/y`。

在既有坐标、移动和碰撞协议内增加地图层或能力，不会仅因为 Z 超过 `1` 或小于 `-1` 而自动成为架构变更。改变 Z 的数据表示、层级拓扑含义、跨层移动协议、碰撞规则或 2D/3D 映射契约，才需要确认并记录 ADR。

世界坐标只在 View 中从逻辑坐标转换：

- Mode2D 决定如何用 Sprite、排序、缩放或视觉偏移表达 Z 层。
- Mode3D 决定如何映射到真实三维世界坐标。
- View 插值、动画和 Transform 永远不得反写 `GridPosition`。
- 同一份 ECS 逻辑状态在 2D 与 3D 下必须得到相同的移动、碰撞、成长和得分结果。

### 5.2 固定逻辑 Tick

移动、碰撞、进食、生成、天气和技能持续时间必须以固定模拟 Tick 为准，不能依赖渲染帧率。

实现相关功能时必须明确并测试系统顺序。默认数据流为：

```text
采集输入 -> 生成/更新意图 -> 消费意图 -> 移动 -> 碰撞与进食
-> 成长/生成/状态结算 -> 产生表现事件 -> 事件清理 -> View 表现
```

需要改变该顺序时，使用明确的 SystemGroup 和 `UpdateBefore/UpdateAfter`，并记录 ADR。输入是否合法（例如禁止直接反向）属于 Features 规则，不应由设备输入层决定。

随机生成必须使用可控制的种子。测试与重放场景中，相同初始状态和相同输入序列必须得到相同结果。

## 6. 跨层通信规则

### 6.1 Input/UI -> ECS

Input 或 UI 只能创建、更新 Core 定义的意图组件、意图 Buffer 或请求实体，例如移动、暂停、重新开始。它们不得直接修改 `GridPosition`、蛇身 Buffer、得分或碰撞结果。

使用 `EntityManager` 前必须确认目标 World 存在且有效。不得用永久静态字段缓存 World、EntityManager 或 Entity，除非生命周期和 Domain Reload 行为已经被明确处理。

### 6.2 View <- ECS

View 可以使用 MonoBehaviour，也可以使用运行在表现阶段的 ECS System。两者都必须遵守：

- 只读取玩法权威数据。
- 只写表现专用组件、GameObject 状态、材质、动画、音频和 UI。
- 不在 View 中实现移动合法性、碰撞、得分、生成概率、技能效果等规则。
- 不因 2D/3D 表现差异创建两套玩法状态。

“只有 View/Authoring/Input 可以按需使用 OOP 和 MonoBehaviour”不等于“View 必须全部使用 MonoBehaviour”。大量实体的显示同步优先使用批量 ECS 表现系统；UI、相机和少量桥接可使用 MonoBehaviour。

### 6.3 瞬发事件

受击、进食、音效、特效等瞬发通知使用事件实体或事件 Buffer。事件寿命定义为一个**模拟 Tick**，不是一个渲染帧。

每种事件必须明确：

- 生产系统。
- 一个或多个消费系统。
- 系统更新顺序。
- 唯一清理系统。

消费者不得自行提前销毁多消费者事件。清理系统必须在所有消费者之后统一销毁或清空事件。跨多个 Tick 的状态不得伪装成事件，应使用普通组件并明确生命周期。

## 7. DOTS、Burst 与内存规则

1. Features 中的模拟系统优先使用 `partial struct : ISystem` 与 `IJobEntity`。
2. 模拟 `ISystem` 和 `IJobEntity` 默认必须兼容 Burst，并在适用的类型和方法上添加 `[BurstCompile]`。
3. 无法 Burst 的代码应优先隔离到 Input、View 或 Authoring。必须留在 Features 时，要用短注释说明技术原因，且不得处于高频热路径。
4. Burst 上下文禁止托管字符串、托管集合、异常驱动流程、反射、装箱和托管日志。
5. 调度 Job 时必须传入并回写依赖，例如 `state.Dependency = job.ScheduleParallel(state.Dependency)`。不得丢失 JobHandle。
6. 在 Job 或实体迭代期间进行结构变更时使用合适播放点的 `EntityCommandBuffer`；不得在并行 Job 中直接调用 EntityManager 做结构变更。
7. 查询应准确声明只读/读写访问。能并行且无写冲突的模拟优先 `ScheduleParallel`。
8. `Allocator.Temp` / `TempJob` 分配使用明确作用域并及时 Dispose；`TempJob` 必须在允许的帧数内、相关 Job 完成后释放。
9. `Allocator.Persistent` 的所有者必须明确，并在 System `OnDestroy` 或对应生命周期终点释放。
10. `BlobAssetReference<T>` 必须明确创建者、持有者和释放责任。Baker 创建并交由 BlobAssetStore 管理的 Blob 不得由运行时系统重复释放。
11. 禁止在每 Tick 热路径创建托管对象、字符串或临时 GC 集合。

## 8. Authoring、Baking 与资源规则

- Authoring 字段只表达设计配置；运行时数据必须由 Baker 转换为 ECS 组件、Buffer、Blob 或实体引用。
- Baker 不实现运行时玩法规则，不缓存运行时 World 状态。
- Entity Prefab、SubScene 和普通 GameObject Prefab 的职责要清楚，不隐式依赖场景中的对象名称查找。
- 移动 Unity 资源时必须连同 `.meta` 保留 GUID。优先使用 Unity AssetDatabase/MCP 资源接口，并检查场景、Prefab、动画和项目设置引用。
- 删除资产前先解析准确目标、搜索引用并说明恢复方式。不得删除 `Packages`、`ProjectSettings` 或 Unity 工程缓存来规避编译问题。
- 项目只提交位于 `Assets/Art/2D/SnakePixelArt` 的可编辑 SVG、Unity 使用的 PNG、动画片段、清单和说明。根目录 `ArtPreviews` 与 `Tools/SnakePixelArt` 属于本地生成或验收工作区，必须保持忽略，不得被游戏代码或资源引用。

## 9. 命名与代码组织

- 命名空间与程序集保持一致，使用 `SnakeGame.*`。
- Component 使用描述数据含义的名词；Tag 使用清晰的 `...Tag`；Buffer 元素使用 `...Element`；请求/意图使用 `...Request` 或 `...Intent`；一次性通知使用 `...Event`。
- System 使用职责明确的 `...System`。一个 System 只承担一个可描述的阶段职责。
- 不创建 `GameManager`、`SingletonManager` 等全局管理类。全局状态优先使用 Singleton Entity，但仍需明确创建、唯一性和销毁规则。
- 不为填充目录创建空 MonoBehaviour、空 System 或没有调用方的抽象层。
- 注释解释约束、原因和不明显的数据流，不复述代码表面行为。

## 10. AI 工作流程

### 10.1 修改前

1. 完整读取目标文件和作用域内的 `AGENTS.md`。
2. 检查 Unity 编辑器状态、当前场景和编译状态。
3. 搜索受影响类型、调用方、Baker、View、测试和资源引用。
4. 检查当前 asmdef 边界，确认改动不会形成反向依赖或循环依赖。
5. 检查工作区已有改动，保留用户未要求修改的内容。
6. 若涉及“实行前必须确认”的事项，完成分析后暂停依赖该确认的写操作。

### 10.2 修改中

1. 保持改动范围与用户目标一致。
2. 先修改数据契约，再修改生产者、消费者、Authoring/View 和测试。
3. 不通过复制逻辑给 2D/3D 各写一套规则。
4. 不用关闭 Burst、安全检查或删除包缓存来掩盖错误。
5. 每完成一个可验证阶段就检查编译或静态引用，不把全部问题留到最后。

### 10.3 修改后

至少完成与改动相称的验证：

1. 等待 Unity 编译与 Domain Reload 完成。
2. 检查 Console 中新增的 error 和相关 warning。
3. 运行受影响的 EditMode/PlayMode 测试；没有测试时说明缺口。
4. 对移动、碰撞、进食、随机生成和 Z 层变化进行确定性验证。
5. 涉及 View 时分别验证 2D 和 3D，确保逻辑结果一致。
6. 涉及资源时验证 GUID、丢失脚本、动画 Sprite、Prefab/Scene 引用。
7. 检查最终 diff，确认没有无关重排、生成文件或资产删除。

在编译失败、测试失败或已知数据迁移未完成时，不得宣称任务完成。最终报告必须说明改动、验证结果以及剩余风险。

## 11. 架构决策记录（ADR）

根目录 `AI_ARCHITECTURE_LOG.md` 用于记录已经实施的结构性决策。普通 Bug 修复、数值调整、文案、局部 UI 修改和不改变协议的逻辑完善不记录。

以下情况必须在同一改动中追加 ADR：

1. 新建或重构核心 Component、Buffer 或 System。
2. 改变跨模块或跨层通信协议。
3. 引入新的全局状态、Singleton Entity、关键 Tag 或状态机。
4. 改变逻辑坐标的数据表示或拓扑语义、固定 Tick、系统排序、事件生命周期或 2D/3D 映射。
5. 新增模块、拆分程序集、改变 asmdef 依赖或引入 Package/第三方库。
6. 替换已有架构决策或让旧 ADR 失效。

记录必须说明为什么这样做、数据如何流动、代价是什么以及怎样验证。不要只列文件清单。使用以下格式：

```markdown
### [YYYY-MM-DD] 架构变更: {主题}
- **状态**: Accepted | Superseded
- **核心影响模块**: {模块或程序集}
- **设计决策 (Why)**: {问题、约束与选择原因}
- **数据流向与实现 (How)**:
  1. {生产者或入口}
  2. {处理流程与状态所有者}
  3. {消费者与清理方式}
- **已知代价与替代方案**: {取舍及未采用方案}
- **验证方式**: {编译、测试、场景或确定性验证}
- **替代/废弃的旧决策**: {无则写“无”}
- **给未来 AI 的提示**: {必须保持的不变量和扩展入口}
```

若 `AI_ARCHITECTURE_LOG.md` 尚不存在，在首次满足触发条件的改动中创建它。修改尚未完成的同一项决策时更新该条记录；已经落地并进入后续开发的决策发生变化时追加新记录，并将旧记录标为 Superseded。
