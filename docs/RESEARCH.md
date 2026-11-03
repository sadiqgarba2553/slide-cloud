# Slide Cloud: PowerPoint investigation and implementation direction

3 November 2026, Africa/Lagos. This research uses the installed PowerPoint as a reference for an original BlueCloud presentation editor. It does not recover or reproduce Microsoft's source code, assets, proprietary rendering engine or complete product behavior.

## Questions and evidence boundaries

| Question | Status | Evidence and consequence |
| --- | --- | --- |
| Which installed artifact was examined? | Answered | Windows file metadata and REA bind the executable below to one SHA-256. |
| What resources ship in the executable? | Answered within that file | REA traversed its complete bounded resource tree; most resources are icons. This is not an inventory of the entire Office installation. |
| Are relevant slide-editing concepts present in shipped localized resources? | Partially answered | A second explicit English resource DLL contains bounded string candidates for slide, layout, notes, shapes and related concepts. Strings do not prove enabled UI commands or behavior. |
| What are the core public presentation workflows and file-format concepts? | Answered from Microsoft documentation | Creation, editable slide objects, ordering/layout, notes, presenting and Open XML package parts inform the original implementation. |
| Has the installed PowerPoint UI, file round trip or rendering engine been observed executing? | Unresolved | No PowerPoint runtime, authentication, COM automation, decompilation or execution traces were used. No parity claim follows from this investigation. |

## Artifact identity and retained REA evidence

The selected installed target is `C:/Program Files/Microsoft Office/root/Office16/POWERPNT.EXE`, 1,917,272 bytes, file/product version **16.0.20527.20112**. Its SHA-256 is `4384fbd890bc21914b22ab310ccf4d68a224d42e757ae0b472078c2b26451d0f`. Windows FileVersionInfo reports Microsoft Office. This shell-derived identity is recorded separately in `research/powerpoint-identity.json`.

REA operation `inspect_pe_resources`, provider `rea-pe-resources` version 1, returned evidence **`ev_7cdbb533f7edbc2fd188f84d08e57a79bd5a3494b9d00ad432531090b5273d43`**. Its complete bounded traversal examined **507 directory entries and 250 resources**, reported PE32+ with machine value 34404 (AMD64), and retained payload offsets, byte ranges and hashes. The tree includes 233 icon payloads, 11 icon groups, version and manifest resources, plus three named resource types. It contains no RT_STRING table in this executable. Do not infer absence of slide features from the lack of those tables; most application behavior can reside elsewhere.

The observed adjacent English resource component `C:/Program Files/Microsoft Office/root/Office16/1033/PPINTL.DLL` was inspected separately. It is 272,640 bytes with SHA-256 `ac4282610ff7f2292b23cfdbef9162483b89282c77f162ac86e8d3c6c29544bd`. REA evidence **`ev_964809e3b20b899abd7fc23bd16b13ab257f48aa0381a4610044f2b7fab1741a`** records **354 entries and 172 resources**, including dialogs and custom resource types. Full opaque inventories are retained as `research/powerpoint-pe-resources.json` and `research/powerpoint-en-us-resources.json`. Icon-resource relationships are static candidates: actual language fallback, decoding and shell/window loading remain unobserved.

A separate ordinary Node script verified the localized DLL's digest, decoded non-icon payloads within the exact REA file ranges as UTF-8 and aligned UTF-16LE, and searched a finite set of literal terms. It found candidates in **26 resources**, including slide, presentation, animation, shape, notes, layout, picture, insert, save, print and template terms. `research/powerpoint-resource-keywords.json` records resource indexes and payload ranges without copying Microsoft's UI text. These are derived string candidates, not parsed control definitions, call paths, feature coverage or runtime observations.

The installed `1033/PPT_WHATSNEW.XML` declares an older feature-description release (`1706 JUNE`). Its identity and metadata are recorded in `research/powerpoint-whatsnew-metadata.json`. It describes such categories as cloud autosave, collaboration, 3D and animation, but is historical packaged metadata. It cannot establish present availability or justify advertising those capabilities in Slide Cloud.

