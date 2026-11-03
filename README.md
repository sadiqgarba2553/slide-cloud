# Slide Cloud

A free, local-first presentation editor by BlueCloud AI Technologies. Slide Cloud is the orange presentation sibling of Doc Cloud and Sheet Cloud, using the supplied presentation artwork and the same squircle icon treatment.

This is an unsigned Windows alpha development edition with a bounded presentation feature set, not complete Microsoft PowerPoint compatibility. The PowerPoint investigation is documented separately in `docs/RESEARCH.md`; static metadata does not establish runtime behavior or source equivalence.

## Run

Requires Node.js 22.12+; Node.js 24 is used for the Windows development environment.

```powershell
npm ci
npm run dev
```

Open `http://127.0.0.1:1440`. Keep the same hostname and port to access the same browser-local library.

## Presentations and backups

Create a blank presentation or start from an editable template. Slide Cloud's local workspace supports text, shapes, images, slide organization, notes and slideshow presentation. Save native `.slidecloud` backups to retain the supported editable model. Browser and desktop local libraries do not automatically synchronize across devices.

PPTX import/export is a compatibility subset. Unsupported features such as animations, transitions, embedded media, SmartArt, master/theme inheritance and full PowerPoint text layout are not preserved. Keep originals and native backups of important work. Do not assume that imported files are fidelity-equivalent to PowerPoint output. See `docs/KNOWN_LIMITATIONS.md` and the current validation report for the measured scope.

## Desktop

Windows requires Rust, Microsoft C++ Build Tools and Microsoft WebView2. Build with one compiler job on this memory-constrained development host:

```powershell
$env:CARGO_BUILD_JOBS = '1'
npm run tauri dev
npm run tauri -- build --bundles nsis
```

Generated native packages are in `src-tauri/target/release/bundle`. The adjacent Doc Cloud Cargo target directory can be used as a build cache by setting `CARGO_TARGET_DIR` to its absolute target path; this does not create a runtime or source dependency on Doc Cloud. macOS/Linux builds require their corresponding hosts and have not been verified by these Windows configuration files.

Native file dialogs use the `read_binary_file` and `write_binary_file_atomic` commands. Reads enforce a 50 MB input limit. Writes use a temporary file in the destination directory, flush it and atomically replace the selected target. File-association metadata is registered by the installer; opening a presentation from a shell association is not claimed implemented unless confirmed in the validation report.

## Verify

```powershell
npm test
npm run build
npm audit
cargo test --manifest-path src-tauri/Cargo.toml -j 1
```

The production build generates `public/THIRD_PARTY_NOTICES.txt` and `docs/DEPENDENCY_LICENSES.json` from installed production packages. JSZip's MIT option is selected. Installed dependency inventories can include code that is not bundled into the final application.

## Windows alpha releases

Source and downloads belong only to `sadiqgarba2553/slide-cloud`.

1. Finish the native build and ensure NSIS bundling has exited successfully.
2. Run `./scripts/package-windows.ps1`. For a shared Cargo cache, pass `-BuildDirectory '../doc-cloud/src-tauri/target/release'`.
3. Verify the managed executable and installer against the final build, then commit and push source to this app's repository.
4. Run `npm run release:prepare` and `npm run release:publish`.
5. Promote signed launcher metadata from the launcher repository only after public downloads pass verification.

The packager produces a managed ZIP with the executable, license, notices and limitations, plus a standalone NSIS installer. The publisher verifies repository ownership, source commit, upload sizes and SHA-256 digests. Launcher 0.7.2 or newer is required by this release's metadata. The managed executable requires WebView2; the standalone installer can handle the prerequisite where supported.

Production publisher signing, clean-machine installation/uninstallation, complete native dialog round trips and other desktop platforms require separate validation. Existing BlueCloud apps, their profiles and their identifiers are preserved.
