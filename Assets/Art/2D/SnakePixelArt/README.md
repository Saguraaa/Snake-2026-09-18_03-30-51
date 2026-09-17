# 贪吃蛇像素资产

原创 SVG 像素绘制，配色参考本项目的 Pixel Adventure 1：Terrain 的草地，以及 Main Characters 的亮青蓝色、深色轮廓和角色表情。地下土层使用你已有的资产。本套素材位于 `Assets/Art/2D/SnakePixelArt`，参考素材位于 `Assets/Art/2D/PixelAdventure1`。

## 内容

- `SVG/Grass`：16 张草地图块，包含完整 9 宫格、4 个凹角、3 张额外中心变化。
- `SVG/Snake/Head`：四方向蛇头。
- `SVG/Snake/Body`：横向、纵向、四种 90 度弯角。
- `SVG/Snake/Tail`：四方向蛇尾，文件名方向表示前进方向，尖端位于后方。
- `SVG/Fruit`：原创得分苹果，保留最初需求。
- `SVG/Animations/Frames`：112 张独立动画帧。
- `SVG/Animations/Sheets`：8 组蛇头转向、8 组蛇尾转向、4 组蛇头眨眼待机，共 20 张横向图集。
- `SVG/Atlases/grass_atlas_4x4.svg`：草地总图集。顺序见 `manifest.json` 的 `grassAtlasOrder`。
- `PNG`：与 SVG 一一对应的无抗锯齿 PNG；已经附带像素图的 Unity 导入设置。
- `UnityAnimations`：20 个已在 Unity 中生成的 `.anim` 片段，可用于头、尾对象上的 Animator；转向不循环，待机循环。
- `manifest.json`：资产清单、尺寸、方向、逐帧时长和配色。

## 尺寸与 Unity

草地为 16×16 像素，蛇和果子的画布为 32×32。统一采用 **16 Pixels Per Unit**，因此草地图块为 1 个世界单位，蛇的一个移动格为 2 个世界单位，正好覆盖 2×2 个地形格。所有素材中心轴点为 (0.5, 0.5)。不要把蛇和草地用不同的缩放倍率，以免像素大小不一致。

PNG 使用 Sprite、Point 过滤、无压缩、关闭 mipmap、Clamp。独立帧可以直接使用；横向图集默认作为整张 Sprite 导入，如需手动切片，角色图集按 32×32 切片，草地图集按 16×16 切片。项目当前没有配置 SVG Sprite 的专用导入器，因此 Unity 内优先使用 PNG，SVG 保留为可编辑源文件。

草地是俯视的草皮上表面。透明边缘可叠在已有的土层或背景之上。图块覆盖普通矩形区域和凹角；一格宽的孤立草地、单格岛屿或复杂自动铺砖的完整 47 种组合不在本套 16 张范围内。

## 动画与连接

转向每组 6 帧，总时长 250 ms，顺序为起始姿态、蓄力、转弯前半段、转弯后半段、轻微过冲、目标姿态。具体时长为 35 / 35 / 45 / 45 / 40 / 50 ms。首尾帧与对应静态方向完全一致。SVG 为静态帧和图集，实际播放由动画播放器完成，不包含 SMIL 动画。

`UnityAnimations` 已绑定独立 PNG 帧的 SpriteRenderer `Sprite` 属性。为保证最后一帧的停留时长，片段末尾另有一个重复的结束关键帧，因此 6 张转向图对应 7 个关键帧。这些片段不包含 Animator Controller 或游戏控制脚本。

待机包含 4 帧，总时长 1.2 s，保留睁眼、呼吸、眨眼和恢复。帧顺序从左到右，独立帧从 `_0` 开始。

头和尾的转向片段分别播放在头、尾的 SpriteRenderer 上。**蛇尾到达路径拐点时才播放蛇尾转向**，不要与蛇头同时转。中间身体按相邻两个路径点选择直线或弯角；`body_corner_left_up` 表示连接左边和上边，其余名称同理。动画资产不包含移动逻辑，游戏网格位置应与美术播放分开更新。若一格的移动时间少于 250 ms，应相应提高转向动画播放速度。

俯视 2D 可直接使用 SpriteRenderer / Tilemap。3D 场景可将同一组 PNG 作为平面或公告板的像素贴图；这些 SVG/PNG 本身不是立体模型。

## 预览与编辑

项目根目录的 `ArtPreviews/SnakePixelArt/index.html` 可以直接打开，查看地图拼接、所有草地图块以及逐帧动画，可暂停、选择帧和调整速度。`contact-sheet.png` 为总览。

绘图源文件位于 `Tools/SnakePixelArt/build-assets.cjs`。需要 Node.js 和 sharp；重新生成会更新本目录中的 SVG/PNG，保留已有 PNG 的 Unity GUID。现有 Pixel Adventure 1 文件不需要修改。
