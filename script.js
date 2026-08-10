// 颜色配置 — 144 色调色板（12色相 × 4饱和度 × 3明度）
// 使用 HSL 系统生成，覆盖完整色彩空间
function hslToHex(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

// 12 色相 × 4 饱和度 × 3 明度 = 144 色
const HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const SATS = [1.0, 0.75, 0.5, 0.25];
const LIGHTS = [0.25, 0.5, 0.75];
const COLORS = [];
for (const h of HUES) {
    for (const s of SATS) {
        for (const l of LIGHTS) {
            COLORS.push(hslToHex(h, s, l));
        }
    }
}
// 附加黑白灰中性色
COLORS.push('#000000', '#404040', '#808080', '#C0C0C0', '#FFFFFF');

// 预计算调色板 RGB 值，用于导入图片时的颜色量化
const COLOR_RGB = COLORS.map(hex => {
    const h = hex.replace('#', '');
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
});

// 查找与目标 RGB 最接近的调色板颜色索引（欧氏距离）
function findClosestColorIndex(r, g, b) {
    let minDist = Infinity, idx = 0;
    for (let i = 0; i < COLOR_RGB.length; i++) {
        const [pr, pg, pb] = COLOR_RGB[i];
        const d = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb);
        if (d < minDist) { minDist = d; idx = i; }
    }
    return idx;
}

// 当前选中的颜色
let currentColor = '#FF6B6B';
// 是否处于橡皮擦模式
let isEraseMode = false;
// 是否正在绘制
let isDrawing = false;
// 网格大小
let gridSize = 15;
// 历史记录（撤销）
let undoStack = [];
// 是否处于导入图片模式（显示颜色编号而非位置编号）
let isImported = false;
// 导入模式：'sample' 采样导入 / 'full' 全图导入 / 'crop' 裁剪导入
let importMode = 'sample';

// DOM元素
const colorGrid = document.getElementById('colorGrid');
const colorPreview = document.getElementById('colorPreview');
const pixelGrid = document.getElementById('pixelGrid');
const gridSizeSelect = document.getElementById('gridSize');
const clearBtn = document.getElementById('clearBtn');
const fillBtn = document.getElementById('fillBtn');
const eraseBtn = document.getElementById('eraseBtn');
const undoBtn = document.getElementById('undoBtn');
const importBtn = document.getElementById('importBtn');
const imageInput = document.getElementById('imageInput');
const importModeSelect = document.getElementById('importMode');
// 裁剪弹窗元素
const cropModal = document.getElementById('cropModal');
const cropCanvas = document.getElementById('cropCanvas');
const cropBox = document.getElementById('cropBox');
const cropOverlayTop = document.getElementById('cropOverlayTop');
const cropOverlayBottom = document.getElementById('cropOverlayBottom');
const cropOverlayLeft = document.getElementById('cropOverlayLeft');
const cropOverlayRight = document.getElementById('cropOverlayRight');
const cropConfirm = document.getElementById('cropConfirm');
const cropCancel = document.getElementById('cropCancel');

// 初始化颜色选择区
function initColorGrid() {
    colorGrid.innerHTML = '';
    COLORS.forEach((color, idx) => {
        const colorBlock = document.createElement('div');
        colorBlock.className = 'color-block';
        colorBlock.style.backgroundColor = color;
        // 添加编号文字（从1开始），根据背景色选择对比色
        const num = idx + 1;
        const textColor = getContrastColor(color);
        colorBlock.textContent = num;
        colorBlock.style.color = textColor;
        colorBlock.dataset.color = color;
        colorBlock.dataset.index = num;
        colorBlock.addEventListener('click', () => selectColor(color));
        colorGrid.appendChild(colorBlock);
    });
    // 默认选中第一个颜色
    selectColor(COLORS[0]);
}

// 将任意格式颜色（hex/rgb）转为小写 hex，用于比较
function toHex(color) {
    if (!color) return '';
    if (color.startsWith('#')) return color.toLowerCase();
    const m = color.match(/\d+/g);
    if (!m) return color.toLowerCase();
    return '#' + m.slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join('').toLowerCase();
}