No active disassembler target was opened, so there is no owned native analysis session to close. Original Office files were read without modification. No Microsoft images, binaries, source or UI resources are included in Slide Cloud's application assets.

## Public workflow and format reference

Microsoft's [basic presentation guide](https://support.microsoft.com/en-us/powerpoint/basic-tasks-for-creating-a-powerpoint-presentation) describes a sequence of creating a presentation, choosing layouts, adding and formatting text, inserting pictures/shapes, writing speaker notes and presenting. This supports prioritizing an editable ordered slide collection, visible creation controls, local saves and a real slideshow before advanced effects. These are public product workflows, not conclusions recovered from the executable.

Microsoft's [presenting guide](https://support.microsoft.com/en-us/powerpoint/training/give-a-presentation-in-powerpoint) distinguishes audience slides from speaker notes and documents previous/next navigation. Slide Cloud should keep notes out of its audience slideshow. A single-window slideshow is not equivalent to PowerPoint's multi-monitor Presenter View.

Microsoft's [PresentationML structure reference](https://learn.microsoft.com/en-us/office/open-xml/presentation/structure-of-a-presentationml-document) describes a presentation package with separate slide, layout, master, theme and optional notes parts. Slides may contain shapes, pictures, tables and other objects. This motivates a document model with ordered slides, positioned typed objects and separate notes. An import/export implementation must resolve package relationships and preserve presentation ordering rather than treating every XML filename as the slide order. Themes and inherited layout/master properties require explicit handling before claiming visual fidelity.

## Implementation choices for the first Slide Cloud edition

These are BlueCloud design and engineering choices, not recovered PowerPoint internals:

- Match Doc Cloud and Sheet Cloud's local-first library, editable templates, autosave wording, named history and native backups. Keep Slide Cloud's profile and file extension distinct.
- Use the supplied orange presentation artwork as a squircle app logo. Use original UI, restrained spacing and solid colors consistent with its siblings.
- Provide editable text, simple shapes and locally embedded raster images; moving, resizing and ordering objects must change the real document model.
- Implement add, duplicate, reorder and delete slides; undo/redo; clear selection; keyboard navigation; a slide list with thumbnails; notes; and a slideshow with explicit exit controls.
- Support a versioned native format for full supported data. Preserve original imported PPTX bytes when possible and clearly describe any conversion limits.
- Implement and test a bounded PPTX exchange subset. Exported presentation packages must be independently inspected for ordering, text, geometry and notes rather than merely checking a ZIP signature.
- Keep print/PDF output tied to actual slide content. Ensure notes do not accidentally appear in audience slides or slide-only PDF output.
- Enable the launcher only after an actual Windows package, its public download and signed feed record pass verification. Retain the same app-owned repository and integrity conventions as the other BlueCloud apps.

Advanced animations/transitions, 3D, video/audio editing, SmartArt, rich chart/table exchange, complete masters/theme inheritance, macros, arbitrary legacy PPT conversion, secure hosted collaboration, multi-monitor presentation and full PowerPoint compatibility remain separate future work. No feature is complete solely because a string, documentation page or toolbar label mentions it.

## Verification obligations

1. Create/edit, reload and recover a native deck without losing object positions, text, slide order or notes.
2. Exercise object manipulation and history through real UI input; ensure keyboard editing does not delete objects while typing.
3. Import/export an actual PPTX fixture and independently inspect its OOXML parts, relationships and content. Keep unsupported-feature notices visible and honest.
4. Present and navigate a real deck; ensure notes remain private to the editor and Escape exits predictably.
5. Inspect desktop and smaller layouts, keyboard/focus behavior, app logo and native WebView runtime.
6. Build the Windows release, verify its managed package bytes and install/open it through the launcher in an isolated test profile.

The parent implementation and test reports establish which of these obligations are met. This research alone certifies none of them.
