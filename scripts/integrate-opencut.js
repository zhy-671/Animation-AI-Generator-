/**
 * Script to integrate OpenCut editor into the project
 * 
 * This script copies OpenCut source files and adapts import paths
 * Run with: node scripts/integrate-opencut.js
 */

const fs = require('fs');
const path = require('path');

const OPENCUT_SRC = path.join(__dirname, '../OpenCut-main/apps/web/src');
const TARGET_DIR = path.join(__dirname, '../lib/opencut');

// Directories to copy
const DIRS_TO_COPY = [
  'components/editor',
  'components/providers',
  'stores',
  'hooks',
  'lib',
  'types',
  'constants',
];

// Additional component files to copy (not in subdirectories)
const ADDITIONAL_COMPONENTS = [
  'components/header-base.tsx',
  'components/keyboard-shortcuts-help.tsx',
  'components/rename-project-dialog.tsx',
  'components/delete-project-dialog.tsx',
  'components/theme-toggle.tsx',
  'components/icons.tsx',
];

// UI components to copy to project's components/ui/ directory
const UI_COMPONENTS_TO_COPY = [
  'components/ui/context-menu.tsx',
  'components/ui/tooltip.tsx',
  'components/ui/slider.tsx',
  'components/ui/label.tsx',
  'components/ui/scroll-area.tsx',
  'components/ui/dialog.tsx',
  'components/ui/popover.tsx',
  'components/ui/radio-group.tsx',
  'components/ui/progress.tsx',
  'components/ui/checkbox.tsx',
  'components/ui/dropdown-menu.tsx',
];

// Files to copy
const FILES_TO_COPY = [
  'components/ui', // UI components that OpenCut uses
];

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`⚠️  Source directory does not exist: ${src}`);
    return;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✓ Copied: ${path.relative(OPENCUT_SRC, srcPath)}`);
    }
  }
}

function adaptImports(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  
  // Replace @/ imports with @/lib/opencut/ (except UI components which use @/components/ui)
  const adapted = content
    .replace(/from ["']@\/(stores|hooks|lib|types|constants)/g, 'from "@/lib/opencut/$1')
    .replace(/import ["']@\/(stores|hooks|lib|types|constants)/g, 'import "@/lib/opencut/$1')
    .replace(/from ["']@\/components\/ui/g, 'from "@/components/ui')
    .replace(/import ["']@\/components\/ui/g, 'import "@/components/ui')
    .replace(/from ["']@\/components\/(editor|providers)/g, 'from "@/lib/opencut/components/$1')
    .replace(/import ["']@\/components\/(editor|providers)/g, 'import "@/lib/opencut/components/$1');

  fs.writeFileSync(filePath, adapted, 'utf8');
  console.log(`✓ Adapted imports: ${path.relative(TARGET_DIR, filePath)}`);
}

function adaptAllFiles(dir) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      adaptAllFiles(fullPath);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      adaptImports(fullPath);
    }
  }
}

function main() {
  console.log('🚀 Starting OpenCut integration...\n');

  // Copy directories
  for (const dir of DIRS_TO_COPY) {
    const src = path.join(OPENCUT_SRC, dir);
    const dest = path.join(TARGET_DIR, dir);
    console.log(`📁 Copying ${dir}...`);
    copyDir(src, dest);
  }

  // Copy additional component files
  console.log('\n📄 Copying additional components...');
  for (const comp of ADDITIONAL_COMPONENTS) {
    const src = path.join(OPENCUT_SRC, comp);
    const dest = path.join(TARGET_DIR, comp);
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`✓ Copied: ${comp}`);
    } else {
      console.log(`⚠️  Source file not found: ${comp}`);
    }
  }

  // Copy UI components to project's components/ui/ directory
  console.log('\n🎨 Copying UI components to project...');
  const PROJECT_UI_DIR = path.join(__dirname, '../components/ui');
  for (const comp of UI_COMPONENTS_TO_COPY) {
    const src = path.join(OPENCUT_SRC, comp);
    const fileName = path.basename(comp);
    const dest = path.join(PROJECT_UI_DIR, fileName);
    if (fs.existsSync(src)) {
      let content = fs.readFileSync(src, 'utf8');
      // Adapt imports in UI components - replace OpenCut paths with project paths
      content = content
        .replace(/from ["']\.\.\/\.\.\/lib\/utils/g, 'from "@/lib/utils')
        .replace(/from ["']@\/lib\/utils/g, 'from "@/lib/utils');
      fs.writeFileSync(dest, content, 'utf8');
      console.log(`✓ Copied UI component: ${fileName}`);
    } else {
      console.log(`⚠️  UI component not found: ${comp}`);
    }
  }

  // Adapt imports
  console.log('\n🔧 Adapting import paths...');
  adaptAllFiles(TARGET_DIR);

  console.log('\n✅ OpenCut integration complete!');
  console.log('\nNext steps:');
  console.log('1. Update tsconfig.json to add path alias: "@/lib/opencut/*": ["./lib/opencut/*"]');
  console.log('2. Install missing dependencies from OpenCut-main/apps/web/package.json');
  console.log('3. Update components/storyboard/opencut-editor.tsx to use the copied components');
}

if (require.main === module) {
  main();
}

module.exports = { copyDir, adaptImports };