// 选择颜色
function selectColor(color) {
    currentColor = color;
    colorPreview.style.backgroundColor = color;
    
    // 更新选中状态
    const targetHex = toHex(color);
    const colorBlocks = colorGrid.querySelectorAll('.color-block');
    colorBlocks.forEach(block => {
        block.classList.remove('selected');
        if (toHex(block.style.backgroundColor) === targetHex) {
            block.classList.add('selected');
        }
    });
    
    // 如果在橡皮擦模式，退出橡皮擦模式
    if (isEraseMode) {
        toggleEraseMode();
    }
}

// 生成像素网格
function generatePixelGrid(size) {
    pixelGrid.innerHTML = '';
    pixelGrid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    pixelGrid.style.gridTemplateRows = `repeat(${size}, 1fr)`;
    
    // 根据容器大小计算单元格尺寸
    const containerWidth = Math.min(500, window.innerWidth - 60);
    const cellSize = Math.floor((containerWidth - (size - 1) - 6) / size);
    
    // 字号根据格子大小自适应
    const fontSize = Math.max(8, Math.floor(cellSize * 0.4));

    for (let i = 0; i < size * size; i++) {
        const cell = document.createElement('div');
        cell.className = 'pixel-cell';
        cell.style.width = `${cellSize}px`;
        cell.style.height = `${cellSize}px`;
        cell.style.fontSize = `${fontSize}px`;
        cell.textContent = String(i + 1);
        
        // 绑定事件
        cell.addEventListener('mousedown', () => startDrawing(cell));
        cell.addEventListener('mouseenter', () => draw(cell));
        cell.addEventListener('mouseup', stopDrawing);
        
        // 触摸事件支持
        cell.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startDrawing(cell);
        });
        cell.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            if (target && target.classList.contains('pixel-cell')) {
                draw(target);
            }
        });
        cell.addEventListener('touchend', stopDrawing);
        
        pixelGrid.appendChild(cell);
    }
}

// 根据背景色返回对比色（黑或白），保证数字可见（支持 hex 和 rgb 格式）
function getContrastColor(color) {
    let r, g, b;
    if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        r = parseInt(hex.substr(0, 2), 16);
        g = parseInt(hex.substr(2, 2), 16);
        b = parseInt(hex.substr(4, 2), 16);
    } else {
        const m = color.match(/\d+/g);
        if (!m) return '#000000';
        r = +m[0]; g = +m[1]; b = +m[2];
    }
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#FFFFFF';
}

// 判断是否为白色/空背景
function isBlankColor(bgColor) {
    return !bgColor || bgColor === 'rgb(255, 255, 255)' || bgColor.toLowerCase() === '#ffffff';
}

// 统一设置格子背景色并同步数字对比色
function applyCellColor(cell, bgColor) {
    cell.style.backgroundColor = bgColor;
    // 导入模式下所有格子（包括白色）都用对比色显示编号
    // 非导入模式下，空白格用浅灰色显示位置编号
    cell.style.color = isImported
        ? getContrastColor(bgColor)
        : (isBlankColor(bgColor) ? '#bbb' : getContrastColor(bgColor));
}

// 获取当前网格状态快照（背景色 + 文本，用于撤销恢复）
function getSnapshot() {
    return Array.from(pixelGrid.children).map(cell => ({
        bg: cell.style.backgroundColor,
        text: cell.textContent
    }));
}

// 从快照恢复网格
function restoreSnapshot(snapshot) {
    const cells = pixelGrid.querySelectorAll('.pixel-cell');
    cells.forEach((cell, i) => {
        const s = snapshot[i];
        if (s && typeof s === 'object') {
            applyCellColor(cell, s.bg || '');
            cell.textContent = s.text !== undefined ? s.text : cell.textContent;
        } else {
            // 兼容旧格式（纯背景色字符串）
            applyCellColor(cell, s || '');
        }
    });
}

// 保存当前状态到撤销栈（绘制操作前调用）
function pushHistory() {
    undoStack.push(getSnapshot());
    updateUndoRedoButtons();
}

