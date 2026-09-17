# Project architecture

- Organize gameplay by feature under `Assets/Scripts/Features/{Snake,Food,Weather,Skills}`. Each feature has `Components`, `Systems`, and `Authoring`.
- Core contains shared pure data and contracts; Features contains simulation. Neither may depend on Input adapters, View, or Authoring. Gameplay source must not use UnityEngine presentation APIs. Keep `noEngineReferences=false` for the current Entities 6.5.0 code generator, which fails without engine metadata; this is not permission to couple simulation to presentation.
- Authoring is the explicit exception inside each feature folder: separate child asmdefs contain MonoBehaviour/Baker configuration and depend on Core/Features, never the reverse.
- Input reads devices and publishes shared intent contracts from Core. View reads simulation state/events and renders it. Keep game rules, scoring, movement, collision, spawning, weather effects and skill state out of View.
- Separate `View/Common`, `View/Mode2D` and `View/Mode3D`; Common must not depend on either mode. Rendering modes share the same logical simulation. Folder layout alone does not enable/disable systems or select build content.
- Put art in `Assets/Art/2D` or `Assets/Art/3D`, presentation prefabs in `Assets/Prefabs/2D_Entities` or `3D_Entities`, and game scenes in `Assets/Scenes`.
- Use explicit asmdef references. Read `Assets/Scripts/README.md` for the current dependency map.
- Preserve asset GUIDs and .meta files when moving assets. Keep animation sprite references and project render/input configuration valid.
- Asset generators in `Tools/SnakePixelArt` and previews in `ArtPreviews/SnakePixelArt` belong to the art workflow. Do not generate art back into the old Assets/SnakePixelArt directory.
- Implement only the requested scope. Do not create dummy gameplay Systems or MonoBehaviours merely to fill directories.
