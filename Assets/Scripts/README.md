# 代码目录与依赖约定

当前只建立目录和程序集边界，未实现游戏玩法。每个 `AssemblyInfo.cs` 仅提供程序集职责说明，使没有业务脚本的程序集也可被 Unity 编译和引用；它们不是运行时组件。

```text
Assets/
├── Art/
│   ├── 2D/
│   │   ├── PixelAdventure1/       # 原素材包全部图片和原导入设置
│   │   ├── SnakePixelArt/         # SVG、PNG、动画片段、清单与说明
│   │   └── Rendering/            # 现有且仍被引用的 URP 配置
│   └── 3D/                       # 未来模型、材质和动画
├── Prefabs/
│   ├── 2D_Entities/
│   └── 3D_Entities/
├── Scenes/
│   └── Main.unity                # 原空白 SampleScene，保留相机与场景 GUID
└── Scripts/
    ├── Core/                     # 跨模块纯数据：逻辑坐标、状态、输入意图
    ├── Features/
    │   ├── Snake/                # Components / Systems / Authoring
    │   ├── Food/                 # Components / Systems / Authoring
    │   ├── Weather/              # Components / Systems / Authoring
    │   └── Skills/               # Components / Systems / Authoring
    ├── Input/                    # 输入设备适配；现有 Input Actions 资产
    └── View/
        ├── Common/               # 通用 UI、声音、效果
        ├── Mode2D/               # 2D 显示和坐标投影
        └── Mode3D/               # 3D 显示和坐标投影
```

## 程序集边界

| 程序集 | 可引用的本项目程序集 | UnityEngine |
| --- | --- | --- |
| SnakeGame.Core | 无 | 仅保留 DOTS 编译所需引用；业务代码禁止使用 |
| SnakeGame.Features | Core | 仅保留 DOTS 编译所需引用；业务代码禁止使用 |
| SnakeGame.Input | Core | 允许 |
| SnakeGame.View.Common | Core、Features | 允许 |
| SnakeGame.View.Mode2D | Core、Features、View.Common | 允许 |
| SnakeGame.View.Mode3D | Core、Features、View.Common | 允许 |
| SnakeGame.{模块}.Authoring（4 个） | Core、Features | 允许 |

另外按职责显式引用现有 DOTS、数学、集合、Burst、Transform 和 Input System 包。当前 Entities 版本要求引用 Entities 的程序集同时显式引用 `Unity.Collections`。

所有本项目程序集 `autoReferenced=false`，使用显式依赖。Core 不引用其他项目程序集，Features 只引用 Core，从编译依赖上禁止反向访问 Input、View 或 Authoring。

Unity 6000.5.9f1 / Entities 6.5.0 的 `EntitiesILPostProcessors.Initialize` 在 `noEngineReferences=true` 时产生空引用异常，实际编译验证后保留 `noEngineReferences=false`。这意味着 asmdef 不会硬性禁止使用 UnityEngine 类型；业务规范仍禁止 Core/Features 直接操作 GameObject、Transform、材质、SpriteRenderer 等表现 API。不要将这个包兼容设置误当成允许逻辑与表现耦合。

Authoring 在各功能模块内部，但各有独立 asmdef，不编入父级 Features 逻辑程序集。这里允许 MonoBehaviour、Baker 和预制体配置，并引用实际提供 Baker 的 `Unity.Entities.Hybrid`。

## 后续实现规则

1. Core 定义逻辑网格坐标与跨模块契约；2D/3D 世界坐标转换只放 View。共享玩法的两种显示模式不能改变逻辑碰撞、成长和吃果子的结果。真正三维的移动规则属于玩法变更，需单独设计。
2. 输入设备读取放 Input。Features 消费的输入意图组件放 Core，以免 Features 反向依赖 Input；设备按键和输入动作资产不进入玩法层。
3. 各模块纯数据放 Components，玩法运算与状态更新放 Systems。View 读取状态或事件控制显示；UI 产生的游戏指令通过 Core 契约交给玩法层处理。
4. Common 不引用 Mode2D 或 Mode3D，两种 Mode 也不互相引用。目录和 asmdef 只约束代码依赖；实际模式启用和打包筛选需在后续场景、系统启用规则或构建配置中实现。
5. 技能/天气通过共用能力数据、修饰量或事件对接。先设计扩展点；每加一个技能就修改 CollisionSystem 并不自动符合开闭原则。
6. 一个概念一份职责清晰的脚本。未实现的功能保留目录即可，不创建空 MonoBehaviour 或不工作的 System。

## 工程支持内容

可交付的蛇与草地美术资源集中在 `Assets/Art/2D/SnakePixelArt`。根目录 `Tools/SnakePixelArt`、`ArtPreviews` 和 `.idea` 属于本地工具、验收预览或 IDE 状态，均由 `.gitignore` 排除，不作为项目依赖。`Packages`、`ProjectSettings` 是工程配置；`Library`、`Temp`、`Logs`、`UserSettings` 是编辑器缓存或状态，由 Unity 自动维护。

清理范围为火箭演示资产与截图、Pixel Adventure 1 演示场景、默认 URP 场景模板。已有输入动作和 URP 配置保留并归入相应目录，保持项目设置引用有效。