// 更新撤销按钮的可用状态
function updateUndoRedoButtons() {
    undoBtn.disabled = undoStack.length === 0;
}

// 撤销
function undo() {
    if (undoStack.length === 0) return;
    restoreSnapshot(undoStack.pop());
    updateUndoRedoButtons();
}

// 开始绘制
function startDrawing(cell) {
    pushHistory();
    isDrawing = true;
    draw(cell);
}

// 绘制
function draw(cell) {
    if (isDrawing) {
        applyCellColor(cell, isEraseMode ? '#FFFFFF' : currentColor);
        // 导入模式下同步更新格子编号为当前颜色的调色板序号
        if (isImported) {
            if (isEraseMode) {
                // 橡皮擦：清空格子，恢复位置编号
                const posIdx = Array.from(pixelGrid.children).indexOf(cell);
                cell.textContent = String(posIdx + 1);
                cell.style.color = '#bbb';
            } else {
                const idx = COLORS.indexOf(currentColor);
                cell.textContent = idx >= 0 ? String(idx + 1) : '';
            }
        } else {
            // 非导入模式：绘制后保持位置编号不变
            const posIdx = Array.from(pixelGrid.children).indexOf(cell);
            cell.textContent = String(posIdx + 1);
        }
    }
}

// 停止绘制
function stopDrawing() {
    isDrawing = false;
}

// 清空画布
function clearCanvas() {
    pushHistory();
    const cells = pixelGrid.querySelectorAll('.pixel-cell');
    cells.forEach(cell => {
        applyCellColor(cell, '#FFFFFF');
        if (isImported) cell.textContent = '';
    });
}

// 填充全部
function fillCanvas() {
    pushHistory();
    const cells = pixelGrid.querySelectorAll('.pixel-cell');
    const idx = COLORS.indexOf(currentColor);
        cells.forEach(cell => {
            applyCellColor(cell, currentColor);
            if (isImported) {
                cell.textContent = idx >= 0 ? String(idx + 1) : '';
            } else {
                const posIdx = Array.from(pixelGrid.children).indexOf(cell);
                cell.textContent = String(posIdx + 1);
            }
        });
}

// 导入图片：根据当前导入模式分发
function importImage(img) {
    if (importMode === 'full') {
        importImageFull(img);
    } else if (importMode === 'crop') {
        openCropModal(img);
    } else {
        importImageSample(img);
    }
}

// 采样导入：按短边居中裁剪成正方形后缩放到网格大小，每格采样一个像素
function importImageSample(img) {
    pushHistory();
    const size = gridSize;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    // 按短边居中裁剪成正方形后缩放到网格大小
    const minDim = Math.min(img.width, img.height);
    const sx = (img.width - minDim) / 2;
    const sy = (img.height - minDim) / 2;
    ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    const cells = pixelGrid.querySelectorAll('.pixel-cell');
    isImported = true;
    for (let i = 0; i < size * size; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
        const cell = cells[i];
        if (!cell) continue;
        if (a < 128) {
            // 透明像素视为空格
            applyCellColor(cell, '#FFFFFF');
            cell.textContent = '';
        } else {
            const idx = findClosestColorIndex(r, g, b);
            applyCellColor(cell, COLORS[idx]);
            cell.textContent = String(idx + 1);
        }
    }
}

// 全图导入：保持宽高比裁剪填满网格（cover），裁剪超出网格的边缘
function importImageFull(img) {
    pushHistory();
    const size = gridSize;
    // 按比例裁剪使图片填满 size×size（cover）
    const scale = Math.max(size / img.width, size / img.height);
    const drawW = Math.max(1, Math.round(img.width * scale));
    const drawH = Math.max(1, Math.round(img.height * scale));
    const offsetX = Math.floor((size - drawW) / 2);
    const offsetY = Math.floor((size - drawH) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    const data = ctx.getImageData(0, 0, size, size).data;

    const cells = pixelGrid.querySelectorAll('.pixel-cell');
    isImported = true;
    for (let i = 0; i < size * size; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
        const cell = cells[i];
        if (!cell) continue;
        if (a < 128) {
            // 透明像素 → 空格
            applyCellColor(cell, '#FFFFFF');
            cell.textContent = '';
        } else {
            const idx = findClosestColorIndex(r, g, b);
            applyCellColor(cell, COLORS[idx]);
            cell.textContent = String(idx + 1);
        }
    }
}

// 裁剪导入：将指定正方形区域缩放到网格大小后导入
function importImageCropRegion(img, sx, sy, sSize) {
    pushHistory();
    const size = gridSize;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    const cells = pixelGrid.querySelectorAll('.pixel-cell');
    isImported = true;
    for (let i = 0; i < size * size; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
        const cell = cells[i];
        if (!cell) continue;
        if (a < 128) {
            applyCellColor(cell, '#FFFFFF');
            cell.textContent = '';
        } else {
            const idx = findClosestColorIndex(r, g, b);
            applyCellColor(cell, COLORS[idx]);
            cell.textContent = String(idx + 1);
        }
    }
}

// ===== 裁剪弹窗逻辑 =====
let cropState = null; // { img, dispW, dispH, scale, boxX, boxY, boxSize }
let cropDragging = false;
let cropDragStart = null;

// 打开裁剪弹窗，预览图片并初始化正方形裁剪框
function openCropModal(img) {
    const maxDisp = 400;
    const scale = Math.min(maxDisp / img.width, maxDisp / img.height, 1);
    const dispW = Math.max(1, Math.round(img.width * scale));
    const dispH = Math.max(1, Math.round(img.height * scale));
    // 裁剪框为正方形，边长取显示尺寸的短边，初始居中
    const boxSize = Math.min(dispW, dispH);
    cropState = {
        img,
        dispW,
        dispH,
        scale,
        boxSize,
        boxX: Math.floor((dispW - boxSize) / 2),
        boxY: Math.floor((dispH - boxSize) / 2)
    };

    cropCanvas.width = dispW;
    cropCanvas.height = dispH;
    const ctx = cropCanvas.getContext('2d');
    ctx.clearRect(0, 0, dispW, dispH);
    ctx.drawImage(img, 0, 0, dispW, dispH);

    updateCropBoxUI();
    cropModal.classList.add('active');
}

// 更新裁剪框与四块遮罩的位置
function updateCropBoxUI() {
    if (!cropState) return;
    const { boxX, boxY, boxSize, dispW, dispH } = cropState;
    cropBox.style.width = boxSize + 'px';
    cropBox.style.height = boxSize + 'px';
    cropBox.style.left = boxX + 'px';
    cropBox.style.top = boxY + 'px';
    // 四块半透明遮罩盖住裁剪框外的图像区域
    cropOverlayTop.style.cssText = `position:absolute;left:0;top:0;width:${dispW}px;height:${boxY}px;background:rgba(0,0,0,0.5);pointer-events:none;`;
    cropOverlayBottom.style.cssText = `position:absolute;left:0;top:${boxY + boxSize}px;width:${dispW}px;height:${dispH - (boxY + boxSize)}px;background:rgba(0,0,0,0.5);pointer-events:none;`;
    cropOverlayLeft.style.cssText = `position:absolute;left:0;top:${boxY}px;width:${boxX}px;height:${boxSize}px;background:rgba(0,0,0,0.5);pointer-events:none;`;
    cropOverlayRight.style.cssText = `position:absolute;left:${boxX + boxSize}px;top:${boxY}px;width:${dispW - (boxX + boxSize)}px;height:${boxSize}px;background:rgba(0,0,0,0.5);pointer-events:none;`;
}

// 限制裁剪框在图像边界内移动
function moveCropBox(dx, dy) {
    if (!cropState) return;
    let nx = cropDragStart.bx + dx;
    let ny = cropDragStart.by + dy;
    nx = Math.max(0, Math.min(nx, cropState.dispW - cropState.boxSize));
    ny = Math.max(0, Math.min(ny, cropState.dispH - cropState.boxSize));
    cropState.boxX = nx;
    cropState.boxY = ny;
    updateCropBoxUI();
}

function closeCropModal() {
    cropModal.classList.remove('active');
    cropState = null;
    cropDragging = false;
}

// 处理用户选择的图片文件
function handleImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        alert('请选择图片文件');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => importImage(img);
        img.onerror = () => alert('图片加载失败');
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// 切换橡皮擦模式
function toggleEraseMode() {
    isEraseMode = !isEraseMode;
    eraseBtn.classList.toggle('active');
    
    if (isEraseMode) {
        eraseBtn.style.background = 'linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)';
        colorPreview.style.borderColor = '#e74c3c';
        colorPreview.innerHTML = '<span style="color:#e74c3c;font-weight:bold;font-size:12px">✕</span>';
    } else {
        eraseBtn.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
        colorPreview.style.borderColor = '#ddd';
        colorPreview.innerHTML = '';
    }
}

// 网格大小改变
function onGridSizeChange() {
    gridSize = parseInt(gridSizeSelect.value);
    isImported = false; // 切换网格大小后恢复位置编号模式
    generatePixelGrid(gridSize);
    // 网格尺寸变化后历史快照失效，清空历史
    undoStack = [];
    updateUndoRedoButtons();
}

// 窗口大小改变时重新生成网格
function onWindowResize() {
    generatePixelGrid(gridSize);
}

// 初始化
function init() {
    initColorGrid();
    generatePixelGrid(gridSize);
    
    // 绑定事件
    clearBtn.addEventListener('click', clearCanvas);
    fillBtn.addEventListener('click', fillCanvas);
    eraseBtn.addEventListener('click', toggleEraseMode);
    undoBtn.addEventListener('click', undo);
    importBtn.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', (e) => {
        handleImageFile(e.target.files[0]);
        e.target.value = ''; // 允许重复选择同一文件
    });
    importModeSelect.addEventListener('change', () => {
        importMode = importModeSelect.value;
    });
    gridSizeSelect.addEventListener('change', onGridSizeChange);
    window.addEventListener('resize', onWindowResize);

    // 裁剪弹窗：鼠标拖拽裁剪框
    cropBox.addEventListener('mousedown', (e) => {
        if (!cropState) return;
        cropDragging = true;
        cropDragStart = { x: e.clientX, y: e.clientY, bx: cropState.boxX, by: cropState.boxY };
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (!cropDragging) return;
        moveCropBox(e.clientX - cropDragStart.x, e.clientY - cropDragStart.y);
    });

    // 裁剪弹窗：触摸拖拽裁剪框
    cropBox.addEventListener('touchstart', (e) => {
        if (!cropState) return;
        const t = e.touches[0];
        cropDragging = true;
        cropDragStart = { x: t.clientX, y: t.clientY, bx: cropState.boxX, by: cropState.boxY };
        e.preventDefault();
    }, { passive: false });
    document.addEventListener('touchmove', (e) => {
        if (!cropDragging) return;
        const t = e.touches[0];
        moveCropBox(t.clientX - cropDragStart.x, t.clientY - cropDragStart.y);
        e.preventDefault();
    }, { passive: false });

    // 裁剪弹窗：确认 / 取消
    cropConfirm.addEventListener('click', () => {
        if (!cropState) return;
        const { img, scale, boxX, boxY, boxSize } = cropState;
        // 把显示坐标映射回原图坐标
        const sx = boxX / scale;
        const sy = boxY / scale;
        const sSize = boxSize / scale;
        closeCropModal();
        importImageCropRegion(img, sx, sy, sSize);
    });
    cropCancel.addEventListener('click', closeCropModal);

    // 键盘快捷键：Ctrl+Z 撤销
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }
        // Esc 关闭裁剪弹窗
        if (e.key === 'Escape' && cropModal.classList.contains('active')) {
            closeCropModal();
        }
    });

    updateUndoRedoButtons();
    
    // 全局鼠标/触摸事件
    document.addEventListener('mouseup', () => { cropDragging = false; stopDrawing(); });
    document.addEventListener('touchend', () => { cropDragging = false; stopDrawing(); });
}

// DOM加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}